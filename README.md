# Clash Node Editor

一个基于 Web 的 Clash / mihomo 配置编辑器，支持多机场订阅合并、代理组拖拽编辑、规则集管理和配置导出。

**在线使用：** https://clashnodeeditor.vercel.app

---

## 功能特性

### 订阅源管理
- 添加多个机场 URL 订阅源，自动拉取并解析节点
- 支持上传本地 YAML 文件
- 可为每个订阅源单独设置 User-Agent（默认 `clash-verge/v2.2.3`，兼容 mihomo 全协议包括 VLESS/REALITY）
- 跨订阅源**重复节点名自动检测**，高亮告警

### 代理组编辑
- 可视化创建、编辑、删除代理组
- **拖拽排序**节点顺序（@dnd-kit）
- 支持 select / url-test / fallback / load-balance / relay 五种类型
- 支持 Emoji 名称（内置完整 Emoji Picker）

### 规则集管理
- 内置 [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules) 13 条预设规则集
- 内置 [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) 13 条规则集（CN、OpenAI、Claude、Gemini、Copilot、YouTube、Telegram 等）
- **AI 规则一键预生成**：为 OpenAI / Claude / Gemini / Copilot 单独选择目标代理组，一键启用
- 规则集拖拽排序，支持粘贴 GitHub 链接（自动转换为 jsDelivr CDN 地址）
- 自定义手动规则（DOMAIN / IP-CIDR / GEOIP / MATCH 等）

### 全局配置
- 可编辑 `mixed-port`、`allow-lan`、`bind-address`、`mode`、`log-level`、`external-controller`
- 完整 DNS 配置：fake-ip、nameserver、fallback、fallback-filter 等所有字段

### 预览导出
- 实时 YAML 预览，代理节点以单行 flow 格式输出（兼容 mihomo 解析）
- 一键复制 / 下载 `config.yaml`

---

## 安全性：透明、可审计、自托管

**本工具不会泄露你的机场订阅链接。**

浏览器直接请求机场订阅 URL 会被 CORS 策略拦截，常见解决方案是使用第三方 CORS 代理（如 corsproxy.io），但这意味着你的订阅链接会经过不受控制的第三方服务器。

本项目采用另一种方案：

```
浏览器  →  /api/proxy?url=<你的订阅URL>&ua=<UA>  →  Vercel Edge Function  →  机场服务器
```

1. **自托管**：`api/proxy.ts` 作为 Vercel Edge Function 部署在你自己的 Vercel 项目下，请求不经过任何第三方
2. **代码开源**：代理逻辑完整呈现在 `api/proxy.ts`，任何人都可以审查它做了什么
3. **最小功能**：仅转发 HTTP/HTTPS 请求并返回响应体，不记录、不存储任何内容
4. **可自行部署**：fork 本仓库并部署到自己的 Vercel，确保完全自主可控

`api/proxy.ts` 核心逻辑：

```typescript
export const config = { runtime: 'edge' }

export default async function handler(request: Request) {
  const target = new URL(request.url).searchParams.get('url')
  // 仅允许 http/https，拒绝其他协议
  const upstream = await fetch(target, {
    headers: { 'User-Agent': ua }   // 使用你指定的 UA 请求机场
  })
  return new Response(await upstream.text(), {
    headers: { 'Access-Control-Allow-Origin': '*' }  // 允许浏览器读取
  })
}
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS v4 |
| 状态 | Zustand + immer |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| YAML | js-yaml（flowLevel:2 单行 proxy 格式） |
| Emoji | @emoji-mart/react（portal 渲染） |
| 部署 | Vercel（Edge Function CORS 代理 + 静态前端） |

---

## 本地开发

```bash
pnpm install
pnpm dev        # http://localhost:5173，含 /api/proxy 中间件
pnpm build
```

---

## 部署

### Vercel（推荐，含 Edge Function）

```bash
npm i -g vercel
vercel deploy --prod
```

### Cloudflare Pages（仅静态，无 Edge Function）

将 `dist/` 目录上传，`public/_redirects` 已配置 SPA fallback。注意：不含 `/api/proxy`，订阅 URL 拉取需机场支持 CORS。

---

## 项目结构

```
├── api/
│   └── proxy.ts               # Vercel Edge Function：自托管 CORS 代理
├── src/
│   ├── components/
│   │   ├── SourceManager.tsx  # 订阅源 + UA + 重复检测
│   │   ├── ProxyGroupEditor.tsx
│   │   ├── RuleSetManager.tsx # 规则集 + AI 快速配置
│   │   └── ConfigPreview.tsx  # 全局配置 + YAML 导出
│   ├── store/useAppStore.ts
│   ├── types/clash.ts         # 类型定义 + 预设规则集
│   └── utils/parseYaml.ts     # YAML 解析 + 配置生成
└── vercel.json
```

---

## 规则集来源

- **Loyalsoldier clash-rules**：https://github.com/Loyalsoldier/clash-rules
- **blackmatrix7 ios_rule_script**：https://github.com/blackmatrix7/ios_rule_script

---

## License

MIT
