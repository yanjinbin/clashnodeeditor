import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[]
  }
}

interface AdBannerProps {
  /** 广告位 slot ID，在 AdSense 控制台创建广告单元时获取 */
  slot: string
  className?: string
}

/**
 * Google AdSense 广告单元
 * - slot: 在 AdSense 后台创建"展示广告"单元后获取的 slot ID
 * - publisher ID 在 index.html 的 <script async src="...?client=ca-pub-XXX"> 中配置
 */
export default function AdBanner({ slot, className = '' }: AdBannerProps) {
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // AdSense not loaded (e.g. ad blocker or dev mode)
    }
  }, [])

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-4600274306964283"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
