import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_NAME = 'gemini-1.5-flash'

const BASE_SYSTEM_PROMPT = `あなたは神秘的で知的な占い師。読者の魂に寄り添うような、丁寧かつ深みのある言葉遣い（〜ですね、〜なのです、といったトーン）でリライトしてください。
星座、運勢、スピリチュアルなエッセンスを自然に混ぜ込んでください。`

const SNS_OUTPUT_RULES = `以下のJSONのみを返してください。余計な説明文は不要です。
{
  "xPost": "X向け本文",
  "threadsPost": "Threads向け本文"
}

制約:
- xPost: 140文字以内。1行目にドキッとするフック。改行を適切に入れる。
- threadsPost: 450〜520文字程度。個人的な体験談や心の内側に語りかけるエッセイ風。
- どちらも日本語で、読みやすく自然な文体にする。`

const FORTUNE_OUTPUT_RULES = `以下のJSONのみを返してください。余計な説明文は不要です。
{
  "fortuneText": "鑑定文",
  "upsellText": "上位ランクへの提案文"
}
- JSON以外を絶対に出力しない。`

const SALES_STRUCTURE_PROMPT = `以下は「売れる鑑定導線」の骨組みです。文体ではなく構成アルゴリズムとして使ってください。
- 無料当選の特別感（選ばれた感覚）を最初に与える
- 魂の波動・潜在意識へアクセスした描写で期待感を高める
- 核心を示しつつ「最後の1ピース不足」を提示する
- 期限（24時間/48時間）を用いた緊迫感と行動喚起を入れる
- 追いメッセージでは「再度波動を合わせたら魂の声が聞こえた」流れを採用する

重要:
- 「ナナ」など固有名詞や、資料内の特定エピソードを流用しない
- 必ずユーザー指定のキャラ背景・占術・口調に置換する`

const jsonHeaders = {
  'Content-Type': 'application/json',
}

function resolveGeminiApiKey() {
  // Read env lazily inside request lifecycle for serverless runtimes.
  const sources = [
    ['GEMINI_API_KEY', process?.env?.GEMINI_API_KEY],
    ['GOOGLE_API_KEY', process?.env?.GOOGLE_API_KEY],
    ['GOOGLE_GENERATIVE_AI_API_KEY', process?.env?.GOOGLE_GENERATIVE_AI_API_KEY],
  ]
  for (const [keyName, rawValue] of sources) {
    if (typeof rawValue !== 'string') continue
    const trimmed = rawValue.trim()
    if (trimmed) {
      return { apiKey: trimmed, keyName }
    }
  }

  return { apiKey: '', keyName: '' }
}

function sanitizeKeyPreview(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey) return 'empty'
  if (apiKey.length <= 6) return `${apiKey[0] || ''}***${apiKey[apiKey.length - 1] || ''}`
  return `${apiKey.slice(0, 3)}***${apiKey.slice(-3)}`
}

function validateApiKey(apiKey) {
  if (typeof apiKey !== 'string') {
    return { ok: false, reason: 'apiKey is not a string' }
  }
  if (!apiKey.trim()) {
    return { ok: false, reason: 'apiKey is empty after trim' }
  }
  // Gemini keys generally start with AIza and have enough length.
  if (!/^AIza[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
    return { ok: false, reason: 'apiKey format mismatch' }
  }
  return { ok: true, reason: 'ok' }
}

function getRuntimeDebug() {
  const envKeys = Object.keys(process?.env || {})
  const redactedEnvKeys = envKeys
    .filter((key) => key && !key.startsWith('_'))
    .slice(0, 80)
  return {
    hasProcess: typeof process !== 'undefined',
    nodeVersion: process?.version || 'unknown',
    vercelEnv: process?.env?.VERCEL_ENV || 'unknown',
    nodeEnv: process?.env?.NODE_ENV || 'unknown',
    envKeyHints: envKeys.filter(
      (key) =>
        key.includes('GEMINI') ||
        key.includes('GOOGLE') ||
        key.includes('API_KEY'),
    ),
    envKeysSample: redactedEnvKeys,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).setHeader('Allow', 'POST').json({
      error: 'Method not allowed',
    })
  }

  const { apiKey, keyName } = resolveGeminiApiKey()
  const keyValidation = validateApiKey(apiKey)
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured',
      debug: {
        stage: 'env_check',
        envVarName: 'GEMINI_API_KEY | GOOGLE_API_KEY | GOOGLE_GENERATIVE_AI_API_KEY',
        envPresent: false,
        keyPreview: sanitizeKeyPreview(apiKey),
        ...getRuntimeDebug(),
      },
    })
  }
  if (!keyValidation.ok) {
    return res.status(500).json({
      error: 'API key format appears invalid',
      debug: {
        stage: 'env_validation',
        envVarName: keyName,
        envPresent: true,
        keyPreview: sanitizeKeyPreview(apiKey),
        validationReason: keyValidation.reason,
        ...getRuntimeDebug(),
      },
    })
  }

  const { sourceText, mode = 'sns', profile, productRank = 'free' } = req.body ?? {}
  if (!sourceText || typeof sourceText !== 'string') {
    return res.status(400).json({
      error: 'sourceText is required',
      debug: {
        stage: 'request_validation',
        mode,
        sourceTextType: typeof sourceText,
        resolvedEnvKey: keyName,
        keyPreview: sanitizeKeyPreview(apiKey),
      },
    })
  }

  const honorificMap = {
    high: '高: 丁寧で気品があり、語尾は「〜ですね」「〜なのです」を多めに使う',
    medium: '中: 自然で親しみのある丁寧語を使う',
    low: '低: 柔らかい常体寄りで、必要に応じて丁寧語を使う',
  }
  const metaphorMap = {
    high: '多め: 星、月、光、風などの比喩を豊富に入れる',
    medium: '標準: 比喩は自然に、過剰にならない程度に入れる',
    low: '控えめ: 比喩は最小限にして明瞭さを優先する',
  }
  const templateInstruction = `口調テンプレート:
- 敬語強度: ${honorificMap.medium}
- 比喩量: ${metaphorMap.high}
- 絵文字: 使用は文脈に応じて自然に調整`

  const characterPriorityInstruction = `キャラ設定の最優先ルール:
- 鑑定師名: ${profile?.appraiserName || '神秘的な占い師'}
- 肩書き: ${profile?.title || '波動リーディング専門家'}
- キャラ設定: ${
    profile?.characterSetting || '丁寧、知的、少し含みのある口調。'
  }
- 修行・経歴: ${
    profile?.trainingHistory || '占術歴10年。精神世界の探究と実践を重ねている。'
  }
- 鑑定スタイル: ${
    profile?.readingStyle || '魂の波動にそっと手を添え、高次の領域からメッセージを受け取る'
  }
- 一人称: ${profile?.firstPerson || '私'}
- 語尾・トーン: ${profile?.tone || '〜ですね、〜なのです'}
- NGワード: ${profile?.ngWords || 'なし'}
- 得意アプローチ: ${
    profile?.specialtyApproach || '潜在意識のブロック解除、言霊による浄化'
  }
- 世界観: ${profile?.worldview || '神秘的・ミステリアス'}

上記要素を最優先し、話し方・比喩・具体例・権威付けの内容に反映すること。`

  const fortuneRankInstruction = {
    free: `商品ランク: 無料
- 文字数は300文字前後（260〜360文字）に厳格化する。
- 無料鑑定当選の特別感を入れ、24時間以内に魂へアクセスした緊迫感を維持する。
- 核心に触れつつ、さらなる解決には有料鑑定が必要であることを神秘的に伝える。
- 構成は「### 今視えている本質」「---」「### 最後の1ピース」「---」「### 24時間以内に開く扉」の形式にする。`,
    ume: `商品ランク: 梅（ライト）
- 文字数は500文字前後（440〜580文字）に厳格化する。
- 要点を整理し、相談者が今すぐできる助言を明確にまとめる。
- 構成は「### 現状の読み解き」「---」「### すぐにできる行動」「---」「### 近未来の兆し」にする。`,
    take: `商品ランク: 竹（スタンダード）
- 文字数は1500文字前後（1350〜1700文字）に厳格化する。
- AIが短くまとめないこと。詳細に、具体例を挙げて、相談者の心に深く寄り添って記述する。
- 状況分析、課題の背景、具体的アクションプラン、今後の展望を十分に詳述する。
- 構成は小見出しと区切り線を使い「### 魂の現在地」「---」「### 課題の深層」「---」「### 実践アクションプラン」「---」「### 未来の展望」にする。`,
    matsu: `商品ランク: 松（プレミアム）
- 文字数は2000文字以上（最低2000文字、推奨2200文字前後）に厳格化する。
- AIが短くまとめないこと。詳細に、具体例を挙げて、相談者の心に深く寄り添って記述する。
- 深い霊視とヒーリングのエッセンスを込め、一生モノの鑑定書として作成する。
- 直近3ヶ月の運勢バイオリズムを月ごとに具体的に記述する。
- 構成は小見出しと区切り線を使い「### 魂の共鳴診断」「---」「### 深層霊視と癒やし」「---」「### 3ヶ月運勢バイオリズム」「---」「### 人生航路の羅針盤」にする。`,
  }

  const upsellInstruction = {
    free:
      'upsellTextには梅以上へ導く独立提案文を120〜220文字で作成する。「再度波動を合わせると魂の声が聞こえた」という追いLINEロジックを入れ、48時間限定で行動喚起する。',
    ume: 'upsellTextには竹または松へ導く独立提案文を160〜260文字で作成する。追いLINEロジックと48時間限定の行動喚起を入れ、詳細分析で得られる価値を伝える。',
    take:
      'upsellTextには松へ導く独立提案文を180〜300文字で作成する。追いLINEロジックを使い、松で得られる3ヶ月運勢バイオリズム・深層ヒーリング価値を強く訴求する。',
    matsu:
      'upsellTextは空文字にする（最上位ランクのためアップセル不要）。',
  }

  try {
    // Initialize only after strict validation above.
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: `${BASE_SYSTEM_PROMPT}

${SALES_STRUCTURE_PROMPT}
${characterPriorityInstruction}

キャラ名: ${profile?.appraiserName || '神秘的な占い師'}
キャラ設定: ${profile?.characterSetting || '丁寧、知的、少し含みのある口調。'}
SNS向けハッシュタグ候補: ${profile?.hashtags || '#占い #運勢'}
${templateInstruction}`,
    })

    const prompt = `${mode === 'fortune' ? FORTUNE_OUTPUT_RULES : SNS_OUTPUT_RULES}

${mode === 'fortune' ? fortuneRankInstruction[productRank] || fortuneRankInstruction.free : ''}
${mode === 'fortune' ? upsellInstruction[productRank] || upsellInstruction.free : ''}

${mode === 'fortune' ? '相談内容' : '元ネタ'}:
${sourceText}`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    const jsonText = jsonMatch ? jsonMatch[0] : cleaned
    const parsed = JSON.parse(jsonText)

    if (mode === 'fortune') {
      return res.status(200).setHeader(jsonHeaders).json({
        fortuneText: parsed.fortuneText ?? '',
        upsellText: parsed.upsellText ?? '',
      })
    }

    return res.status(200).setHeader(jsonHeaders).json({
      xPost: parsed.xPost ?? '',
      threadsPost: parsed.threadsPost ?? '',
    })
  } catch (error) {
    console.error('Gemini rewrite error:', error)
    return res.status(500).setHeader(jsonHeaders).json({
      error: 'Failed to rewrite text with Gemini',
      debug: {
        stage: 'generate_or_parse',
        envVarName: keyName,
        envPresent: Boolean(apiKey),
        model: MODEL_NAME,
        mode,
        productRank,
        message: error instanceof Error ? error.message : String(error),
        keyPreview: sanitizeKeyPreview(apiKey),
        ...getRuntimeDebug(),
      },
    })
  }
}
