import { useTranslation } from 'react-i18next'

export default function NovproxyBanner() {
  const { t, i18n } = useTranslation()
  const href = i18n.language === 'zh'
    ? 'https://novproxy.com/zh/?code=666888'
    : 'https://novproxy.com/?code=666888'

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full"
      title={t('node.novproxy.title')}
    >
      <svg
        width="140"
        height="360"
        viewBox="0 0 140 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        className="w-full h-auto rounded-xl"
      >
        <defs>
          <linearGradient id="nb-bg" x1="0" y1="0" x2="0" y2="360" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1a0f3c" />
            <stop offset="100%" stopColor="#0b0620" />
          </linearGradient>
          <linearGradient id="nb-btn-primary" x1="0" y1="0" x2="140" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
          <linearGradient id="nb-code-bg" x1="0" y1="0" x2="140" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <filter id="nb-glow">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 背景 */}
        <rect width="140" height="360" rx="14" fill="url(#nb-bg)" />
        <ellipse cx="70" cy="30" rx="60" ry="30" fill="#6d28d9" opacity="0.18" filter="url(#nb-glow)" />

        {/* Logo */}
        <image href="https://novproxy.com/static/img/logo.svg" x="4" y="16" width="132" height="24" />

        {/* 分隔线 */}
        <rect x="20" y="50" width="100" height="0.75" rx="0.375" fill="#3b1f8a" opacity="0.8" />

        {/* 主标题 */}
        <text x="70" y="73" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="12.5" fontWeight="800" fill="white">{t('node.novproxy.mainTitle1')}</text>
        <text x="70" y="89" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="12.5" fontWeight="800" fill="white">{t('node.novproxy.mainTitle2')}</text>

        {/* Residential Proxy pill */}
        <rect x="24" y="97" width="92" height="18" rx="9" fill="#4f46e5" opacity="0.25" />
        <rect x="24" y="97" width="92" height="18" rx="9" fill="none" stroke="#6d28d9" strokeWidth="0.75" />
        <text x="70" y="110" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="10" fill="#c4b5fd">Residential Proxy</text>

        {/* 解锁标签 */}
        <rect x="8" y="123" width="124" height="17" rx="8.5" fill="#312e81" opacity="0.5" />
        <text x="70" y="135.5" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="9.5" fill="#e0d7ff">{t('node.novproxy.unlock')}</text>

        {/* 分隔线 */}
        <rect x="20" y="150" width="100" height="0.5" rx="0.25" fill="#3b1f8a" opacity="0.5" />

        {/* 卖点列表 */}
        <rect x="12" y="158" width="5" height="13" rx="2.5" fill="#7c3aed" />
        <text x="23" y="169" fontFamily="system-ui,-apple-system,sans-serif" fontSize="10.5" fontWeight="700" fill="white">{t('node.novproxy.highQuality')}</text>
        <text x="70" y="169" fontFamily="system-ui,-apple-system,sans-serif" fontSize="9" fill="#a78bfa">{t('node.novproxy.purity')}</text>

        <rect x="12" y="177" width="5" height="13" rx="2.5" fill="#7c3aed" />
        <text x="23" y="188" fontFamily="system-ui,-apple-system,sans-serif" fontSize="10.5" fontWeight="700" fill="white">{t('node.novproxy.successRate')}</text>
        <text x="68" y="188" fontFamily="system-ui,-apple-system,sans-serif" fontSize="10.5" fontWeight="800" fill="#c4b5fd">99.9%</text>

        <rect x="12" y="196" width="5" height="13" rx="2.5" fill="#7c3aed" />
        <text x="23" y="207" fontFamily="system-ui,-apple-system,sans-serif" fontSize="10.5" fontWeight="700" fill="white">{t('node.novproxy.support')}</text>

        <rect x="12" y="215" width="5" height="13" rx="2.5" fill="#7c3aed" />
        <text x="23" y="226" fontFamily="system-ui,-apple-system,sans-serif" fontSize="10.5" fontWeight="700" fill="white">{t('node.novproxy.neverExpire')}</text>

        {/* 分隔线 */}
        <rect x="20" y="240" width="100" height="0.5" rx="0.25" fill="#3b1f8a" opacity="0.5" />

        {/* 免费试用按钮 — 实心渐变 */}
        <rect x="10" y="250" width="120" height="34" rx="17" fill="url(#nb-btn-primary)" />
        <text x="70" y="272" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="12.5" fontWeight="700" fill="white" letterSpacing="0.5">{t('node.novproxy.freeTrial')}</text>

        {/* 获得定价按钮 — 描边 */}
        <rect x="10" y="293" width="120" height="30" rx="15" fill="#2a1660" />
        <rect x="10" y="293" width="120" height="30" rx="15" fill="none" stroke="#7c3aed" strokeWidth="1.25" />
        <text x="70" y="313" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="11.5" fontWeight="600" fill="#c4b5fd" letterSpacing="0.5">{t('node.novproxy.pricing')}</text>

        {/* 优惠码 — 醒目金色胶囊 */}
        <rect x="14" y="333" width="112" height="20" rx="10" fill="url(#nb-code-bg)" />
        <text x="70" y="347" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="9.5" fontWeight="700" fill="#1c1200" letterSpacing="1">{t('node.novproxy.promoCode')}</text>
      </svg>
    </a>
  )
}
