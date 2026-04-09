# 组件原理与实现详解

## 1. App.tsx — 根组件与 Tab 路由

### 布局模式

```tsx
<div className="flex flex-col h-screen">
  <header>  {/* 固定高度，Tab 导航 */}
    <nav>…</nav>
  </header>
  <main className="flex-1 min-h-0 overflow-hidden">
    {activeTab === 'sources'  && <SourceManager />}
    {activeTab === 'groups'   && <ProxyGroupEditor />}
    {activeTab === 'rules'    && <RuleSetManager />}
    {activeTab === 'preview'  && <ConfigPreview />}
  </main>
</div>
```

**`min-h-0` 的作用**：Flex 子项默认 `min-height: auto`，内容溢出时不收缩。加 `min-h-0` 允许 `flex-1` 子项真正填满并在内部滚动，而不撑开父容器。

### Tab 按钮模式

```tsx
const tabs = [
  { id: 'sources', icon: Globe,  label: '订阅源' },
  { id: 'groups',  icon: Users,  label: '代理组' },
  // ...
]

{tabs.map(({ id, icon: Icon, label }) => (
  <button
    key={id}
    onClick={() => setActiveTab(id)}
    className={activeTab === id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}
  >
    <Icon size={16} />
    <span>{label}</span>
  </button>
))}
```

---

## 2. SourceManager.tsx — 订阅源管理

### 状态设计

```
组件本地状态（UI 交互临时）：
  urlInput, nameInput, uaInput — 表单输入
  expandedSources — 展开的源 Set<id>
  renamingProxy — 当前正在改名的节点 { sourceId, proxyIndex }

全局状态（持久化）：
  sources[] ← useAppStore
```

### 拉取订阅流程

```
用户输入 URL
  → addSource(id) 到 store（status: 'idle'）
  → loadSource(id, url)
      → updateSource(id, { status: 'loading' })
      → fetchAndParseYaml(url, ua)   ← 经由 /api/proxy 绕 CORS
      → updateSource(id, { status: 'success', proxies, importedGroups })
  ← 组件订阅 sources，自动重渲染展示节点列表
```

### 重名检测

跨源节点名冲突检测，O(n) 构建 Map：

```ts
const allNames = new Map<string, string>()  // name → sourceId
sources.forEach((s) => {
  s.proxies.forEach((p) => {
    if (allNames.has(p.name) && allNames.get(p.name) !== s.id) {
      // 标记为重复
    }
    allNames.set(p.name, s.id)
  })
})
```

### 前缀批量应用

```ts
applyPrefixToSource(sourceId, prefix):
  1. 构建旧名 → 新名的映射表 Map<oldName, newName>
  2. 更新 source.proxies[].name
  3. 遍历 source.importedGroups[].proxies，同步节点引用
  4. 遍历 store.proxyGroups[].proxies，把旧名替换为新名
     （还要同步 importedGroups 中的 group 名）
```

---

## 3. ProxyGroupEditor.tsx — 代理组配置

### GroupCard 组件设计

每个代理组是独立的 `GroupCard`，接受所有 props，内部维护少量 UI 状态：

```ts
interface GroupCardProps {
  group: ProxyGroup           // 数据（来自 store）
  proxySections: ProxySection[] // 可用节点列表（代理组名 + 各源节点名）
  expanded / editing: boolean   // UI 状态（由父管理）
  onToggleExpand / onEdit / onRemove / onUpdate
  onAddProxy / onRemoveProxy / onReorder
  sensors / activeId / overId / onDragStart / onDragOver / onDragEnd
}

// 组件内本地 UI 状态
const [showProxyPicker, setShowProxyPicker] = useState(false)
const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set())
const [proxySearch, setProxySearch] = useState('')
const [nameDraft, setNameDraft] = useState(group.name)  // draft 模式
```

### Draft 模式重命名

不直接修改 store，先修改本地 draft，失焦/回车时才提交：

```ts
const commitName = () => {
  const trimmed = nameDraft.trim()
  if (existingNames.includes(trimmed)) {
    setNameError('名称已存在')   // 阻止提交
    return
  }
  if (trimmed !== group.name) onUpdate({ name: trimmed })  // 提交到 store
}
```

**好处**：输入过程中不触发级联更新，避免中间状态污染其他组件。

### autoAllNodes 机制

```ts
// 初始化默认 ♻️ 自动选择组时
{ name: '♻️ 自动选择', type: 'url-test', proxies: [], autoAllNodes: true }

// ConfigPreview 生成 YAML 时展开
proxies: g.autoAllNodes ? allProxyNames : g.proxies

// ProxyGroupEditor 展开时显示（读写分离）
// group.proxies 保持 [] 不变，UI 从 proxySections 中过滤出 source 节点展示
const sourceOnlySections = proxySections.filter((s) => s.label !== '代理组')
```

**设计意图**：`autoAllNodes` 是一种"虚拟引用"——不存储具体节点列表，每次生成配置时动态展开。这样新增订阅源后自动生效，无需手动添加。

### @dnd-kit 拖拽实现

```tsx
<DndContext
  sensors={sensors}           // PointerSensor + KeyboardSensor
  collisionDetection={closestCenter}
  onDragStart={onDragStart}
  onDragEnd={onDragEnd}
>
  <SortableContext
    items={group.proxies}     // string[] 作为 id 数组
    strategy={verticalListSortingStrategy}
  >
    {group.proxies.map((name) => (
      <SortableProxyItem key={name} id={name} />
    ))}
  </SortableContext>
  <DragOverlay>
    {activeId && <DraggingPreview id={activeId} />}
  </DragOverlay>
</DndContext>
```

`SortableProxyItem` 内部使用 `useSortable(id)` hook 获取 `attributes / listeners / setNodeRef / transform / transition`。

**ActivationConstraint**（防误触）：

```ts
useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
// 拖动 5px 后才激活，避免点击触发拖拽
```

### 节点选择 Picker

过滤逻辑（同时排除已添加 + 搜索关键字 + 国家/类型过滤）：

```ts
const filteredSections = proxySections
  .map((s) => ({
    ...s,
    items: s.items.filter((n) => {
      if (n === group.name || group.proxies.includes(n)) return false  // 已添加
      if (q && !n.toLowerCase().includes(q)) return false              // 搜索
      if (ipd && filterCountry && ipd.countryCode !== filterCountry) return false
      if (ipd && filterType !== 'all') { /* 类型过滤 */ }
      return true
    }),
  }))
  .filter((s) => s.items.length > 0)
```

---

## 4. RuleSetManager.tsx — 规则配置

### 三层结构

```
规则集（rule-providers）
  ├── 预置 Loyalsoldier（13 个）
  ├── 预置 blackmatrix7（13 个）
  └── 自定义（CRUD）

手动规则（rules）
  └── DOMAIN / DOMAIN-SUFFIX / IP-CIDR / GEOIP / MATCH

AI 快速配置
  └── 一键启用 OpenAI / Claude / Gemini / Copilot 规则集
```

### GitHub URL 转 jsDelivr

```ts
// src/utils/parseYaml.ts
export function normalizeRuleUrl(url: string): string {
  // https://github.com/user/repo/blob/main/rules/xxx.yaml
  // → https://cdn.jsdelivr.net/gh/user/repo@main/rules/xxx.yaml
  return url.replace(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(blob|tree)\/([^/]+)\/(.*)/,
    'https://cdn.jsdelivr.net/gh/$1/$2@$4/$5'
  )
}
```

**为什么**：GitHub raw 文件有速率限制且国内访问不稳定；jsDelivr 是全球 CDN，免费且稳定。

### 行为推断

```ts
export function inferBehavior(url: string) {
  const lower = url.toLowerCase()
  if (lower.includes('cidr')) return 'ipcidr'
  if (lower.includes('classical') || lower.includes('application')) return 'classical'
  return 'domain'
}
```

---

## 5. ConfigPreview.tsx — 实时预览

### Split 布局

```tsx
<div className="flex h-full">
  <div className="w-80 shrink-0 overflow-y-auto border-r">
    {/* 全局设置面板 */}
  </div>
  <div className="flex-1 min-w-0 flex flex-col">
    {/* YAML 预览 */}
    <pre className={softWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'}>
      {configYaml}
    </pre>
  </div>
</div>
```

### YAML 生成

```ts
export function generateClashConfig(proxies, proxyGroups, ruleProviders, rules, globalSettings) {
  const config: ClashConfig = {
    ...globalSettings,
    proxies,
    'proxy-groups': proxyGroups.map(g => ({
      name: g.name,
      type: g.type,
      proxies: g.autoAllNodes ? allProxyNames : g.proxies,
      // ...
    })),
    'rule-providers': Object.fromEntries(
      enabledProviders.map(p => [p.name, { type: p.type, behavior: p.behavior, url: p.url, ... }])
    ),
    rules: [
      ...enabledProviders.map(p => `RULE-SET,${p.name},${p.target}`),
      ...rules.map(r => r.type === 'MATCH' ? 'MATCH,${r.target}' : `${r.type},${r.payload},${r.target}`),
    ],
  }
  return yaml.dump(config, { lineWidth: -1 })  // lineWidth: -1 禁止自动折行
}
```

### YAML 验证

```ts
const yamlValidation = useMemo(() => {
  try {
    yaml.load(configYaml)
    return { valid: true, error: undefined }
  } catch (e) {
    return { valid: false, error: (e as Error).message }
  }
}, [configYaml])
```

用 `useMemo` 包裹，只在 `configYaml` 变化时重新解析，避免每次渲染都执行 YAML 解析。

---

## 6. EmojiPicker.tsx — 懒加载 Portal 组件

### 懒加载

```ts
const [EmojiMartPicker, setEmojiMartPicker] = useState<any>(null)

const loadPicker = async () => {
  if (EmojiMartPicker) return
  const [{ default: Picker }, { default: data }] = await Promise.all([
    import('@emoji-mart/react'),
    import('@emoji-mart/data'),
  ])
  // 初始化 data
  await init(data)
  setEmojiMartPicker(() => Picker)
}
```

首次点击才加载 ~400 KB 的 emoji-mart，不影响首屏性能。

### Portal 定位

```tsx
// 渲染到 document.body 外层，避免被 overflow:hidden 父容器裁切
createPortal(
  <div
    style={{
      position: 'fixed',
      top: rect.bottom + 4,   // 按钮下方 4px
      left: rect.left,
      zIndex: 9999,
    }}
  >
    <EmojiMartPicker onEmojiSelect={handleSelect} />
  </div>,
  document.body
)
```

### 光标位置插入

```ts
const handleSelect = (emoji: { native: string }) => {
  if (inputRef?.current) {
    const el = inputRef.current
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    // 在光标位置插入表情，保留前后文本
    const newVal = el.value.slice(0, start) + emoji.native + el.value.slice(end)
    onChange(newVal)
    // 恢复光标位置
    setTimeout(() => {
      el.setSelectionRange(start + emoji.native.length, start + emoji.native.length)
      el.focus()
    })
  } else {
    onSelect?.(emoji.native)
  }
}
```
