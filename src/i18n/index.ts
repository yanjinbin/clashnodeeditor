import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { zh } from './locales/zh'
import { en } from './locales/en'

function getInitialLanguage() {
  const legacy = localStorage.getItem('ui-language')
  if (legacy === 'zh' || legacy === 'en') return legacy
  try {
    const stored = JSON.parse(localStorage.getItem('ui-settings') ?? '{}')
    const language = stored?.state?.language
    if (language === 'zh' || language === 'en') return language
  } catch {
    // ignore invalid persisted settings
  }
  return 'zh'
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
})

export default i18n
