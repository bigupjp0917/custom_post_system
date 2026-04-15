import { GoogleGenerativeAI } from '@google/generative-ai'

// 2.0 preview 系は利用できないことが多い。画像出力は 2.5 Flash Image（Developer API）
const MODEL_NAME = 'gemini-2.5-flash-image'

/** @param {string | undefined} value */
function toHttpSafeApiKeyToken(value) {
  return String(value ?? '')
    .trim()
    .replace(/\r\n|\r|\n/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .trim()
}

function resolveGeminiApiKey() {
  const rawKey = String(process.env.GEMINI_API_KEY || '').trim()
  const cleanKey = toHttpSafeApiKeyToken(rawKey)
  if (cleanKey) {
    return { apiKey: cleanKey, keyName: 'GEMINI_API_KEY' }
  }
  const fallbackSources = [
    ['GOOGLE_API_KEY', process?.env?.GOOGLE_API_KEY],
    ['GOOGLE_GENERATIVE_AI_API_KEY', process?.env?.GOOGLE_GENERATIVE_AI_API_KEY],
  ]
  for (const [keyName, rawValue] of fallbackSources) {
    const raw = String(rawValue ?? '').trim()
    const apiKey = toHttpSafeApiKeyToken(raw)
    if (apiKey) {
      return { apiKey, keyName }
    }
  }
  return { apiKey: '', keyName: '' }
}

function extractImagePart(result) {
  const candidates = result?.response?.candidates || []
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || []
    for (const part of parts) {
      const mime = part?.inlineData?.mimeType
      if (mime?.startsWith('image/') && part?.inlineData?.data) {
        return part.inlineData
      }
    }
  }
  return null
}

function json(res, status, body) {
  return res.status(status).setHeader('Content-Type', 'application/json').json(body)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).setHeader('Allow', 'POST').json({
      error: 'Method not allowed',
    })
  }

  const { apiKey, keyName } = resolveGeminiApiKey()
  if (!apiKey) {
    return json(res, 500, {
      error: 'GEMINI_API_KEY is not configured',
      debug: {
        stage: 'env_check',
        envVarName: 'GEMINI_API_KEY | GOOGLE_API_KEY | GOOGLE_GENERATIVE_AI_API_KEY',
        resolvedKey: keyName || 'none',
        api: 'generate-image',
      },
    })
  }

  const { sourceText, profile, platform } = req.body ?? {}
  if (!sourceText || typeof sourceText !== 'string') {
    return json(res, 400, {
      error: 'sourceText is required',
    })
  }

  try {
    const httpSafeKey = toHttpSafeApiKeyToken(apiKey)
    const genAI = new GoogleGenerativeAI(httpSafeKey)
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        // 画像出力モデルでは TEXT + IMAGE を明示（省略時は画像が返らないことがある）
        responseModalities: ['TEXT', 'IMAGE'],
      },
    })

    const ratioInstruction =
      platform === 'threads'
        ? '縦長4:5（例: 1080x1350）'
        : '横長16:9（例: 1280x720）'

    const prompt = `SNS投稿に合わせた開運画像を1枚生成してください。
プラットフォーム: ${platform === 'threads' ? 'Threads' : 'X'}
投稿本文:
${sourceText}

キャラクター設定:
- 鑑定師名: ${profile?.appraiserName || '神秘の鑑定師'}
- 肩書き: ${profile?.title || '波動リーディング専門家'}
- キャラ設定: ${profile?.characterSetting || '神秘的で知的'}
- 世界観: ${profile?.worldview || '神秘的・ミステリアス'}
- 得意アプローチ: ${
      profile?.specialtyApproach || '潜在意識のブロック解除、言霊による浄化'
    }

画像要件:
- ダークネイビーとゴールド基調
- 投稿内キーワード（例: 満月、癒やし、金運、龍神）を象徴モチーフとして反映
- 文字は入れない
- スマホで映える高コントラストで神秘的なアート
- 画像比率は必ず ${ratioInstruction} で生成する`

    const result = await model.generateContent(prompt)
    const inline = extractImagePart(result)

    if (!inline?.data) {
      const finish = result?.response?.candidates?.[0]?.finishReason
      return json(res, 500, {
        error: 'Image generation returned no image data',
        debug: {
          stage: 'empty_image',
          model: MODEL_NAME,
          finishReason: finish || 'unknown',
          api: 'generate-image',
          hint:
            'Gemini 画像モデルは課金プランが必要な場合があります。Google AI Studio でプロジェクト・課金を確認してください。',
        },
      })
    }

    const imageDataUrl = `data:${inline.mimeType};base64,${inline.data}`
    return json(res, 200, { imageDataUrl })
  } catch (error) {
    console.error('Gemini image generation error:', error)
    return json(res, 500, {
      error: 'Failed to generate image',
      debug: {
        stage: 'exception',
        model: MODEL_NAME,
        api: 'generate-image',
        message: error instanceof Error ? error.message : String(error),
      },
    })
  }
}
