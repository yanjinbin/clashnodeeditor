# 可复用技术模式

项目中反复出现的技术模式，可直接迁移到其他项目。

---

## 1. Emoji Favicon（零文件）

```html
<!-- index.html -->
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>" />
```

适用场景：内部工具、原型项目、快速迭代，无需设计师提供图标文件。

---

## 2. Draft 模式表单输入

输入过程不触发副作用，失焦/确认键才提交：

```ts
const [draft, setDraft] = useState(value)
const [error, setError] = useState('')

const commit = () => {
  const trimmed = draft.trim()
  if (!validate(trimmed)) { setError('...'); return }
  if (trimmed !== value) onCommit(trimmed)
}

<input
  value={draft}
  onChange={(e) => { setDraft(e.target.value); setError('') }}
  onBlur={commit}
  onKeyDown={(e) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setDraft(value); setError('') }
  }}
/>
```

---

## 3. Zustand + Immer 级联更新

重命名时同步所有引用：

```ts
const useStore = create<State>()(immer((set) => ({
  rename: (oldName, newName) => set((state) => {
    // 更新所有使用 oldName 的地方
    state.items.forEach((item) => {
      item.refs = item.refs.map((r) => r === oldName ? newName : r)
    })
  }),
})))
```

---

## 4. 模块级缓存（跨组件共享）

```ts
// utils/cache.ts
const cache = new Map<string, { data: unknown; ts: number }>()
const TTL = 30 * 60 * 1000

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < TTL) return entry.data as T
  return null
}

export function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() })
}
```

适用于：API 结果缓存（不需要持久化，页面刷新后重新获取即可）。

---

## 5. 懒加载 + Portal 浮层

```tsx
const [Component, setComponent] = useState<React.ComponentType | null>(null)

const open = async () => {
  if (!Component) {
    const { default: C } = await import('heavy-library')
    setComponent(() => C)
  }
  setVisible(true)
}

// 渲染到 body，避免被父容器 overflow:hidden 裁切
return visible && Component
  ? createPortal(<Component />, document.body)
  : null
```

---

## 6. CORS 代理 Edge Function

```ts
// api/proxy.ts — 通用模板
export default async function handler(req, res) {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'Missing url' })

  try { new URL(url) } catch { return res.status(400).json({ error: 'Invalid url' }) }

  const upstream = await fetch(url, { headers: { 'User-Agent': req.headers['x-ua'] ?? 'bot/1.0' } })
  res.status(upstream.status)
     .setHeader('Content-Type', upstream.headers.get('Content-Type') ?? 'text/plain')
     .send(await upstream.text())
}
```

---

## 7. @dnd-kit 排序列表最小实现

```tsx
import { DndContext, closestCenter, PointerSensor, useSensor } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      {id}
    </div>
  )
}

function SortableList({ items, onReorder }: { items: string[], onReorder: (items: string[]) => void }) {
  const sensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })

  return (
    <DndContext sensors={[sensor]} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
      if (!over || active.id === over.id) return
      const oldIdx = items.indexOf(active.id as string)
      const newIdx = items.indexOf(over.id as string)
      onReorder(arrayMove(items, oldIdx, newIdx))
    }}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((id) => <SortableItem key={id} id={id} />)}
      </SortableContext>
    </DndContext>
  )
}
```

---

## 8. js-yaml dump 配置

```ts
import yaml from 'js-yaml'

yaml.dump(config, {
  lineWidth: -1,        // 禁止自动折行（避免折断 URL）
  noRefs: true,         // 不输出 YAML 引用语法（&anchor / *alias）
  sortKeys: false,      // 保留键顺序（不按字母排序）
})
```

---

## 9. min-h-0 Flex 内部滚动布局

```tsx
// 父容器
<div className="flex flex-col h-screen">
  <header className="shrink-0 h-12">...</header>
  <main className="flex-1 min-h-0 overflow-hidden">
    {/* 内部可滚动的子区域 */}
    <div className="h-full overflow-y-auto">...</div>
  </main>
</div>
```

**原理**：Flex 子项 `min-height` 默认为 `auto`（内容高度），会撑开父容器。`min-h-0` 覆盖为 `0`，允许 `flex-1` 子项真正收缩并通过 `overflow-y-auto` 内部滚动。

---

## 10. TypeScript 灵活字段类型

```ts
interface Proxy {
  name: string
  type: string
  server?: string
  port?: number
  // 未知协议字段的兜底
  [key: string]: unknown
}
```

`[key: string]: unknown` 比 `any` 更安全：访问未知字段得到 `unknown`，需要类型收窄才能使用，不会意外传播 `any` 类型。
