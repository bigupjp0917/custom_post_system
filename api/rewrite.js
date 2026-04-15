import { GoogleGenerativeAI } from '@google/generative-ai'

// gemini-1.5-* は Developer API 側で利用不可・404 になることがあるため 2.5 を使用
const MODEL_NAME = 'gemini-2.5-flash'

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
- JSON以外を絶対に出力しない。
- fortuneText には読みやすい改行を必ず入れる（1〜2文ごとに改行、段落の間は空行1行）。プレーンな長文1塊は禁止。`

/** 理想サンプルから抽出した「最高品質」鑑定の文体・構成規範（内容は毎回オリジナルに作る） */
const FORTUNE_MASTER_STYLE_PROMPT = `【鑑定文の品質基準・マスタースタイル】
相談内容に沿って内容はすべて創作するが、次のトーン・改行・語尾・共感の深さは理想サンプルと同等のクラスに揃えること。

■トーン
- 相談者には「あなた様」。謙譲・丁寧語（「〜させて頂きました」「〜させていただきます」「お伝えさせていただきます」）を軸に、温かく包む。
- 鑑定師の一人称はキャラ設定に従う。締めに、労いと感想依頼・祈りを柔らかく添えてよい。
- 光・魂・縁・波動・希望・羅針盤などの語を自然に織り交ぜる。説教や押し付けは避ける。

■改行・リズム（最重要）
- 1文〜短い2文ごとに改行する。段落と段落の間には空行を1行入れる。
- 「労い → 本鑑定の宣言 → 具体パート → 慰め・希望」など感情の切り替わりの直前でも改行する。
- 壁のような長段落を作らない。読み上げたときに呼吸が整うリズムを優先する。

■語尾・言い回し
- 「〜のです」「〜ようです」「〜でしょう」「〜と思います」で霊視・解釈を柔らかく示す。
- 「どうか〜してください」「〜願います」「〜幸いです」で締めくくる。
- 共感は「〜だったと思います」「本当によく頑張ってきましたね」のように、事実を言い切りすぎず寄り添う。

■共感の示し方
- 冒頭: 依頼への感謝に加え、「勇気のいる決断」「踏み出した行動」を具体的に称える。
- 中盤: 相談者の苦しみ・迷い・待ちを言語化し、否定せず受け止める。
- 希望へつなぐときは、閉ざされていない未来・光・導きなどで橋を架ける。
- 第三者（お相手様など）がいる場合は、優しさと怖れ・葛藤の両面を描写し、単純化しすぎない。

■見出しと構成（鑑定本文は【】全角括弧の見出しで区切る。Markdownの###や---は使わない）
- 冒頭ブロック: 感謝、全身全霊で鑑定した旨、相談文から読み取れる願い・想いの受け止め。
- 本編: 相談種別に応じた複数セクション。恋愛例: 【お相手様の性格と恋愛観】【お相手様の魂の奥底に眠る想い】【あなた様へのメッセージ】。恋愛以外は内容に合わせて【】見出しを付け替える（例: 【いま視えているエネルギー】【ブロックの正体】【進むべき一歩】）。
- 竹・松ランクでは:【二人の愛を深める特別な儀式】または【魂を整える特別なワーク】など、香・浄化・呼吸・イメージ・唱え・月や光など、手順が追える具体ステップを丁寧に書く（実在ブランドや商品名の押し売りはしない）。
- 結び:「鑑定結果は以上」に相当する締め、感想を送ってほしい一言、祈り・お守りのような一文。

■禁止
- ユーザーが提供したサンプル文や第三者の鑑定をコピー・転載しない。相談内容とキャラ設定から毎回ゼロから書く。
- 相談文にない具体年・固有名・固有情境を捏造して断定しない。`

const SALES_STRUCTURE_PROMPT = `以下は「売れる鑑定導線」の骨組みです。文体ではなく構成アルゴリズムとして使ってください。
- 無料当選の特別感（選ばれた感覚）を最初に与える
- 魂の波動・潜在意識へアクセスした描写で期待感を高める
- 核心を示しつつ「最後の1ピース不足」を提示する
- 期限（24時間/48時間）を用いた緊迫感と行動喚起を入れる
- 追いメッセージでは「再度波動を合わせたら魂の声が聞こえた」流れを採用する

重要:
- 「ナナ」など固有名詞や、資料内の特定エピソードを流用しない
- 必ずユーザー指定のキャラ背景・占術・口調に置換する`

/** Single-line token safe for Authorization-style headers (no CR/LF or stray whitespace). */
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

  const fortuneTemplateInstruction = `口調テンプレート（鑑定モード・マスタースタイル準拠）:
- 敬語強度: 最高品位。「あなた様」、謙譲語多め（「〜させて頂きました」等）。キャラの一人称・語尾設定も必ず守る。
- 比喩量: ${metaphorMap.high}
- 絵文字: 使わない（理想サンプルに合わせる）`

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
- 文字数は300文字前後（260〜360文字）に厳格化する。マスタースタイル（あなた様・改行・共感の深さ・【】見出し）は無料でも必ず守る。
- 無料鑑定当選の特別感と、24時間以内に魂へアクセスした緊迫感を入れる。
- 核心に触れつつ、さらなる解決には上位ランクが有効であることを神秘的に示す。
- 【】見出しは2つ程度（例:【いま視えている本質】【あなた様へのメッセージ】）。儀式パートは1〜2行のミニワークでよい。`,
    ume: `商品ランク: 梅（ライト）
- 文字数は500文字前後（440〜580文字）に厳格化する。
- 要点整理と即実践の助言を明確に。短くまとめすぎず、マスタースタイルの改行リズムは維持。
- 【】見出しを3つ前後（例:【現状の読み解き】【いま魂が伝えたいこと】【すぐにできる一歩】）。儀式は簡易版でよい。`,
    take: `商品ランク: 竹（スタンダード）
- 文字数は1500文字前後（1350〜1700文字）に厳格化する。
- 短く要約しない。具体描写・内面の葛藤・情景を十分に書き、相談者の心に深く寄り添う。
- 【】見出しで本編を複数章立てする（恋愛なら性格・魂の奥・メッセージ等、相談に合わせて付け替え）。
- 【特別な儀式】または【魂を整えるワーク】を、手順が追える具体性で必ず入れる（香・浄化・イメージ・唱え・月や光など）。`,
    matsu: `商品ランク: 松（プレミアム）
- 文字数は2000文字以上（最低2000文字、推奨2200文字前後）に厳格化する。
- 一生モノの鑑定書として、霊視の深さ・癒やし・希望を余さず書く。改行と空行で読みやすさを最優先。
- 【】見出しで章立て（例:【魂の共鳴】【深層霊視と癒やし】【3ヶ月の運勢バイオリズム】【人生航路の羅針盤】など、相談に合わせ調整）。
- 【特別な儀式】を理想サンプル級の手順の細かさで記述する。
- 直近3ヶ月のバイオリズムを月ごとに具体的に書く（【】見出しの下に展開）。`,
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
    // Initialize only after strict validation above; never pass CR/LF or non-token chars to the client.
    const httpSafeKey = toHttpSafeApiKeyToken(apiKey)
    const genAI = new GoogleGenerativeAI(httpSafeKey)
    const systemInstruction =
      mode === 'fortune'
        ? `${BASE_SYSTEM_PROMPT}

${FORTUNE_MASTER_STYLE_PROMPT}

${SALES_STRUCTURE_PROMPT}
${characterPriorityInstruction}

キャラ名: ${profile?.appraiserName || '神秘的な占い師'}
キャラ設定: ${profile?.characterSetting || '丁寧、知的、少し含みのある口調。'}
SNS向けハッシュタグ候補: ${profile?.hashtags || '#占い #運勢'}
${fortuneTemplateInstruction}`
        : `${BASE_SYSTEM_PROMPT}

${SALES_STRUCTURE_PROMPT}
${characterPriorityInstruction}

キャラ名: ${profile?.appraiserName || '神秘的な占い師'}
キャラ設定: ${profile?.characterSetting || '丁寧、知的、少し含みのある口調。'}
SNS向けハッシュタグ候補: ${profile?.hashtags || '#占い #運勢'}
${templateInstruction}`

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction,
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
      return res
        .status(200)
        .setHeader('Content-Type', 'application/json')
        .json({
          fortuneText: parsed.fortuneText ?? '',
          upsellText: parsed.upsellText ?? '',
        })
    }

    return res.status(200).setHeader('Content-Type', 'application/json').json({
      xPost: parsed.xPost ?? '',
      threadsPost: parsed.threadsPost ?? '',
    })
  } catch (error) {
    console.error('Gemini rewrite error:', error)
    return res.status(500).setHeader('Content-Type', 'application/json').json({
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
