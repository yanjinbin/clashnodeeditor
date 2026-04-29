# ✈️ Clash Node Editor

> 🌐 Online Clash / Mihomo configuration editor — merge multiple subscriptions, edit proxies, manage proxy groups, configure rule sets, and export with one click

**🔗 Live Demo:** https://clashnodeeditor.vercel.app

[中文文档](README.zh.md)

---

## ✨ Features

### 📡 Subscription Management
- ➕ Add multiple airport subscription URLs or upload local YAML files
- 🔍 Parse **proxies** and **proxy-groups** from each subscription, all kept for editing
- 🤖 Set a custom User-Agent per subscription (default: `clash-verge/v2.2.3`, compatible with VLESS/REALITY and other Mihomo protocols)
- ⚠️ Automatic detection of **duplicate proxy names** and **duplicate group names** across subscriptions with warnings
- 🔄 **Refresh All**: concurrently refresh all subscriptions with real-time progress
- 📊 **Traffic info**: auto-parse `Subscription-Userinfo` to display used/total/expiry
- 📈 **Protocol distribution chart**: visualize vmess / vless / trojan / hysteria2 ratios

### ✏️ Proxy Editing
- 👀 Expand a subscription to view all proxies (color-coded by protocol: vless / vmess / trojan / hysteria2…)
- 🖊️ Click a proxy name to **inline rename**, press Enter to confirm
- 🔎 **Filter proxies** to quickly locate entries
- 🔗 After renaming, all references in proxy groups **sync automatically**
- 🌍 **IP quality lookup** — one click to open the detection page

### 🏷️ Bulk Prefix
- 🎯 Add a **prefix to all proxies** in a subscription at once (e.g. `AirportA|`)
- ✅ Proxies that already have the prefix are skipped
- ⚡ When name collisions exist, one click adds the source name as a prefix
- 🔄 Proxy group references **sync** after prefix is applied

### 👥 Proxy Group Management
- 📥 After parsing, expand a subscription to view its proxy groups
- 🔀 **Import individually** or **import all** into the current config
- ⚠️ Duplicate group names show conflict warnings (cross-subscription + existing groups)
- 🖱️ Visual editor with **drag-and-drop proxy ordering** within groups
- 🗂️ Group cards themselves support **drag-and-drop reordering**
- 🌐 Supports all five types: select / url-test / fallback / load-balance / relay
- 😀 Group names support Emoji (built-in full Emoji Picker, non-dismissing for multi-select)
- 🔍 Filter proxies by **IP quality** (country / datacenter / residential / proxy)

### 🛡️ Rule Set Management
- 📦 13 preset rule sets from [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules)
- 📦 13 rule sets from [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) (CN, OpenAI, Claude, Gemini, YouTube, Telegram, etc.)
- ⚡ **One-click AI rules**: assign individual proxy groups to OpenAI / Claude / Gemini / Copilot and enable instantly
- 🔀 Drag-and-drop rule set ordering, toggle on/off, change target group
- 🔗 Paste a GitHub link to auto-convert to jsDelivr CDN URL
- ✍️ Custom manual rules (DOMAIN / IP-CIDR / GEOIP / MATCH, etc.) with drag-and-drop ordering

### ✅ Config Validation
- 👻 **Orphan proxy detection**: proxies referenced by groups but absent from any subscription
- 🈳 **Empty group warning**: non-autoAllNodes groups with zero members
- 🔁 **Circular reference detection**: groups that reference each other
- 🎯 **Dead target detection**: rules/rule-sets pointing to deleted proxy groups highlighted in red
- ❓ **Missing MATCH rule**: warning when no catch-all rule exists

### ⚙️ Global Settings (Preview & Export page)
- 🔧 Edit `mixed-port`, `allow-lan`, `bind-address`, `mode`, `log-level`, `external-controller`
- 🌐 Full DNS config: fake-ip / redir-host, nameserver, fallback, fallback-filter, and all other fields
- 🕵️ Sniffer, GeoData mode, global fingerprint, and other advanced options
- 🛜 Merlin Clash router template — one click to fill `redir-port`, `routing-mark`, `dns.listen`, `hosts`, and other compatible parameters

### 📄 Preview & Export
- 👁️ Live YAML preview; proxy entries output in single-line flow format (Mihomo-compatible)
- 📐 Toggle **soft wrap**
- ✏️ **Editable export filename** (click the filename to edit; `.yaml` appended automatically)
- 📋 One-click copy / ⬇️ download
- 📥 Import an existing Clash config (file upload or paste text)

### 💾 State Persistence
- 🔒 All config (subscription URLs, proxy groups, rules, DNS settings) **auto-saved to localStorage**
- 🔄 Full restore on page reload — no need to re-enter anything
- ⚡ Proxy node data is not persisted (large payload); after restore just click "Refresh All" to re-fetch

---

## 🔒 Security: Transparent, Auditable, Self-hosted

Subscription requests never pass through any third-party service. Browser CORS restrictions are handled by an Edge Function deployed under **your own Vercel account**:

```
🌐 Browser → /api/proxy?url=<subURL>&ua=<UA> → Your Vercel Edge Function → Subscription Server
```

| Feature | Details |
|---------|---------|
| 🏠 **Self-hosted** | Function runs in your own Vercel project; no third party involved |
| 📖 **Open source** | `api/proxy.ts` is fully public and auditable |
| 🎯 **Minimal scope** | Forwards HTTP/HTTPS requests and returns the response body; no logging, no storage |
| 🛡️ **Full control** | Deploy to your own Vercel account — you own it entirely |

---

## 🚀 Deployment

### ▲ Vercel (recommended, includes Edge Function)

```bash
npm i -g vercel
vercel deploy --prod
```

### ☁️ Cloudflare Pages (static only)

Upload the `dist/` directory. Note: `/api/proxy` is not included; subscription fetching requires the airport to support CORS.

---

## 📚 Rule Set Sources

- 📌 **Loyalsoldier clash-rules**: https://github.com/Loyalsoldier/clash-rules
- 📌 **blackmatrix7 ios_rule_script**: https://github.com/blackmatrix7/ios_rule_script

---

## 📄 License

MIT
