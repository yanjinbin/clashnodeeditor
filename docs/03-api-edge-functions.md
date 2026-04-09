# Vercel Edge Functions

## 为什么需要 Edge Function

浏览器有同源策略（CORS）：直接从前端 fetch 机场订阅 URL 会被 block（`Access-Control-Allow-Origin` 缺失）。

**解决方案**：在自己的 Vercel 账号下部署一个透明代理，让浏览器请求自己的域名，再由 Vercel 服务器转发到机场。服务端没有 CORS 限制。

```
Browser → vercel.app/api/proxy?url=... → 机场订阅服务器
                                       ↙
              机场返回 YAML → Vercel → Browser
```

---

## api/proxy.ts — 订阅 CORS 代理

### 完整实现思路

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url, ua } = req.query

  // 1. 参数校验
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  // 2. 安全校验：只允许 http/https
  let parsed: URL
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  // 3. 转发请求，透传 User-Agent
  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': typeof ua === 'string' ? ua : 'clash-verge/v2.2.3' },
    })
    const text = await upstream.text()

    // 4. 原样返回 YAML，镜像状态码
    res.status(upstream.status)
       .setHeader('Content-Type', 'text/plain; charset=utf-8')
       .send(text)
  } catch (e) {
    res.status(502).json({ error: 'Upstream fetch failed' })
  }
}
```

### 安全要点

| 风险 | 缓解措施 |
|------|---------|
| SSRF（请求内网） | 只允许 `http:` / `https:` 协议；Vercel 沙箱网络隔离 |
| 滥用（任意 URL 代理） | 部署在用户自己的 Vercel 账号下，自担费用，无共享风险 |
| 大文件 | Vercel 响应限制（4.5 MB），订阅 YAML 通常 < 1 MB |

---

## api/ipinfo.ts — IP 质量查询代理

### 为什么需要代理

`ip-api.com` 有跨域限制，且免费版限速 45 req/min/IP。通过 Vercel 服务端代理：
- 绕过浏览器 CORS 限制
- 支持批量查询（POST body 传数组）

### 接口设计

```
GET  /api/ipinfo?ip=1.2.3.4          → 单 IP 查询
POST /api/ipinfo  body: string[]      → 批量查询（最多 100 个）
OPTIONS /api/ipinfo                   → CORS preflight
```

### 批量查询实现

```ts
// POST 批量
const ips: string[] = await req.body  // Vercel 自动解析 JSON body

const results = await Promise.all(
  ips.map((ip) =>
    fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,isp,proxy,hosting,query`)
      .then((r) => r.json())
  )
)
res.json(results)
```

### 返回字段说明

```ts
interface IpData {
  status: 'success' | 'fail'
  country: string        // "China"
  countryCode: string    // "CN"
  city: string
  isp: string            // 运营商
  proxy: boolean         // 是否为已知代理/VPN IP
  hosting: boolean       // 是否为数据中心/托管服务器 IP
  query: string          // 查询的 IP 地址
}
```

`proxy: true` → 已知 VPN/代理 IP（适合出口验证）
`hosting: true` → 数据中心 IP（机房服务器，非住宅）
两者都 `false` → 住宅 IP（最难被检测）

---

## CORS 响应头配置

```ts
// 通用 CORS 头（ipinfo 接口）
res.setHeader('Access-Control-Allow-Origin', '*')
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
res.setHeader('Cache-Control', 'public, max-age=3600')  // CDN 缓存 1 小时
```

---

## Vercel Functions vs Edge Runtime

本项目用 `@vercel/node`（Node.js 运行时），而非 Vercel Edge Runtime：

| 特性 | Node.js (本项目) | Edge Runtime |
|------|------|------|
| 冷启动 | ~100-300ms | <50ms |
| Node.js API | 全支持 | 受限（无 fs, crypto 等） |
| 包体积限制 | 250 MB | 4 MB |
| 计费 | Active CPU 时间 | 同上 |
| 适用场景 | 需要 Node.js 生态 | 低延迟路由/认证中间件 |

订阅代理需要完整的 `fetch`，Node.js 运行时足够。
