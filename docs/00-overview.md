# Clash Node Editor — 技术总览

> 基于 Vite + React + Zustand 的 Mihomo/Clash 配置编辑器，部署于 Vercel Edge。

---

## 项目架构

```
clashnodeeditor/
├── api/                   # Vercel Edge Functions（CORS 代理 / IP 查询）
│   ├── proxy.ts           # 透明 CORS 代理，拉取订阅 YAML
│   └── ipinfo.ts          # IP 质量批量查询（ip-api.com）
├── src/
│   ├── App.tsx            # 根组件，Tab 路由 + 全局布局
│   ├── components/        # 页面组件
│   │   ├── SourceManager.tsx    # 订阅源管理
│   │   ├── ProxyGroupEditor.tsx # 代理组配置
│   │   ├── RuleSetManager.tsx   # 规则 + 规则集
│   │   ├── ConfigPreview.tsx    # 配置预览 + 导出
│   │   └── EmojiPicker.tsx      # 表情选择器（懒加载 + Portal）
│   ├── store/
│   │   └── useAppStore.ts  # Zustand + Immer 全局状态
│   ├── types/
│   │   └── clash.ts        # 全量 TypeScript 类型定义
│   └── utils/
│       ├── parseYaml.ts    # YAML 解析 + 配置生成
│       └── ipUtils.ts      # IP 解析 + 质量查询 + 缓存
├── docs/                  # 本学习笔记
├── public/
│   └── favicon.svg        # 静态资源
└── index.html             # 入口 HTML（favicon emoji 内联 SVG）
```

---

## 技术栈速查

| 层次 | 库 | 版本 | 用途 |
|------|------|------|------|
| UI 框架 | React | 19.2 | 组件树、并发渲染 |
| 构建工具 | Vite | 8.x | HMR、ESM 构建、Tree-shake |
| 类型系统 | TypeScript | ~6.0 | 严格模式，`[key: string]: unknown` 兜底 |
| 样式 | Tailwind CSS | 4.x | 原子类，`dark:` 暗色模式，`/` 透明度语法 |
| 状态管理 | Zustand + Immer | 5.x + 10.x | 轻量全局 store，直接 mutation 语法 |
| 拖拽 | @dnd-kit | core 6 + sortable 10 | 无障碍 D&D，支持键盘导航 |
| 图标 | lucide-react | 1.7 | Tree-shakeable SVG 图标 |
| 表情 | @emoji-mart | 1.1 | 懒加载，Portal 弹出，光标位置插入 |
| YAML | js-yaml | 4.1 | 解析订阅 YAML / dump 配置 |
| 运行时 | @vercel/node | 5.7 | Edge Function 类型 |

---

## 四个主页面

| Tab | 组件 | 核心功能 |
|-----|------|---------|
| 订阅源 | SourceManager | 添加 URL/文件、拉取节点、前缀管理、IP 质检 |
| 代理组 | ProxyGroupEditor | 创建分组、D&D 排序、自动包含全部节点 |
| 规则 | RuleSetManager | 预置规则集、自定义规则、AI 快速配置 |
| 预览导出 | ConfigPreview | 实时 YAML 预览、验证、复制/下载 |

---

## 数据流

```
订阅 URL / 本地 YAML
        ↓
   /api/proxy  (绕过 CORS)
        ↓
  parseYaml.ts → { proxies, groups }
        ↓
   useAppStore  (Zustand)
   ┌──────────────────────────────┐
   │  sources[]   proxyGroups[]  │
   │  rules[]     ruleProviders[]│
   │  globalSettings             │
   └──────────────────────────────┘
        ↓
  generateClashConfig()
        ↓
    config.yaml (预览 / 下载)
```

---

## 文档索引

- [01-state-management.md](./01-state-management.md) — Zustand + Immer 状态管理
- [02-components.md](./02-components.md) — 各页面组件原理与实现
- [03-api-edge-functions.md](./03-api-edge-functions.md) — Vercel Edge Functions
- [04-utils.md](./04-utils.md) — 工具函数（YAML / IP）
- [05-bugfix-changelog.md](./05-bugfix-changelog.md) — Bug 修复与功能迭代记录
- [06-patterns.md](./06-patterns.md) — 可复用技术模式
