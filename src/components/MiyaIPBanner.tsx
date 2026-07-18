import { useTranslation } from 'react-i18next'

export default function MiyaIPBanner() {
  const { t } = useTranslation()

  return (
    <a
      href="https://www.miyaip.com/?invitecode=5722145"
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full"
      title={t('app.airport.miyaip')}
    >
      <svg
        width="140"
        height="360"
        viewBox="0 0 140 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full h-auto rounded-xl shadow-lg shadow-orange-900/10"
        role="img"
        aria-label={t('app.airport.miyaip')}
      >
        <defs>
          <linearGradient id="miya-bg" x1="12" y1="0" x2="132" y2="360" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.5" stopColor="#fff7ed" />
            <stop offset="1" stopColor="#ffedd5" />
          </linearGradient>
          <linearGradient id="miya-orange" x1="14" y1="0" x2="126" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fb923c" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="miya-dark" x1="0" y1="0" x2="0" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#262626" />
            <stop offset="1" stopColor="#111827" />
          </linearGradient>
          <filter id="miya-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#ea580c" floodOpacity="0.22" />
          </filter>
        </defs>

        <rect width="140" height="360" rx="14" fill="url(#miya-bg)" />
        <path d="M6 89C36 76 68 77 102 91C117 97 128 98 140 91V126C119 133 98 129 78 118C51 103 28 102 6 114V89Z" fill="#fed7aa" opacity="0.45" />
        <path d="M0 236C28 221 58 221 91 236C108 244 124 245 140 237V286C111 295 83 291 56 275C35 263 16 262 0 271V236Z" fill="#fdba74" opacity="0.28" />

        <g transform="translate(14 18)">
          <text x="0" y="22" fontFamily="Arial Black,system-ui,-apple-system,sans-serif" fontSize="21" fontWeight="900" fill="url(#miya-dark)">Mi</text>
          <text x="30" y="22" fontFamily="Arial Black,system-ui,-apple-system,sans-serif" fontSize="21" fontWeight="900" fill="#f97316">ya</text>
          <text x="64" y="22" fontFamily="Arial Black,system-ui,-apple-system,sans-serif" fontSize="21" fontWeight="900" fill="url(#miya-dark)">IP</text>
          <rect x="0" y="35" width="112" height="1" rx="0.5" fill="#fed7aa" />
        </g>

        <g transform="translate(12 70)">
          <rect x="0" y="0" width="116" height="24" rx="12" fill="#111827" />
          <text x="58" y="16" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="12" fontWeight="800" fill="#ffedd5">高质量 高信誉</text>
        </g>

        <g transform="translate(12 110)" filter="url(#miya-soft-shadow)">
          <rect x="0" y="0" width="116" height="86" rx="12" fill="url(#miya-orange)" />
          <text x="58" y="31" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="25" fontWeight="900" fill="#111827">真实</text>
          <text x="58" y="62" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="25" fontWeight="900" fill="#111827">家宽IP</text>
        </g>

        <g transform="translate(12 212)" fontFamily="system-ui,-apple-system,sans-serif">
          <rect x="0" y="0" width="116" height="30" rx="8" fill="#ffffff" stroke="#fed7aa" />
          <circle cx="16" cy="15" r="5" fill="#f97316" />
          <text x="28" y="19" fontSize="12" fontWeight="800" fill="#111827">IPPure 高评分</text>

          <rect x="0" y="38" width="116" height="30" rx="8" fill="#ffffff" stroke="#fed7aa" />
          <circle cx="16" cy="53" r="5" fill="#f97316" />
          <text x="28" y="57" fontSize="12" fontWeight="800" fill="#111827">Ping0.cc 可查</text>

          <rect x="0" y="76" width="116" height="30" rx="8" fill="#ffffff" stroke="#fed7aa" />
          <circle cx="16" cy="91" r="5" fill="#f97316" />
          <text x="28" y="95" fontSize="12" fontWeight="800" fill="#111827">节点干净稳定</text>
        </g>

        <g transform="translate(12 326)">
          <rect x="0" y="0" width="116" height="24" rx="12" fill="#111827" />
          <text x="58" y="16" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontSize="12" fontWeight="800" fill="#ffedd5">立即开始使用 ↗</text>
        </g>
      </svg>
    </a>
  )
}
