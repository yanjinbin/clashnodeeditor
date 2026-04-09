export const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+:[0-9a-fA-F:]+$/

// ── 全局缓存 ──────────────────────────────────────────────────────────────────
const IP_INFO_TTL = 30 * 60 * 1000   // IP 质量数据缓存 30 分钟
const DNS_TTL     =  5 * 60 * 1000   // DNS 解析结果缓存 5 分钟

const ipInfoCache = new Map<string, { data: IpData; ts: number }>()
const dnsCache    = new Map<string, { ip: string;   ts: number }>()

function getIpInfoCached(ip: string): IpData | null {
  const entry = ipInfoCache.get(ip)
  if (!entry) return null
  if (Date.now() - entry.ts > IP_INFO_TTL) { ipInfoCache.delete(ip); return null }
  return entry.data
}

function setIpInfoCache(ip: string, data: IpData) {
  ipInfoCache.set(ip, { data, ts: Date.now() })
}

function getDnsCached(domain: string): string | null {
  const entry = dnsCache.get(domain)
  if (!entry) return null
  if (Date.now() - entry.ts > DNS_TTL) { dnsCache.delete(domain); return null }
  return entry.ip
}

function setDnsCache(domain: string, ip: string) {
  dnsCache.set(domain, { ip, ts: Date.now() })
}

// ── 公开工具 ──────────────────────────────────────────────────────────────────

export interface IpData {
  status: 'success' | 'fail'
  country?: string
  countryCode?: string
  city?: string
  isp?: string
  /** 是代理/VPN IP */
  proxy?: boolean
  /** 是数据中心/托管 IP */
  hosting?: boolean
  /** 实际查询的 IP */
  query?: string
}

/** 域名 → IP（Google DoH），IP 直接返回；结果缓存 5 分钟 */
export async function resolveToIp(server: string): Promise<string> {
  if (!server) throw new Error('no server')
  if (IP_RE.test(server)) return server

  const cached = getDnsCached(server)
  if (cached) return cached

  const res = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(server)}&type=A`,
    { headers: { Accept: 'application/dns-json' } }
  )
  if (!res.ok) throw new Error('DoH request failed')
  const json = await res.json()
  const ip: string | undefined = json.Answer?.find((r: { type: number }) => r.type === 1)?.data
  if (!ip) throw new Error('no A record')

  setDnsCache(server, ip)
  return ip
}

/**
 * 批量获取 IP 信息，优先命中全局缓存（TTL 30 分钟）。
 * 只对未缓存的 IP 发起网络请求，结果写回缓存。
 */
export async function fetchIpInfoBatch(ips: string[]): Promise<IpData[]> {
  const results: (IpData | null)[] = ips.map((ip) => getIpInfoCached(ip))

  // 找出需要实际请求的 IP
  const missing = ips.filter((_, i) => results[i] === null)

  if (missing.length > 0) {
    // 分批，每批最多 100（ip-api.com 限制）
    const fetched: IpData[] = []
    for (let i = 0; i < missing.length; i += 100) {
      const batch = missing.slice(i, i + 100)
      const res = await fetch('/api/ipinfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
      if (!res.ok) throw new Error('ipinfo request failed')
      const data: IpData[] = await res.json()
      fetched.push(...data)
      // 写入缓存
      data.forEach((d, j) => setIpInfoCache(batch[j], d))
    }

    // 回填到 results 数组
    let fi = 0
    for (let i = 0; i < results.length; i++) {
      if (results[i] === null) results[i] = fetched[fi++]
    }
  }

  return results as IpData[]
}

/** 清除所有 IP 信息缓存（供调试/手动刷新使用） */
export function clearIpInfoCache() {
  ipInfoCache.clear()
  dnsCache.clear()
}
