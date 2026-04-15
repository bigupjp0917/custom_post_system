import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_NAME = 'gemini-2.0-flash-preview-image-generation'

function resolveGeminiApiKey() {
  const candidates = [
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
  ]
  for (const key of candidates) {
    const value = process?.env?.[key]
    if (typeof value === 'string' && value.trim()) {
      return { apiKey: value.trim(), keyName: key }
    }
  }
  return { apiKey: '', keyName: '' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).setHeader('Allow', 'POST').json({
      error: 'Method not allowed',
    })
  }

  const { apiKey, keyName } = resolveGeminiApiKey()
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured',
      debug: {
        stage: 'env_check',
        envVarName: 'GEMINI_API_KEY | GOOGLE_API_KEY | GOOGLE_GENERATIVE_AI_API_KEY',
        resolvedKey: keyName || 'none',
      },
    })
  }

  const { sourceText, profile, platform } = req.body ?? {}
  if (!sourceText || typeof sourceText !== 'string') {
    return res.status(400).json({
      error: 'sourceText is required',
    })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
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
    const parts = result?.response?.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((part) => part.inlineData?.mimeType?.startsWith('image/'))

    if (!imagePart?.inlineData?.data) {
      return res.status(500).json({
        error: 'Image generation returned no image data',
      })
    }

    const imageDataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
    return res.status(200).json({ imageDataUrl })
  } catch (error) {
    console.error('Gemini image generation error:', error)
    return res.status(500).json({
      error: 'Failed to generate image',
    })
  }
}
