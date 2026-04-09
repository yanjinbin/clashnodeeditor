# 状态管理 — Zustand + Immer

## 为什么选 Zustand

- Redux 太重（Reducer/Action/Selector 三层分离），本项目单页数据流简单
- React Context 每次 setState 触发整棵树重渲染
- Zustand：极小体积（~1 KB gzip），selector 精准订阅，与 Immer 结合保留 mutation 写法

---

## Store 结构

```ts
// src/store/useAppStore.ts
interface AppState {
  // ── 数据 ──────────────────────────────────
  sources: SourceConfig[]          // 订阅源列表
  proxyGroups: ProxyGroup[]        // 代理组列表
  ruleProviders: RuleProvider[]    // 规则集（预置 + 自定义）
  rules: Rule[]                    // 手动规则
  activeTab: TabId                 // 当前激活 Tab
  globalSettings: ClashGlobalSettings // 全局 + DNS 配置

  // ── 动作 ──────────────────────────────────
  addSource / updateSource / removeSource
  addProxyGroup / updateProxyGroup / removeProxyGroup
  addProxyToGroup / removeProxyFromGroup / reorderProxiesInGroup
  addRuleProvider / updateRuleProvider / removeRuleProvider / reorderRuleProviders
  addRule / removeRule / reorderRules
  updateProxy          // 重命名单个节点，自动同步代理组引用
  applyPrefixToSource  // 给订阅源所有节点批量加前缀，同步代理组
  importSourceGroup    // 把订阅源中的 group 导入进 store
  updateGlobalSettings / updateDnsSettings / updateDnsFallbackFilter
}
```

---

## Immer Middleware 用法

```ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useAppStore = create<AppState>()(
  immer((set, get) => ({
    sources: [],
    // ...
    updateSource: (id, updates) =>
      set((state) => {
        const s = state.sources.find((s) => s.id === id)
        if (s) Object.assign(s, updates)   // 直接 mutation，Immer 负责生成新对象
      }),
  }))
)
```

**核心原理**：Immer 在 `set()` 回调内提供一个 Proxy 对象，记录所有 mutation，生成新的 immutable state，无需手写展开（`{ ...state, sources: [...] }`）。

---

## 级联更新模式

代理组重命名时，需要同步到：
1. 所有其他代理组的 `proxies[]` 引用
2. 所有规则的 `target` 字段
3. 所有规则集的 `target` 字段

```ts
updateProxyGroup: (id, updates) =>
  set((state) => {
    const group = state.proxyGroups.find((g) => g.id === id)
    if (!group) return
    const oldName = group.name
    Object.assign(group, updates)
    const newName = group.name

    if (oldName !== newName) {
      // 1. 其他代理组的 proxies 引用
      state.proxyGroups.forEach((g) => {
        g.proxies = g.proxies.map((p) => (p === oldName ? newName : p))
      })
      // 2. 规则 target
      state.rules.forEach((r) => {
        if (r.target === oldName) r.target = newName
      })
      // 3. 规则集 target
      state.ruleProviders.forEach((rp) => {
        if (rp.target === oldName) rp.target = newName
      })
    }
  }),
```

**删除代理组**时，所有引用回退到 `DIRECT`（安全 fallback）：

```ts
removeProxyGroup: (id) =>
  set((state) => {
    const name = state.proxyGroups.find((g) => g.id === id)?.name
    state.proxyGroups = state.proxyGroups.filter((g) => g.id !== id)
    // 移除其他组对该组的引用
    state.proxyGroups.forEach((g) => {
      g.proxies = g.proxies.filter((p) => p !== name)
    })
    // 规则回退
    state.rules.forEach((r) => { if (r.target === name) r.target = 'DIRECT' })
    state.ruleProviders.forEach((rp) => { if (rp.target === name) rp.target = 'DIRECT' })
  }),
```

---

## 节点重命名级联

订阅源节点改名时同步代理组中的引用：

```ts
updateProxy: (sourceId, idx, updates) =>
  set((state) => {
    const source = state.sources.find((s) => s.id === sourceId)
    if (!source) return
    const proxy = source.proxies[idx]
    const oldName = proxy.name
    Object.assign(proxy, updates)
    const newName = proxy.name

    if (oldName !== newName) {
      state.proxyGroups.forEach((g) => {
        g.proxies = g.proxies.map((p) => (p === oldName ? newName : p))
      })
    }
  }),
```

---

## ID 生成

```ts
const generateId = () => Math.random().toString(36).slice(2, 10)
```

简单够用，8 位随机 base-36 字符串，碰撞率极低（~1/2.8万亿），无需引入 uuid 库。

---

## 组件订阅示例

```ts
// 只订阅 proxyGroups，sources 变化不触发重渲染
const proxyGroups = useAppStore((s) => s.proxyGroups)

// 订阅多个字段（浅比较）
const { sources, proxyGroups } = useAppStore()
```

Zustand 默认用 `Object.is` 做 selector 结果对比，精准控制重渲染。
