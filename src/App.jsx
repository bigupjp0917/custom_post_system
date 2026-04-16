import { useEffect, useMemo, useRef, useState } from 'react'

function App() {
  const countChars = (text) => [...(text || '')].length
  const getDiffLabel = (count, min, max) => {
    if (count < min) return `-${min - count}（下限まで）`
    if (count > max) return `+${count - max}（上限超過）`
    return '0（目標レンジ内）'
  }
  const fortuneRanges = {
    free: { min: 260, max: 360, label: '260〜360文字' },
    ume: { min: 440, max: 580, label: '440〜580文字' },
    take: { min: 1350, max: 1700, label: '1350〜1700文字' },
    matsu: { min: 2000, max: 2600, label: '2000〜2600文字（目安）' },
  }
  const FORTUNE_METHOD_OPTIONS = [
    { key: 'tarot_major', label: 'タロット（大アルカナ）' },
    { key: 'western_astrology', label: '占星術' },
    { key: 'four_pillars', label: '四柱推命' },
    { key: 'numerology', label: '数秘術' },
    { key: 'animal_zodiac', label: '動物占い' },
  ]
  const BIRTH_YEARS = Array.from({ length: 101 }, (_, i) => String(1930 + i))
  const BIRTH_MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const BIRTH_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1))
  /** 既定のカスタムGPT（占い鑑定文メソッドGPTs） */
  const DEFAULT_CUSTOM_GPT_URL = 'https://chatgpt.com/g/g-oe1w8yED4'
  const normalizeProfile = (profile, index = 0) => ({
    id: profile?.id || crypto.randomUUID(),
    appraiserName: profile?.appraiserName || profile?.name || `占い師 ${index + 1}`,
    title: profile?.title || '波動リーディング専門家',
    characterSetting:
      profile?.characterSetting ||
      profile?.persona ||
      '丁寧で知的、少し含みのある語り口で魂に寄り添う。',
    trainingHistory:
      profile?.trainingHistory ||
      profile?.background ||
      '占術歴10年。国内外で精神世界の探究と実践を重ねている。',
    readingStyle:
      profile?.readingStyle ||
      profile?.divinationStyle ||
      '魂の波動にそっと手を添え、高次の領域からメッセージを受け取る。',
    firstPerson: profile?.firstPerson || '私',
    tone:
      profile?.tone || '〜ですね、〜なのです、を基調とした神秘的で落ち着いたトーン',
    ngWords: profile?.ngWords || '',
    specialtyApproach:
      profile?.specialtyApproach || '潜在意識のブロック解除、言霊による浄化',
    hashtags: profile?.hashtags || '#占い #運勢',
    worldview:
      profile?.worldview || '神秘的・ミステリアスで、深い癒やしと希望を灯す世界観',
  })

  const defaultProfiles = useMemo(
    () => [
      normalizeProfile(
        {
          appraiserName: '神秘の星詠み師',
          title: '魂の修復師',
          characterSetting:
            '丁寧、知的、少し含みのある口調。運命や星の流れを織り交ぜる。',
          trainingHistory:
            'タロット歴12年。北欧で象徴学と瞑想儀礼を学び、帰国後に個人鑑定を多数担当。',
          readingStyle:
            'タロットと波動共鳴を重ね、相談者の魂が望む未来を言語化する。',
          firstPerson: '私',
          tone: '〜ですね、〜なのです、を使う静かで奥行きある語り',
          specialtyApproach: '潜在意識のブロック解除、言霊ヒーリング',
          hashtags: '#運命 #星詠み #言葉の魔法',
          worldview: '濃紺の夜空と金色の導きが交差する神秘世界',
        },
        0,
      ),
    ],
    [],
  )

  const [profiles, setProfiles] = useState(defaultProfiles)
  const [selectedProfileId, setSelectedProfileId] = useState(defaultProfiles[0].id)
  const [activeTab, setActiveTab] = useState('main')
  const [mode, setMode] = useState('sns')
  const [isProfilePickerOpen, setIsProfilePickerOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [productRank, setProductRank] = useState('free')
  const [fortuneMethod, setFortuneMethod] = useState(() => {
    try {
      const saved = localStorage.getItem('fortuneMethod')
      if (saved && FORTUNE_METHOD_OPTIONS.some((m) => m.key === saved)) {
        return saved
      }
    } catch {
      /* ignore */
    }
    return 'tarot_major'
  })
  const [birthSelf, setBirthSelf] = useState({ year: '', month: '', day: '' })
  const [birthPartner, setBirthPartner] = useState({ year: '', month: '', day: '' })
  const [xPost, setXPost] = useState('')
  const [threadsPost, setThreadsPost] = useState('')
  const [fortuneText, setFortuneText] = useState('')
  const [upsellText, setUpsellText] = useState('')
  const [xImageUrl, setXImageUrl] = useState('')
  const [threadsImageUrl, setThreadsImageUrl] = useState('')
  const [isGeneratingXImage, setIsGeneratingXImage] = useState(false)
  const [isGeneratingThreadsImage, setIsGeneratingThreadsImage] = useState(false)
  const [isRewriting, setIsRewriting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [debugLog, setDebugLog] = useState('')
  const [copyToastVisible, setCopyToastVisible] = useState(false)
  const [fortuneCopyButtonDone, setFortuneCopyButtonDone] = useState(false)
  const [gptLinkCopyButtonDone, setGptLinkCopyButtonDone] = useState(false)
  const [gptOutputCopyButtonDone, setGptOutputCopyButtonDone] = useState(false)
  const [gptPastedOutput, setGptPastedOutput] = useState('')
  const [customGptUrl, setCustomGptUrl] = useState(() => {
    try {
      const saved = localStorage.getItem('customGptUrl')
      if (saved === null) {
        return DEFAULT_CUSTOM_GPT_URL
      }
      return saved
    } catch {
      return DEFAULT_CUSTOM_GPT_URL
    }
  })
  const copyToastTimerRef = useRef(null)
  const fortuneCopyButtonTimerRef = useRef(null)
  const gptLinkCopyButtonTimerRef = useRef(null)
  const gptOutputCopyButtonTimerRef = useRef(null)
  const combinedCopyButtonTimerRef = useRef(null)
  const importProfilesInputRef = useRef(null)
  const importDraftInputRef = useRef(null)
  const [combinedCopyButtonDone, setCombinedCopyButtonDone] = useState(false)

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId)
  const xCount = countChars(xPost)
  const threadsCount = countChars(threadsPost)
  const fortuneCount = countChars(fortuneText)
  const upsellCount = countChars(upsellText)
  const selectedFortuneRange = fortuneRanges[productRank] || fortuneRanges.free
  const selectedFortuneMethodLabel =
    FORTUNE_METHOD_OPTIONS.find((m) => m.key === fortuneMethod)?.label ?? 'タロット（大アルカナ）'

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fortuneDraft')
      if (!raw) return
      const draft = JSON.parse(raw)
      if (typeof draft?.activeTab === 'string') setActiveTab(draft.activeTab)
      if (typeof draft?.mode === 'string') setMode(draft.mode)
      if (typeof draft?.inputText === 'string') setInputText(draft.inputText)
      if (typeof draft?.productRank === 'string') setProductRank(draft.productRank)
      if (
        typeof draft?.fortuneMethod === 'string' &&
        FORTUNE_METHOD_OPTIONS.some((m) => m.key === draft.fortuneMethod)
      ) {
        setFortuneMethod(draft.fortuneMethod)
      }
      if (draft?.birthSelf && typeof draft.birthSelf === 'object') {
        setBirthSelf({
          year: typeof draft.birthSelf.year === 'string' ? draft.birthSelf.year : '',
          month: typeof draft.birthSelf.month === 'string' ? draft.birthSelf.month : '',
          day: typeof draft.birthSelf.day === 'string' ? draft.birthSelf.day : '',
        })
      }
      if (draft?.birthPartner && typeof draft.birthPartner === 'object') {
        setBirthPartner({
          year: typeof draft.birthPartner.year === 'string' ? draft.birthPartner.year : '',
          month: typeof draft.birthPartner.month === 'string' ? draft.birthPartner.month : '',
          day: typeof draft.birthPartner.day === 'string' ? draft.birthPartner.day : '',
        })
      }
      if (typeof draft?.xPost === 'string') setXPost(draft.xPost)
      if (typeof draft?.threadsPost === 'string') setThreadsPost(draft.threadsPost)
      if (typeof draft?.fortuneText === 'string') setFortuneText(draft.fortuneText)
      if (typeof draft?.upsellText === 'string') setUpsellText(draft.upsellText)
      if (typeof draft?.gptPastedOutput === 'string') setGptPastedOutput(draft.gptPastedOutput)
      if (typeof draft?.xImageUrl === 'string') setXImageUrl(draft.xImageUrl)
      if (typeof draft?.threadsImageUrl === 'string') setThreadsImageUrl(draft.threadsImageUrl)
    } catch (error) {
      console.error('failed to load draft', error)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        'fortuneDraft',
        JSON.stringify({
          activeTab,
          mode,
          inputText,
          productRank,
          fortuneMethod,
          birthSelf,
          birthPartner,
          xPost,
          threadsPost,
          fortuneText,
          upsellText,
          gptPastedOutput,
          xImageUrl,
          threadsImageUrl,
        }),
      )
    } catch {
      /* ignore */
    }
  }, [
    activeTab,
    mode,
    inputText,
    productRank,
    fortuneMethod,
    birthSelf,
    birthPartner,
    xPost,
    threadsPost,
    fortuneText,
    upsellText,
    gptPastedOutput,
    xImageUrl,
    threadsImageUrl,
  ])

  useEffect(() => {
    const raw = localStorage.getItem('fortuneProfiles')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length === 0) return
      const normalized = parsed.map((profile, index) => normalizeProfile(profile, index))
      setProfiles(normalized)
      setSelectedProfileId(normalized[0].id)
    } catch (error) {
      console.error('failed to load profiles', error)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('fortuneProfiles', JSON.stringify(profiles))
  }, [profiles])

  useEffect(() => {
    try {
      localStorage.setItem('fortuneMethod', fortuneMethod)
    } catch {
      /* ignore */
    }
  }, [fortuneMethod])

  useEffect(() => {
    try {
      localStorage.setItem('customGptUrl', customGptUrl)
    } catch {
      /* ignore */
    }
  }, [customGptUrl])

  const effectiveCustomGptUrl = (
    import.meta.env.VITE_CUSTOM_GPT_URL ||
    customGptUrl ||
    DEFAULT_CUSTOM_GPT_URL
  ).trim()

  const showCopyToast = () => {
    if (copyToastTimerRef.current) {
      clearTimeout(copyToastTimerRef.current)
    }
    setCopyToastVisible(true)
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToastVisible(false)
      copyToastTimerRef.current = null
    }, 2200)
  }

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) {
        clearTimeout(copyToastTimerRef.current)
      }
      if (fortuneCopyButtonTimerRef.current) {
        clearTimeout(fortuneCopyButtonTimerRef.current)
      }
      if (gptLinkCopyButtonTimerRef.current) {
        clearTimeout(gptLinkCopyButtonTimerRef.current)
      }
      if (gptOutputCopyButtonTimerRef.current) {
        clearTimeout(gptOutputCopyButtonTimerRef.current)
      }
      if (combinedCopyButtonTimerRef.current) {
        clearTimeout(combinedCopyButtonTimerRef.current)
      }
    }
  }, [])

  const updateProfile = (id, field, value) => {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === id ? { ...profile, [field]: value } : profile,
      ),
    )
  }

  const addProfile = () => {
    const profile = normalizeProfile({
      appraiserName: `新しい鑑定師 ${profiles.length + 1}`,
      title: '魂の案内人',
    })
    setProfiles((current) => [...current, profile])
    setSelectedProfileId(profile.id)
  }

  const deleteProfile = (id) => {
    if (profiles.length <= 1) return
    const nextProfiles = profiles.filter((profile) => profile.id !== id)
    setProfiles(nextProfiles)
    if (selectedProfileId === id) {
      setSelectedProfileId(nextProfiles[0].id)
    }
  }

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  const handleFortuneTextCopy = async () => {
    const text = fortuneText
    if (!text?.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      if (fortuneCopyButtonTimerRef.current) {
        clearTimeout(fortuneCopyButtonTimerRef.current)
      }
      showCopyToast()
      setFortuneCopyButtonDone(true)
      fortuneCopyButtonTimerRef.current = setTimeout(() => {
        setFortuneCopyButtonDone(false)
        fortuneCopyButtonTimerRef.current = null
      }, 1400)
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  const handleGptLinkCopy = async () => {
    const url = effectiveCustomGptUrl
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      if (gptLinkCopyButtonTimerRef.current) {
        clearTimeout(gptLinkCopyButtonTimerRef.current)
      }
      showCopyToast()
      setGptLinkCopyButtonDone(true)
      gptLinkCopyButtonTimerRef.current = setTimeout(() => {
        setGptLinkCopyButtonDone(false)
        gptLinkCopyButtonTimerRef.current = null
      }, 1400)
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  const handleGptOutputCopy = async () => {
    const text = gptPastedOutput
    if (!text?.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      if (gptOutputCopyButtonTimerRef.current) {
        clearTimeout(gptOutputCopyButtonTimerRef.current)
      }
      showCopyToast()
      setGptOutputCopyButtonDone(true)
      gptOutputCopyButtonTimerRef.current = setTimeout(() => {
        setGptOutputCopyButtonDone(false)
        gptOutputCopyButtonTimerRef.current = null
      }, 1400)
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  const handleCombinedFortuneCopy = async () => {
    const main = fortuneText?.trim() || ''
    const gpt = gptPastedOutput?.trim() || ''
    if (!main && !gpt) return
    const chunks = []
    if (main) {
      chunks.push(`【本アプリで生成した鑑定文】\n\n${main}`)
    }
    if (gpt) {
      chunks.push(`【ChatGPTの出力】\n\n${gpt}`)
    }
    const text = chunks.join('\n\n----------\n\n')
    try {
      await navigator.clipboard.writeText(text)
      if (combinedCopyButtonTimerRef.current) {
        clearTimeout(combinedCopyButtonTimerRef.current)
      }
      showCopyToast()
      setCombinedCopyButtonDone(true)
      combinedCopyButtonTimerRef.current = setTimeout(() => {
        setCombinedCopyButtonDone(false)
        combinedCopyButtonTimerRef.current = null
      }, 1400)
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  const handleExportProfiles = () => {
    const blob = new Blob([JSON.stringify(profiles, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `fortune-profiles-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleImportProfiles = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        window.alert('プロファイルの配列（1件以上）が必要です。')
        return
      }
      const normalized = parsed.map((item, index) => normalizeProfile(item, index))
      setProfiles(normalized)
      setSelectedProfileId(normalized[0].id)
    } catch (err) {
      console.error(err)
      window.alert('インポートに失敗しました。JSON形式を確認してください。')
    }
    event.target.value = ''
  }

  const handleExportDraft = () => {
    const draft = {
      activeTab,
      mode,
      inputText,
      productRank,
      fortuneMethod,
      birthSelf,
      birthPartner,
      xPost,
      threadsPost,
      fortuneText,
      upsellText,
      gptPastedOutput,
      xImageUrl,
      threadsImageUrl,
    }
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'latest.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleImportDraft = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const raw = await file.text()
      const draft = JSON.parse(raw)
      if (typeof draft?.activeTab === 'string') setActiveTab(draft.activeTab)
      if (typeof draft?.mode === 'string') setMode(draft.mode)
      if (typeof draft?.inputText === 'string') setInputText(draft.inputText)
      if (typeof draft?.productRank === 'string') setProductRank(draft.productRank)
      if (
        typeof draft?.fortuneMethod === 'string' &&
        FORTUNE_METHOD_OPTIONS.some((m) => m.key === draft.fortuneMethod)
      ) {
        setFortuneMethod(draft.fortuneMethod)
      }
      if (typeof draft?.xPost === 'string') setXPost(draft.xPost)
      if (typeof draft?.threadsPost === 'string') setThreadsPost(draft.threadsPost)
      if (typeof draft?.fortuneText === 'string') setFortuneText(draft.fortuneText)
      if (typeof draft?.upsellText === 'string') setUpsellText(draft.upsellText)
      if (typeof draft?.gptPastedOutput === 'string') setGptPastedOutput(draft.gptPastedOutput)
      if (typeof draft?.xImageUrl === 'string') setXImageUrl(draft.xImageUrl)
      if (typeof draft?.threadsImageUrl === 'string') setThreadsImageUrl(draft.threadsImageUrl)
      window.alert('下書きを読み込みました。')
    } catch (err) {
      console.error(err)
      window.alert('下書きの読み込みに失敗しました。JSON形式を確認してください。')
    }
    event.target.value = ''
  }

  const handleSaveImage = async (imageUrl, filename) => {
    if (!imageUrl) return
    const isThreads = filename.includes('threads')
    const targetRatio = isThreads ? 4 / 5 : 16 / 9

    const image = new Image()
    image.src = imageUrl
    await image.decode()

    const srcRatio = image.width / image.height
    let sx = 0
    let sy = 0
    let sw = image.width
    let sh = image.height

    if (srcRatio > targetRatio) {
      sw = Math.floor(image.height * targetRatio)
      sx = Math.floor((image.width - sw) / 2)
    } else {
      sh = Math.floor(image.width / targetRatio)
      sy = Math.floor((image.height - sh) / 2)
    }

    const outputWidth = isThreads ? 1080 : 1280
    const outputHeight = Math.round(outputWidth / targetRatio)
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight)

    const finalDataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = finalDataUrl
    link.download = filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const generateImage = async (platform, text) => {
    if (!selectedProfile || !text.trim()) return
    const setLoading = platform === 'x' ? setIsGeneratingXImage : setIsGeneratingThreadsImage
    const setImage = platform === 'x' ? setXImageUrl : setThreadsImageUrl
    setLoading(true)
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          sourceText: text,
          profile: selectedProfile,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const detail = data?.debug
          ? JSON.stringify(data.debug, null, 2)
          : data?.error || response.statusText
        throw new Error(
          `${data?.error || 'Image generation failed'}\n${detail}`,
        )
      }
      setImage(data.imageDataUrl || '')
    } catch (error) {
      console.error(error)
      setErrorMessage('画像生成に失敗しました。詳細ログを確認してください。')
      setDebugLog(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const handleRewrite = async () => {
    if (!selectedProfile || !inputText.trim()) {
      setErrorMessage(
        mode === 'sns'
          ? '元ネタのテキストを入力してください。'
          : '鑑定したい相談内容を入力してください。',
      )
      return
    }

    setErrorMessage('')
    setDebugLog('')
    setIsRewriting(true)

    try {
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          sourceText: inputText,
          profile: selectedProfile,
          productRank,
          ...(mode === 'fortune'
            ? {
                fortuneMethod,
                birth: {
                  self: birthSelf,
                  partner: birthPartner,
                },
              }
            : {}),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        const detailText = data?.debug
          ? JSON.stringify(data.debug, null, 2)
          : data?.error || 'unknown error'
        throw new Error(`${data?.error || 'Rewrite request failed'}\n${detailText}`)
      }

      if (mode === 'sns') {
        const nextX = data.xPost || ''
        const nextThreads = data.threadsPost || ''
        setXPost(nextX)
        setThreadsPost(nextThreads)
        setFortuneText('')
        setUpsellText('')
        setXImageUrl('')
        setThreadsImageUrl('')
        await Promise.all([generateImage('x', nextX), generateImage('threads', nextThreads)])
      } else {
        setFortuneText(data.fortuneText || '')
        setUpsellText(data.upsellText || '')
        setXPost('')
        setThreadsPost('')
      }
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error ? error.message : '不明なエラーが発生しました。'
      setErrorMessage('リライトに失敗しました。詳細ログを確認してください。')
      setDebugLog(message)
    } finally {
      setIsRewriting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#090f2b] via-[#0f1c46] to-[#060a1a] text-[#f6e7b3]">
      <div className="mx-auto max-w-6xl p-3 md:p-6">
        <header className="sticky top-0 z-20 rounded-2xl border border-[#8d7a3f]/30 bg-[#090f2b]/90 p-3 backdrop-blur md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-base font-semibold tracking-wide text-[#f8d77c] md:text-xl">
              SNS Fortune Rewrite Tool
            </h1>
            <button
              type="button"
              onClick={() => setIsProfilePickerOpen(true)}
              className="rounded-full border border-[#8d7a3f]/60 bg-[#121f4f] px-4 py-1 text-sm text-[#f8d77c]"
            >
              使用中: {selectedProfile?.appraiserName || '未選択'}
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('main')}
              className={`rounded-lg px-3 py-2 text-sm ${
                activeTab === 'main'
                  ? 'bg-[#f8d77c] text-[#1a1a1a]'
                  : 'border border-[#8d7a3f]/40 text-[#e2d2a7]'
              }`}
            >
              生成
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`rounded-lg px-3 py-2 text-sm ${
                activeTab === 'settings'
                  ? 'bg-[#f8d77c] text-[#1a1a1a]'
                  : 'border border-[#8d7a3f]/40 text-[#e2d2a7]'
              }`}
            >
              設定
            </button>
          </div>
        </header>

        {isProfilePickerOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 p-4">
            <div className="mx-auto mt-14 max-w-md rounded-2xl border border-[#8d7a3f]/40 bg-[#0a1433] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-[#f8d77c]">アカウント切り替え</h2>
                <button
                  type="button"
                  onClick={() => setIsProfilePickerOpen(false)}
                  className="rounded border border-[#8d7a3f]/50 px-2 py-1 text-xs"
                >
                  閉じる
                </button>
              </div>
              <div className="space-y-2">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      setSelectedProfileId(profile.id)
                      setIsProfilePickerOpen(false)
                    }}
                    className={`w-full rounded-xl border p-3 text-left text-sm ${
                      selectedProfileId === profile.id
                        ? 'border-[#f8d77c] bg-[#1a2e69]'
                        : 'border-[#7e6a2f]/50 bg-[#101d46]'
                    }`}
                  >
                    <p className="font-semibold text-[#f8d77c]">{profile.appraiserName}</p>
                    <p className="mt-1 text-xs text-[#dcc995]">{profile.title}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' ? (
          <section className="mt-4 space-y-4">
            <article className="rounded-2xl border border-[#8d7a3f]/35 bg-[#0f1d46]/70 p-5">
              <h2 className="font-semibold text-[#f8d77c]">キャラクター設定の同期（スマホ／PC）</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#d9caa0]">
                ブラウザの保存（localStorage）は<strong className="text-[#f4e2b1]">端末ごと</strong>
                に別々です。PCで編集した内容をスマホでも同じにしたい場合は、PCで
                「エクスポート」→ ファイルをスマホに送る → スマホで「インポート」を選んでください。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportProfiles}
                  className="rounded-lg border border-[#8d7a3f]/60 bg-[#121f4f] px-3 py-2 text-xs text-[#f8d77c]"
                >
                  プロファイルをエクスポート
                </button>
                <button
                  type="button"
                  onClick={() => importProfilesInputRef.current?.click()}
                  className="rounded-lg border border-[#8d7a3f]/60 bg-[#121f4f] px-3 py-2 text-xs text-[#f8d77c]"
                >
                  プロファイルをインポート
                </button>
                <input
                  ref={importProfilesInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportProfiles}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#cbb886]">
                Finderで見える保存先に置きたい場合は、下の「下書きをエクスポート」でJSONを書き出して、
                保存ダイアログで `AI` フォルダを選択してください。
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportDraft}
                  className="rounded-lg border border-[#6f87cc]/60 bg-[#101e4a] px-3 py-2 text-xs text-[#d7e4ff]"
                >
                  下書きをエクスポート（AIフォルダ用）
                </button>
                <button
                  type="button"
                  onClick={() => importDraftInputRef.current?.click()}
                  className="rounded-lg border border-[#6f87cc]/60 bg-[#101e4a] px-3 py-2 text-xs text-[#d7e4ff]"
                >
                  下書きをインポート
                </button>
                <input
                  ref={importDraftInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportDraft}
                />
              </div>
            </article>
            <article className="rounded-2xl border border-[#8d7a3f]/35 bg-[#0f1d46]/70 p-5">
              <h2 className="font-semibold text-[#f8d77c]">ChatGPT カスタムGPT</h2>
              <p className="mt-2 text-xs text-[#d9caa0]">
                本格鑑定の「鑑定結果」の上に表示するボタン用のURLです。初期値は「占い鑑定文メソッドGPTs」（{' '}
                <span className="break-all text-[#cbb886]">{DEFAULT_CUSTOM_GPT_URL}</span>
                ）。ビルド時に{' '}
                <code className="rounded bg-[#0b1839] px-1 text-[#e8d89a]">VITE_CUSTOM_GPT_URL</code>{' '}
                を設定している場合はそちらが最優先されます。
              </p>
              <label className="mt-3 block text-xs text-[#d9caa0]">カスタムGPTのURL</label>
              <input
                type="url"
                value={customGptUrl}
                onChange={(event) => setCustomGptUrl(event.target.value)}
                placeholder={DEFAULT_CUSTOM_GPT_URL}
                className="mt-1 w-full rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm outline-none placeholder:text-[#7a6e4a] focus:border-[#f8d77c]"
              />
            </article>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addProfile}
                className="rounded-lg bg-gradient-to-r from-[#d9b862] to-[#f8d77c] px-4 py-2 text-sm font-semibold text-[#1a1a1a]"
              >
                プロファイル追加
              </button>
            </div>
            {profiles.map((profile) => (
              <article
                key={profile.id}
                className="rounded-2xl border border-[#8d7a3f]/35 bg-[#0f1d46]/70 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold text-[#f8d77c]">{profile.appraiserName}</p>
                  <button
                    type="button"
                    onClick={() => deleteProfile(profile.id)}
                    disabled={profiles.length === 1}
                    className="rounded border border-[#c98282]/50 px-2 py-1 text-xs text-[#ffc2c2] disabled:opacity-40"
                  >
                    削除
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs text-[#d9caa0] md:col-span-2">鑑定師名</label>
                  <input
                    value={profile.appraiserName}
                    onChange={(event) =>
                      updateProfile(profile.id, 'appraiserName', event.target.value)
                    }
                    className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm md:col-span-2"
                  />
                  <label className="text-xs text-[#d9caa0] md:col-span-2">肩書き</label>
                  <input
                    value={profile.title}
                    onChange={(event) => updateProfile(profile.id, 'title', event.target.value)}
                    className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm md:col-span-2"
                  />
                  <label className="text-xs text-[#d9caa0] md:col-span-2">キャラクター設定（口調・性格・世界観）</label>
                  <textarea
                    value={profile.characterSetting}
                    onChange={(event) =>
                      updateProfile(profile.id, 'characterSetting', event.target.value)
                    }
                    rows={3}
                    className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm md:col-span-2"
                  />
                  <label className="text-xs text-[#d9caa0] md:col-span-2">修行・経歴</label>
                  <input
                    value={profile.trainingHistory}
                    onChange={(event) =>
                      updateProfile(profile.id, 'trainingHistory', event.target.value)
                    }
                    className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm md:col-span-2"
                  />
                  <label className="text-xs text-[#d9caa0] md:col-span-2">鑑定スタイル</label>
                  <input
                    value={profile.readingStyle}
                    onChange={(event) =>
                      updateProfile(profile.id, 'readingStyle', event.target.value)
                    }
                    className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm md:col-span-2"
                  />
                  <label className="text-xs text-[#d9caa0]">一人称</label>
                  <label className="text-xs text-[#d9caa0]">語尾・トーン</label>
                  <input
                    value={profile.firstPerson}
                    onChange={(event) =>
                      updateProfile(profile.id, 'firstPerson', event.target.value)
                    }
                    className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm"
                  />
                  <input
                    value={profile.tone}
                    onChange={(event) => updateProfile(profile.id, 'tone', event.target.value)}
                    className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm"
                  />
                  <label className="text-xs text-[#d9caa0] md:col-span-2">NGワード・表現</label>
                  <input
                    value={profile.ngWords}
                    onChange={(event) => updateProfile(profile.id, 'ngWords', event.target.value)}
                    className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm md:col-span-2"
                  />
                  <label className="text-xs text-[#d9caa0] md:col-span-2">得意なアプローチ</label>
                  <input
                    value={profile.specialtyApproach}
                    onChange={(event) =>
                      updateProfile(profile.id, 'specialtyApproach', event.target.value)
                    }
                    className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm md:col-span-2"
                  />
                  <label className="text-xs text-[#d9caa0] md:col-span-2">ハッシュタグ</label>
                  <input
                    value={profile.hashtags}
                    onChange={(event) => updateProfile(profile.id, 'hashtags', event.target.value)}
                    className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-3 py-2 text-sm md:col-span-2"
                  />
                </div>
              </article>
            ))}
          </section>
        ) : (
          <main className="mt-4 space-y-4">
            <section className="rounded-2xl border border-[#8d7a3f]/35 bg-[#0f1d46]/70 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.35)] md:p-7">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMode('sns')}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    mode === 'sns'
                      ? 'bg-[#f8d77c] text-[#1a1a1a]'
                      : 'border border-[#8d7a3f]/50'
                  }`}
                >
                  SNSリライト
                </button>
                <button
                  type="button"
                  onClick={() => setMode('fortune')}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    mode === 'fortune'
                      ? 'bg-[#f8d77c] text-[#1a1a1a]'
                      : 'border border-[#8d7a3f]/50'
                  }`}
                >
                  本格鑑定
                </button>
              </div>
              {mode === 'fortune' && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-[#d9caa0]">商品ランク</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'free', label: '無料 / 300字' },
                      { key: 'ume', label: '梅 / 500字' },
                      { key: 'take', label: '竹 / 1500字' },
                      { key: 'matsu', label: '松 / 2000字+' },
                    ].map((rank) => (
                      <button
                        key={rank.key}
                        type="button"
                        onClick={() => setProductRank(rank.key)}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          productRank === rank.key
                            ? 'bg-[#d9b862] text-[#1a1a1a]'
                            : 'border border-[#8d7a3f]/50'
                        }`}
                      >
                        {rank.label}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 mt-4 text-xs text-[#d9caa0]">占術（本格鑑定の出力に反映）</p>
                  <div className="flex flex-wrap gap-2">
                    {FORTUNE_METHOD_OPTIONS.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setFortuneMethod(m.key)}
                        className={`rounded-lg px-3 py-2 text-xs md:text-sm ${
                          fortuneMethod === m.key
                            ? 'bg-[#c9a84a] text-[#1a1a1a]'
                            : 'border border-[#8d7a3f]/50'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 mt-4 text-xs text-[#d9caa0]">生年月日（任意 / 鑑定に反映）</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[#8d7a3f]/35 bg-[#0b1839] p-3">
                      <p className="text-xs font-semibold text-[#f8d77c]">本人</p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <select
                          value={birthSelf.year}
                          onChange={(e) =>
                            setBirthSelf((v) => ({ ...v, year: e.target.value, day: v.day }))
                          }
                          className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-2 py-2 text-xs outline-none focus:border-[#f8d77c]"
                        >
                          <option value="">年</option>
                          {BIRTH_YEARS.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                        <select
                          value={birthSelf.month}
                          onChange={(e) =>
                            setBirthSelf((v) => ({ ...v, month: e.target.value, day: v.day }))
                          }
                          className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-2 py-2 text-xs outline-none focus:border-[#f8d77c]"
                        >
                          <option value="">月</option>
                          {BIRTH_MONTHS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <select
                          value={birthSelf.day}
                          onChange={(e) => setBirthSelf((v) => ({ ...v, day: e.target.value }))}
                          className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-2 py-2 text-xs outline-none focus:border-[#f8d77c]"
                        >
                          <option value="">日</option>
                          {BIRTH_DAYS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#8d7a3f]/35 bg-[#0b1839] p-3">
                      <p className="text-xs font-semibold text-[#f8d77c]">お相手</p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <select
                          value={birthPartner.year}
                          onChange={(e) =>
                            setBirthPartner((v) => ({ ...v, year: e.target.value, day: v.day }))
                          }
                          className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-2 py-2 text-xs outline-none focus:border-[#f8d77c]"
                        >
                          <option value="">年</option>
                          {BIRTH_YEARS.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                        <select
                          value={birthPartner.month}
                          onChange={(e) =>
                            setBirthPartner((v) => ({ ...v, month: e.target.value, day: v.day }))
                          }
                          className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-2 py-2 text-xs outline-none focus:border-[#f8d77c]"
                        >
                          <option value="">月</option>
                          {BIRTH_MONTHS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <select
                          value={birthPartner.day}
                          onChange={(e) =>
                            setBirthPartner((v) => ({ ...v, day: e.target.value }))
                          }
                          className="rounded-lg border border-[#8d7a3f]/40 bg-[#0c183a] px-2 py-2 text-xs outline-none focus:border-[#f8d77c]"
                        >
                          <option value="">日</option>
                          {BIRTH_DAYS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <p className="mt-3 text-sm text-[#d9caa0]">
                {mode === 'sns'
                  ? '元ネタを投稿向けに変換します。'
                  : '相談内容から、心に響く長文鑑定を生成します。'}
              </p>
              <textarea
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                rows={8}
                placeholder={
                  mode === 'sns'
                    ? 'ここに元ネタ（バズ投稿など）を入力'
                    : 'ここに相談内容を入力（恋愛、仕事、人間関係など）'
                }
                className="mt-4 w-full rounded-xl border border-[#8d7a3f]/40 bg-[#0b1839] p-4 text-sm outline-none placeholder:text-[#a89464] focus:border-[#f8d77c]"
              />
              <button
                type="button"
                onClick={handleRewrite}
                disabled={isRewriting}
                className="mt-4 rounded-xl bg-gradient-to-r from-[#d9b862] to-[#f8d77c] px-5 py-3 text-sm font-semibold text-[#141414] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isRewriting ? '星の動きを読み取っています...' : '生成する'}
              </button>
              {errorMessage && (
                <div className="mt-3 rounded-lg border border-[#cf8f8f]/40 bg-[#3b1f2b]/40 p-3">
                  <p className="text-sm text-[#ffb7b7]">{errorMessage}</p>
                  <p className="mt-1 text-xs text-[#ffd6d6]">
                    APIキーは Vercel の環境変数（例: GEMINI_API_KEY）から、`api/rewrite.js` および
                    `api/generate-image.js` で読み込みます。
                  </p>
                  {debugLog && (
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-[#ffe9e9]">
                      {debugLog}
                    </pre>
                  )}
                </div>
              )}
            </section>

            {mode === 'sns' ? (
              <section className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-[#8d7a3f]/35 bg-[#0f1d46]/70 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[#f8d77c]">X向け</h3>
                    <button
                      type="button"
                      onClick={() => handleCopy(xPost)}
                      className="rounded-lg border border-[#8d7a3f]/60 px-3 py-1 text-xs"
                    >
                      コピー
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[#cbb886]">
                    実文字数: {xCount} / 目標: 0〜140 / 差分: {getDiffLabel(xCount, 0, 140)}
                  </p>
                  <pre className="mt-3 min-h-44 whitespace-pre-wrap rounded-xl border border-[#8d7a3f]/30 bg-[#0b1839] p-4 text-sm">
                    {xPost || '生成後に表示されます。'}
                  </pre>
                  <div className="mt-3 rounded-xl border border-[#8d7a3f]/30 bg-[#0b1839] p-3">
                    {xImageUrl ? (
                      <div className="overflow-hidden rounded-lg" style={{ aspectRatio: '16 / 9' }}>
                        <img
                          src={xImageUrl}
                          alt="X向け開運画像"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-[#d0be8f]">画像生成後に表示されます。</p>
                    )}
                    <button
                      type="button"
                      onClick={() => (xImageUrl ? handleSaveImage(xImageUrl, 'x-fortune.png') : null)}
                      disabled={!xImageUrl || isGeneratingXImage}
                      className="mt-3 w-full rounded-lg border border-[#8d7a3f]/60 px-3 py-2 text-xs disabled:opacity-50"
                    >
                      {isGeneratingXImage
                        ? '星の光を画像に込めています...'
                        : '画像を保存'}
                    </button>
                  </div>
                </article>
                <article className="rounded-2xl border border-[#8d7a3f]/35 bg-[#0f1d46]/70 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[#f8d77c]">Threads向け</h3>
                    <button
                      type="button"
                      onClick={() => handleCopy(threadsPost)}
                      className="rounded-lg border border-[#8d7a3f]/60 px-3 py-1 text-xs"
                    >
                      コピー
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[#cbb886]">
                    実文字数: {threadsCount} / 目標: 450〜520 / 差分:{' '}
                    {getDiffLabel(threadsCount, 450, 520)}
                  </p>
                  <pre className="mt-3 min-h-44 whitespace-pre-wrap rounded-xl border border-[#8d7a3f]/30 bg-[#0b1839] p-4 text-sm">
                    {threadsPost || '生成後に表示されます。'}
                  </pre>
                  <div className="mt-3 rounded-xl border border-[#8d7a3f]/30 bg-[#0b1839] p-3">
                    {threadsImageUrl ? (
                      <div className="overflow-hidden rounded-lg" style={{ aspectRatio: '4 / 5' }}>
                        <img
                          src={threadsImageUrl}
                          alt="Threads向け開運画像"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-[#d0be8f]">画像生成後に表示されます。</p>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        threadsImageUrl
                          ? handleSaveImage(threadsImageUrl, 'threads-fortune.png')
                          : null
                      }
                      disabled={!threadsImageUrl || isGeneratingThreadsImage}
                      className="mt-3 w-full rounded-lg border border-[#8d7a3f]/60 px-3 py-2 text-xs disabled:opacity-50"
                    >
                      {isGeneratingThreadsImage
                        ? '星の光を画像に込めています...'
                        : '画像を保存'}
                    </button>
                  </div>
                </article>
              </section>
            ) : (
              <>
                <section className="rounded-2xl border border-[#8d7a3f]/35 bg-[#0f1d46]/70 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.2)]">
                  <h3 className="font-semibold text-[#f8d77c]">ChatGPT（カスタムGPT）</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#d9caa0]">
                    このページ内には埋め込めないため、下のボタンで GPT を別タブで開いてください。
                    <strong className="text-[#f4e2b1]"> GPT の返答は「鑑定結果」内の取り込み欄に貼り付け</strong>
                    ます（コールドリーディングなどは GPT 側で行う想定です）。
                  </p>
                  {effectiveCustomGptUrl ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <a
                        href={effectiveCustomGptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg bg-gradient-to-r from-[#d9b862] to-[#f8d77c] px-4 py-2 text-sm font-semibold text-[#141414] transition hover:brightness-105"
                      >
                        カスタムGPTを開く
                      </a>
                      <button
                        type="button"
                        onClick={handleGptLinkCopy}
                        className="min-w-[4.5rem] rounded-lg border border-[#8d7a3f]/60 px-3 py-2 text-xs transition-colors"
                      >
                        {gptLinkCopyButtonDone ? 'コピー完了' : 'リンクをコピー'}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-[#cbb886]">
                      「設定」タブでカスタムGPTのURLを登録するか、ビルド時に{' '}
                      <code className="rounded bg-[#0b1839] px-1">VITE_CUSTOM_GPT_URL</code>{' '}
                      を指定してください。
                    </p>
                  )}
                </section>
                <section className="rounded-2xl border border-[#8d7a3f]/35 bg-[#0f1d46]/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-[#f8d77c]">鑑定結果</h3>
                      <p className="mt-1 text-xs text-[#b8a66a]">占術: {selectedFortuneMethodLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleFortuneTextCopy}
                      className="min-w-[4.5rem] rounded-lg border border-[#8d7a3f]/60 px-3 py-1 text-xs transition-colors"
                    >
                      {fortuneCopyButtonDone ? 'コピー完了' : 'コピー'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[#cbb886]">
                    実文字数: {fortuneCount} / 目標: {selectedFortuneRange.label} / 差分:{' '}
                    {getDiffLabel(
                      fortuneCount,
                      selectedFortuneRange.min,
                      selectedFortuneRange.max,
                    )}
                  </p>
                  <pre className="mt-3 min-h-72 whitespace-pre-wrap rounded-xl border border-[#8d7a3f]/30 bg-[#0b1839] p-4 text-sm">
                    {fortuneText || '生成後に鑑定文が表示されます。'}
                  </pre>
                  {productRank !== 'matsu' && (
                    <div className="mt-4 rounded-xl border border-[#b8974c]/45 bg-[#101b40] p-4">
                      <p className="text-xs tracking-wide text-[#cdb173]">上位ランクへの提案</p>
                      <p className="mt-1 text-xs text-[#cbb886]">実文字数: {upsellCount}</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm text-[#f4e2b1]">
                        {upsellText || '生成後にアップセル提案文が表示されます。'}
                      </pre>
                    </div>
                  )}
                  <div className="mt-6 rounded-xl border border-[#5a6a9a]/50 bg-[#0c1530] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold tracking-wide text-[#a8b8e8]">
                        ChatGPTの出力（鑑定結果への取り込み）
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleGptOutputCopy}
                          disabled={!gptPastedOutput.trim()}
                          className="min-w-[4.5rem] rounded-lg border border-[#8d7a3f]/60 px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {gptOutputCopyButtonDone ? 'コピー完了' : 'GPTだけコピー'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCombinedFortuneCopy}
                          disabled={!fortuneText.trim() && !gptPastedOutput.trim()}
                          className="min-w-[4.5rem] rounded-lg border border-[#d9b862]/60 bg-[#1a2448] px-3 py-1 text-xs text-[#f8d77c] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {combinedCopyButtonDone ? 'コピー完了' : '鑑定＋GPTをまとめてコピー'}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={gptPastedOutput}
                      onChange={(event) => setGptPastedOutput(event.target.value)}
                      rows={8}
                      placeholder="ChatGPT の返答をここに貼り付け・編集します。"
                      className="mt-3 w-full rounded-xl border border-[#8d7a3f]/40 bg-[#0b1839] p-3 text-sm outline-none placeholder:text-[#7a6e4a] focus:border-[#f8d77c]"
                    />
                  </div>
                </section>
              </>
            )}
          </main>
        )}
      </div>
      {copyToastVisible && (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[#d9b862]/50 bg-[#1a1530]/95 px-4 py-2 text-xs font-medium text-[#f8d77c] shadow-lg shadow-black/40 backdrop-blur-sm"
          role="status"
        >
          コピーしました！
        </div>
      )}
    </div>
  )
}

export default App
