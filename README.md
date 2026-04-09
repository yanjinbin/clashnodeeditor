# 🚀🌍 Clash Node Editor

在线 Clash / mihomo 配置编辑器，支持多机场订阅合并、节点/代理组编辑、规则集管理和配置导出。

**在线使用：** https://clashnodeeditor.vercel.app

---

## 功能

### 订阅源管理
- 添加多个机场 URL 订阅，或上传本地 YAML 文件
- 解析订阅中的**节点（proxies）**和**代理组（proxy-groups）**，均保留供编辑
- 可为每个订阅单独设置 User-Agent（默认 `clash-verge/v2.2.3`，兼容 VLESS/REALITY 等 mihomo 协议）
- 跨订阅**重复节点名**和**重复代理组名**自动检测，显示告警

### 节点编辑
- 展开订阅源，查看所有节点（按协议类型色块标注：vless/vmess/trojan/hysteria2…）
- 点击节点名即可**内联重命名**，回车确认
- 支持**节点过滤**，快速定位
- 重命名后，该节点在所有代理组中的引用**自动同步更新**

### 批量前缀
- 为单个订阅源的所有节点**批量加前缀**（如 `机场A|`）
- 已有该前缀的节点不重复添加
- 存在重名节点时，一键加「源名前缀」快速区分
- 加前缀后，所有代理组中的节点引用**同步更新**

### 代理组管理
- 订阅源解析后，可展开查看来源代理组列表
- 支持**单个导入**或**全部导入**到配置
- 重名代理组显示冲突告警（跨订阅 + 与已有代理组）
- 可视化编辑代理组，支持拖拽排序节点
- 支持 select / url-test / fallback / load-balance / relay 五种类型
- 代理组名称支持 Emoji（内置完整 Emoji Picker，选一个不消失，可连续选）

### 规则集管理
- 内置 [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules) 13 条预设规则集
- 内置 [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) 13 条规则集（CN、OpenAI、Claude、Gemini、YouTube、Telegram 等）
- **AI 规则一键预生成**：为 OpenAI / Claude / Gemini / Copilot 单独指定目标代理组，一键启用
- 规则集支持拖拽排序、单独开关、修改目标代理组
- 粘贴 GitHub 链接自动转换为 jsDelivr CDN 地址
- 自定义手动规则（DOMAIN / IP-CIDR / GEOIP / MATCH 等），支持拖拽排序

### 全局配置（预览导出页）
- 可编辑 `mixed-port`、`allow-lan`、`bind-address`、`mode`、`log-level`、`external-controller`
- 完整 DNS 配置：fake-ip / redir-host、nameserver、fallback、fallback-filter 等所有字段

### 预览导出
- 实时 YAML 预览，代理节点以单行 flow 格式输出（兼容 mihomo 解析）
- 支持 **soft wrap** 自动换行切换
- **可编辑导出文件名**（点击文件名直接修改，自动补 `.yaml` 后缀）
- 一键复制 / 下载

---

## 安全性：透明、可审计、自托管

订阅请求不经过任何第三方服务。浏览器的 CORS 限制通过部署在**你自己 Vercel 账号**下的 Edge Function 解决：

```
浏览器 → /api/proxy?url=<订阅URL>&ua=<UA> → 你的 Vercel Edge Function → 机场服务器
```

- **自托管**：函数运行在你自己的 Vercel 项目，请求不经过任何第三方
- **代码开源**：`api/proxy.ts` 完整公开，任何人可审查
- **最小功能**：仅转发 HTTP/HTTPS 请求并返回响应体，无日志、无存储
- **可完全自主**：部署到你自己的 Vercel，完全掌控

---

## 部署

### Vercel（推荐，含 Edge Function）

```bash
npm i -g vercel
vercel deploy --prod
```

### Cloudflare Pages（仅静态）

上传 `dist/` 目录。注意：不含 `/api/proxy`，订阅 URL 拉取需机场支持 CORS。

---

## 规则集来源

- **Loyalsoldier clash-rules**：https://github.com/Loyalsoldier/clash-rules
- **blackmatrix7 ios_rule_script**：https://github.com/blackmatrix7/ios_rule_script

---

## License

MIT
