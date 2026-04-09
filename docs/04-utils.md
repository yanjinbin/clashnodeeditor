# 工具函数详解

## parseYaml.ts

### fetchAndParseYaml

```ts
export async function fetchAndParseYaml(url: string, userAgent?: string) {
  // 经由 /api/proxy 绕过 CORS
  const apiUrl = `/api/proxy?url=${encodeURIComponent(url)}&ua=${encodeURIComponent(userAgent ?? DEFAULT_USER_AGENT)}`
  const res = await fetch(apiUrl)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  return parseYamlFull(text)
}
```

**`encodeURIComponent` 的必要性**：URL 中可能含有 `?`、`&`、`=` 等特殊字符，必须编码才能正确传递给后端 query string。

### parseYamlFull

```ts
export function parseYamlFull(text: string): { proxies: Proxy[], groups: ImportedProxyGroup[] } {
  const doc = yaml.load(text)
  if (typeof doc !== 'object' || doc === null) throw new Error('Invalid YAML')

  const raw = doc as Record<string, unknown>
  const proxies = (raw.proxies ?? []) as Proxy[]
  const groups  = (raw['proxy-groups'] ?? []) as ImportedProxyGroup[]

  if (proxies.length === 0 && groups.length === 0) {
    throw new Error('YAML 中未找到节点或代理组')
  }
  return { proxies, groups }
}
```

**类型断言策略**：js-yaml 解析结果是 `unknown`，先断言为 `Record<string, unknown>`，再按字段取值。对于代理数组，直接断言为 `Proxy[]`——因为代理字段是 `[key: string]: unknown`，TypeScript 不会报错，而真正的字段校验交给业务逻辑（渲染时按需访问）。

### generateClashConfig

```ts
export function generateClashConfig(
  proxies: Proxy[],
  proxyGroups: OutGroup[],
  ruleProviders: RuleProvider[],
  rules: OutRule[],
  globalSettings: ClashGlobalSettings
): string {
  const enabledProviders = ruleProviders.filter((p) => p.enabled)

  const config = {
    ...globalSettings,      // mixed-port, dns, etc.
    proxies,
    'proxy-groups': proxyGroups,
    'rule-providers': Object.fromEntries(
      enabledProviders.map((p) => [
        p.name,
        { type: p.type, behavior: p.behavior, url: p.url, path: `./rules/${p.name}.yaml`, interval: p.interval ?? 86400 },
      ])
    ),
    rules: [
      ...enabledProviders.map((p) => `RULE-SET,${p.name},${p.target}${p.noResolve ? ',no-resolve' : ''}`),
      ...rules.map((r) =>
        r.type === 'MATCH'
          ? `MATCH,${r.target}`
          : `${r.type},${r.payload},${r.target}${r.noResolve ? ',no-resolve' : ''}`
      ),
    ],
  }

  return yaml.dump(config, { lineWidth: -1 })
  //                         ↑ 禁止 js-yaml 自动折行（默认 80 字符折行会破坏长 URL）
}
```

**`lineWidth: -1`**：js-yaml 默认在 80 字符处自动插入换行，这会把长 URL 折断，导致 Mihomo 解析失败。`-1` 禁用该行为。

---

## ipUtils.ts

### 两级缓存设计

```ts
// 全局模块级 Map（跨组件共享，页面刷新清空）
const ipInfoCache = new Map<string, { data: IpData; ts: number }>()
const dnsCache    = new Map<string, { ip: string; ts: number }>()

const IP_CACHE_TTL  = 30 * 60 * 1000  // 30 分钟
const DNS_CACHE_TTL =  5 * 60 * 1000  //  5 分钟
```

**为什么用模块级 Map 而非 React state**：
- IP 查询结果跨多个组件共享（SourceManager 和 ProxyGroupEditor 都会查）
- 不需要触发重渲染，只需要读取时命中缓存
- 避免重复请求 ip-api.com（有速率限制）

### resolveToIp

```ts
export async function resolveToIp(server: string): Promise<string> {
  // 已经是 IP，直接返回
  if (IP_RE.test(server)) return server

  // 命中 DNS 缓存
  const cached = dnsCache.get(server)
  if (cached && Date.now() - cached.ts < DNS_CACHE_TTL) return cached.ip

  // Google DoH (DNS over HTTPS)
  const res = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(server)}&type=A`
  )
  const data = await res.json()
  const ip = data.Answer?.[0]?.data ?? server  // 解析失败时回退为原 server

  dnsCache.set(server, { ip, ts: Date.now() })
  return ip
}
```

**Google DoH 的优势**：
- 不受浏览器 DNS 缓存/污染影响
- HTTPS 加密，防止 DNS 劫持
- 国内访问 `dns.google` 有时受限，但作为 fallback 足够

### fetchIpInfoBatch

```ts
export async function fetchIpInfoBatch(ips: string[]): Promise<Map<string, IpData>> {
  const result = new Map<string, IpData>()
  const toFetch: string[] = []

  // 先查缓存
  for (const ip of ips) {
    const cached = ipInfoCache.get(ip)
    if (cached && Date.now() - cached.ts < IP_CACHE_TTL) {
      result.set(ip, cached.data)
    } else {
      toFetch.push(ip)
    }
  }

  if (toFetch.length === 0) return result

  // 批量请求（最多 100 个/次）
  const chunks = []
  for (let i = 0; i < toFetch.length; i += 100) {
    chunks.push(toFetch.slice(i, i + 100))
  }

  for (const chunk of chunks) {
    const res = await fetch('/api/ipinfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    })
    const batch: IpData[] = await res.json()
    batch.forEach((d) => {
      ipInfoCache.set(d.query, { data: d, ts: Date.now() })
      result.set(d.query, d)
    })
  }

  return result
}
```

**批量查询的必要性**：一个订阅源可能有 200+ 节点，逐个请求会触发 ip-api.com 的速率限制（45 req/min）。POST 批量查询一次最多 100 个，大幅减少请求数。

### IP_RE 正则

```ts
const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+:[0-9a-fA-F:]+$/
```

匹配 IPv4（`1.2.3.4`）和 IPv6（`2001:db8::1`），用于判断 server 字段是否已经是 IP，跳过 DoH 解析步骤。

---

## normalizeRuleUrl

```ts
export function normalizeRuleUrl(url: string): string {
  return url.replace(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(blob|tree)\/([^/]+)\/(.*)/,
    'https://cdn.jsdelivr.net/gh/$1/$2@$4/$5'
  )
}
```

### 正则分组解析

```
https://github.com / user / repo / blob / main / rules/reject.yaml
                      $1    $2    (skip)  $4      $5
→ https://cdn.jsdelivr.net/gh/user/repo@main/rules/reject.yaml
```

**`(blob|tree)` 捕获组**：GitHub URL 有 `blob`（文件）和 `tree`（目录）两种形式，都需要转换。该捕获组用 `(skip)` 标注但实际是第 3 个组，所以 `$4` 是分支名，`$5` 是路径。
