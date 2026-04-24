import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '../i18n/index'

type Theme = 'light' | 'dark'
type Language = 'zh' | 'en'

interface UIState {
  theme: Theme
  language: Language
  setTheme: (theme: Theme) => void
  setLanguage: (lang: Language) => void
  toggleTheme: () => void
  toggleLanguage: () => void
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function getStoredUIState(): Partial<Pick<UIState, 'theme' | 'language'>> {
  const stored = localStorage.getItem('ui-settings')
  if (!stored) return {}
  try {
    const parsed = JSON.parse(stored)
    return parsed?.state ?? {}
  } catch {
    return {}
  }
}

// Determine initial theme from persisted value or system preference
function getInitialTheme(): Theme {
  const theme = getStoredUIState().theme
  if (theme === 'dark' || theme === 'light') {
    return theme
  }
  // Fall back to system preference
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function getInitialLanguage(): Language {
  const legacy = localStorage.getItem('ui-language')
  if (legacy === 'zh' || legacy === 'en') return legacy
  const language = getStoredUIState().language
  if (language === 'zh' || language === 'en') return language
  return 'zh'
}

const initialTheme = getInitialTheme()
const initialLanguage = getInitialLanguage()
applyTheme(initialTheme)
localStorage.setItem('ui-language', initialLanguage)

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: initialTheme,
      language: initialLanguage,

      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },

      setLanguage: (language) => {
        localStorage.setItem('ui-language', language)
        i18n.changeLanguage(language)
        set({ language })
      },

      toggleTheme: () =>
        set((state) => {
          const next: Theme = state.theme === 'dark' ? 'light' : 'dark'
          applyTheme(next)
          return { theme: next }
        }),

      toggleLanguage: () =>
        set((state) => {
          const next: Language = state.language === 'zh' ? 'en' : 'zh'
          localStorage.setItem('ui-language', next)
          i18n.changeLanguage(next)
          return { language: next }
        }),
    }),
    {
      name: 'ui-settings',
      partialize: (state) => ({ theme: state.theme, language: state.language }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        applyTheme(state.theme)
        localStorage.setItem('ui-language', state.language)
        i18n.changeLanguage(state.language)
      },
    }
  )
)
