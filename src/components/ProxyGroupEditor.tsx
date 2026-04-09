import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus,
  Trash2,
  GripVertical,
  Settings,
  ChevronDown,
  ChevronRight,
  X,
  Users,
  CheckSquare,
  Square,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { ProxyGroup, ProxyGroupType } from '../types/clash'
import { BUILT_IN_PROXIES } from '../types/clash'
import EmojiPicker from './EmojiPicker'

const GROUP_TYPES: { value: ProxyGroupType; label: string; desc: string }[] = [
  { value: 'select', label: 'select', desc: '手动选择' },
  { value: 'url-test', label: 'url-test', desc: '自动测速' },
  { value: 'fallback', label: 'fallback', desc: '自动回退' },
  { value: 'load-balance', label: 'load-balance', desc: '负载均衡' },
  { value: 'relay', label: 'relay', desc: '链式代理' },
]

export default function ProxyGroupEditor() {
  const { sources, proxyGroups, addProxyGroup, removeProxyGroup, updateProxyGroup, addProxyToGroup, removeProxyFromGroup, reorderProxiesInGroup } =
    useAppStore()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Grouped sections for the proxy picker — no built-in presets
  const proxySections = [
    { label: '代理组', items: proxyGroups.map((g) => g.name) },
    ...sources
      .filter((s) => s.proxies.length > 0)
      .map((s) => ({ label: s.name, items: s.proxies.map((p) => p.name) })),
  ].filter((s) => s.items.length > 0)

  const toggleExpand = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const listRef = useRef<HTMLDivElement>(null)

  const handleAddGroup = () => {
    const id = addProxyGroup({
      name: `Group${proxyGroups.length + 1}`,
      type: 'select',
      proxies: [],
      url: 'http://www.gstatic.com/generate_204',
      interval: 300,
    })
    setExpandedGroups((prev) => new Set([...prev, id]))
    setEditingGroup(id)
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string ?? null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent, groupId: string, proxies: string[]) => {
      const { active, over } = event
      setActiveId(null)
      setOverId(null)
      if (!over || active.id === over.id) return
      const oldIndex = proxies.indexOf(active.id as string)
      const newIndex = proxies.indexOf(over.id as string)
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderProxiesInGroup(groupId, oldIndex, newIndex)
      }
    },
    [reorderProxiesInGroup]
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          代理组配置
        </h2>
        <button
          onClick={handleAddGroup}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
        >
          <Plus size={13} />
          新建分组
        </button>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {proxyGroups.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p>点击"新建分组"开始配置</p>
          </div>
        )}
        {proxyGroups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            expanded={expandedGroups.has(group.id)}
            editing={editingGroup === group.id}
            proxySections={proxySections}
            existingNames={proxyGroups.filter((g) => g.id !== group.id).map((g) => g.name)}
            onToggleExpand={() => toggleExpand(group.id)}
            onEdit={() => setEditingGroup(editingGroup === group.id ? null : group.id)}
            onRemove={() => removeProxyGroup(group.id)}
            onUpdate={(updates) => updateProxyGroup(group.id, updates)}
            onAddProxy={(name) => addProxyToGroup(group.id, name)}
            onRemoveProxy={(name) => removeProxyFromGroup(group.id, name)}
            onReorder={(oldIdx, newIdx) => reorderProxiesInGroup(group.id, oldIdx, newIdx)}
            sensors={sensors}
            activeId={activeId}
            overId={overId}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={(e) => handleDragEnd(e, group.id, group.proxies)}
          />
        ))}
      </div>
    </div>
  )
}

interface ProxySection {
  label: string
  items: string[]
}

interface GroupCardProps {
  group: ProxyGroup
  expanded: boolean
  editing: boolean
  proxySections: ProxySection[]
  /** 其他代理组的名称列表，用于重名校验 */
  existingNames: string[]
  onToggleExpand: () => void
  onEdit: () => void
  onRemove: () => void
  onUpdate: (updates: Partial<ProxyGroup>) => void
  onAddProxy: (name: string) => void
  onRemoveProxy: (name: string) => void
  onReorder: (oldIndex: number, newIndex: number) => void
  sensors: ReturnType<typeof useSensors>
  activeId: string | null
  overId: string | null
  onDragStart: (e: DragStartEvent) => void
  onDragOver: (e: DragOverEvent) => void
  onDragEnd: (e: DragEndEvent) => void
}

function GroupCard({
  group,
  expanded,
  editing,
  proxySections,
  existingNames,
  onToggleExpand,
  onEdit,
  onRemove,
  onUpdate,
  onAddProxy,
  onRemoveProxy,
  sensors,
  activeId,
  onDragStart,
  onDragOver,
  onDragEnd,
}: GroupCardProps) {
  const [proxySearch, setProxySearch] = useState('')
  const [showProxyPicker, setShowProxyPicker] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [nameDraft, setNameDraft] = useState(group.name)
  const [nameError, setNameError] = useState('')

  // 编辑面板打开时重置草稿，避免上次未提交的内容残留
  useEffect(() => {
    if (editing) {
      setNameDraft(group.name)
      setNameError('')
    }
  }, [editing, group.name])

  const commitName = () => {
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setNameError('名称不能为空')
      setNameDraft(group.name)
      setNameError('')
      return
    }
    if (existingNames.includes(trimmed)) {
      setNameError(`"${trimmed}" 已被其他代理组使用`)
      return
    }
    setNameError('')
    if (trimmed !== group.name) onUpdate({ name: trimmed })
  }
  // Batch select for picker (add)
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set())
  // Batch select for existing proxies (remove)
  const [removeSelected, setRemoveSelected] = useState<Set<string>>(new Set())

  const togglePickerItem = (name: string) => {
    setPickerSelected((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const toggleSectionAll = (items: string[]) => {
    const allChecked = items.every((n) => pickerSelected.has(n))
    setPickerSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) { items.forEach((n) => next.delete(n)) }
      else { items.forEach((n) => next.add(n)) }
      return next
    })
  }

  const handleBatchAdd = () => {
    for (const name of pickerSelected) onAddProxy(name)
    setPickerSelected(new Set())
    setProxySearch('')
    setShowProxyPicker(false)
  }

  const toggleRemoveItem = (name: string) => {
    setRemoveSelected((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const handleBatchRemove = () => {
    for (const name of removeSelected) onRemoveProxy(name)
    setRemoveSelected(new Set())
  }

  const allRemoveSelected = group.proxies.length > 0 && group.proxies.every((p) => removeSelected.has(p))
  const toggleRemoveAll = () => {
    setRemoveSelected(allRemoveSelected ? new Set() : new Set(group.proxies))
  }

  const typeColor: Record<ProxyGroupType, string> = {
    select: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'url-test': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    fallback: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    'load-balance': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    relay: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  }

  const q = proxySearch.toLowerCase()
  const filteredSections = proxySections
    .map((s) => ({
      ...s,
      items: s.items.filter((n) => n !== group.name && !group.proxies.includes(n) && (!q || n.toLowerCase().includes(q))),
    }))
    .filter((s) => s.items.length > 0)

  // All items visible in current filtered picker
  const allFilteredItems = filteredSections.flatMap((s) => s.items)
  const allFilteredSelected = allFilteredItems.length > 0 && allFilteredItems.every((n) => pickerSelected.has(n))

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={onToggleExpand} className="text-gray-400 hover:text-gray-600 transition-colors">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[group.type]}`}>
          {group.type}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{group.name}</span>
        {group.autoAllNodes ? (
          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0">自动全部节点</span>
        ) : (
          <span className="text-xs text-gray-400">{group.proxies.length} 个节点</span>
        )}
        <button onClick={onEdit} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors">
          <Settings size={13} />
        </button>
        <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Edit settings */}
      {editing && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">分组名称</label>
              <div className="flex items-center gap-1">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameDraft}
                  onChange={(e) => { setNameDraft(e.target.value); setNameError('') }}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitName() }
                    if (e.key === 'Escape') { setNameDraft(group.name); setNameError(''); nameInputRef.current?.blur() }
                  }}
                  className={`flex-1 text-sm px-2 py-1.5 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 ${
                    nameError
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                />
                <EmojiPicker
                  inputRef={nameInputRef}
                  value={nameDraft}
                  onChange={(v) => { setNameDraft(v); setNameError('') }}
                  onSelect={(e) => { setNameDraft((d) => d + e); setNameError('') }}
                />
              </div>
              {nameError && (
                <p className="text-xs text-red-500 mt-1">{nameError}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">类型</label>
              <select
                value={group.type}
                onChange={(e) => onUpdate({ type: e.target.value as ProxyGroupType })}
                className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {GROUP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                ))}
              </select>
            </div>
          </div>
          {group.type !== 'select' && group.type !== 'relay' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">测速 URL</label>
                <input
                  type="text"
                  value={group.url ?? ''}
                  onChange={(e) => onUpdate({ url: e.target.value })}
                  className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">间隔(秒)</label>
                <input
                  type="number"
                  value={group.interval ?? 300}
                  onChange={(e) => onUpdate({ interval: Number(e.target.value) })}
                  className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proxy list with DnD — always batch-select mode */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {/* Batch remove toolbar */}
          {group.proxies.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-700/20">
              <button onClick={toggleRemoveAll} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                {allRemoveSelected
                  ? <CheckSquare size={12} className="text-red-500" />
                  : <Square size={12} />}
                全选
              </button>
              <span className="text-xs text-gray-400">
                {removeSelected.size > 0 ? `已选 ${removeSelected.size} 个` : `共 ${group.proxies.length} 个`}
              </span>
              <button
                onClick={handleBatchRemove}
                disabled={removeSelected.size === 0}
                className="ml-auto text-xs px-2 py-0.5 rounded bg-red-500 hover:bg-red-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white transition-colors"
              >
                取消选中 {removeSelected.size > 0 ? `(${removeSelected.size})` : ''}
              </button>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={group.proxies} strategy={verticalListSortingStrategy}>
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
                {group.proxies.length === 0 && (
                  <p className="text-center py-4 text-xs text-gray-400">暂无节点，点击下方批量添加</p>
                )}
                {group.proxies.map((proxyName) => (
                  <SortableProxyItem
                    key={proxyName}
                    id={proxyName}
                    active={activeId === proxyName}
                    selected={removeSelected.has(proxyName)}
                    onToggleSelect={() => toggleRemoveItem(proxyName)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded shadow-lg text-sm opacity-90">
                  <GripVertical size={13} className="text-blue-400" />
                  <span className="text-gray-900 dark:text-gray-100">{activeId}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Batch add proxy picker */}
          <div className="p-2 border-t border-gray-100 dark:border-gray-700">
            {showProxyPicker ? (
              <div className="space-y-1.5">
                {/* Search + close */}
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="搜索节点 / 代理组..."
                    value={proxySearch}
                    onChange={(e) => setProxySearch(e.target.value)}
                    autoFocus
                    className="flex-1 text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => { setShowProxyPicker(false); setProxySearch(''); setPickerSelected(new Set()) }}
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Toolbar: select all filtered + add */}
                <div className="flex items-center gap-2 px-0.5">
                  <button
                    onClick={() => {
                      if (allFilteredSelected) {
                        setPickerSelected((prev) => {
                          const next = new Set(prev)
                          allFilteredItems.forEach((n) => next.delete(n))
                          return next
                        })
                      } else {
                        setPickerSelected((prev) => new Set([...prev, ...allFilteredItems]))
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {allFilteredSelected
                      ? <CheckSquare size={12} className="text-blue-500" />
                      : <Square size={12} />}
                    全选筛选结果
                  </button>
                  <span className="text-xs text-gray-400 ml-1">
                    {pickerSelected.size > 0 ? `已选 ${pickerSelected.size} 个` : ''}
                  </span>
                  <button
                    onClick={handleBatchAdd}
                    disabled={pickerSelected.size === 0}
                    className="ml-auto text-xs px-2 py-0.5 rounded bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white transition-colors"
                  >
                    批量添加 {pickerSelected.size > 0 ? `(${pickerSelected.size})` : ''}
                  </button>
                </div>

                {/* List */}
                <div className="max-h-52 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
                  {filteredSections.length === 0 && (
                    <p className="text-center py-3 text-xs text-gray-400">
                      {proxySections.length === 0 ? '请先在订阅源页面导入节点' : '无匹配节点'}
                    </p>
                  )}
                  {filteredSections.map((section) => {
                    const sectionAllChecked = section.items.every((n) => pickerSelected.has(n))
                    return (
                      <div key={section.label}>
                        <div className="sticky top-0 flex items-center gap-2 px-3 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                          <button
                            onClick={() => toggleSectionAll(section.items)}
                            className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 uppercase tracking-wide transition-colors"
                          >
                            {sectionAllChecked
                              ? <CheckSquare size={11} className="text-blue-500" />
                              : <Square size={11} />}
                            {section.label}
                          </button>
                          <span className="text-xs text-gray-300 dark:text-gray-600">{section.items.length}</span>
                        </div>
                        {section.items.map((name) => {
                          const checked = pickerSelected.has(name)
                          return (
                            <div
                              key={name}
                              onClick={() => togglePickerItem(name)}
                              className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0 ${
                                checked
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                              }`}
                            >
                              {checked
                                ? <CheckSquare size={12} className="shrink-0 text-blue-500" />
                                : <Square size={12} className="shrink-0 text-gray-300" />}
                              <span className="flex-1 truncate">{name}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowProxyPicker(true)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors border border-dashed border-blue-300 dark:border-blue-700"
              >
                <Plus size={12} />
                批量添加节点 / 代理组
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SortableProxyItem({
  id, active, selected, onToggleSelect,
}: {
  id: string
  active: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onToggleSelect}
      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
        selected ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      } ${active ? 'ring-1 ring-blue-400' : ''}`}
    >
      {/* Drag handle — stop propagation so click-to-select doesn't fire on drag */}
      <button
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors shrink-0"
      >
        <GripVertical size={13} />
      </button>
      <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">{id}</span>
      {selected
        ? <CheckSquare size={13} className="shrink-0 text-red-500" />
        : <Square size={13} className="shrink-0 text-gray-300" />}
    </div>
  )
}
