export type Language = 'zh' | 'en'

const QUERY_KEYS = ['lang', 'language', 'locale']

export function normalizeLanguage(value: string | null | undefined): Language | null {
  if (!value) return null
  const normalized = value.toLowerCase()
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh'
  if (normalized === 'cn' || normalized === 'zh_cn' || normalized === 'zh-hans') return 'zh'
  return null
}

export function getLanguageFromUrl(): Language | null {
  const searchParams = new URLSearchParams(window.location.search)
  for (const key of QUERY_KEYS) {
    const language = normalizeLanguage(searchParams.get(key))
    if (language) return language
  }

  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0]
  return normalizeLanguage(firstSegment)
}

export function getStoredLanguage(): Language | null {
  const legacy = normalizeLanguage(localStorage.getItem('ui-language'))
  if (legacy) return legacy

  try {
    const stored = JSON.parse(localStorage.getItem('ui-settings') ?? '{}')
    return normalizeLanguage(stored?.state?.language)
  } catch {
    return null
  }
}

export function getBrowserLanguage(): Language | null {
  for (const lang of navigator.languages ?? [navigator.language]) {
    const normalized = normalizeLanguage(lang)
    if (normalized) return normalized
  }
  return null
}

export function getInitialLanguage(): Language {
  return getLanguageFromUrl() ?? getStoredLanguage() ?? getBrowserLanguage() ?? 'zh'
}

export function persistLanguage(language: Language) {
  localStorage.setItem('ui-language', language)
}

export function syncUrlLanguage(language: Language) {
  const url = new URL(window.location.href)
  const explicitQueryKey = QUERY_KEYS.find((key) => url.searchParams.has(key))
  if (explicitQueryKey) {
    url.searchParams.set(explicitQueryKey, language)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    return
  }

  const segments = url.pathname.split('/').filter(Boolean)
  if (normalizeLanguage(segments[0]) !== null) {
    segments[0] = language
    const nextPath = `/${segments.join('/')}`
    window.history.replaceState(null, '', `${nextPath}${url.search}${url.hash}`)
  }
}
