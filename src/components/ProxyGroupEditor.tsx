import { useState, useCallback, useRef } from 'react'
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

  const allProxyNames = [
    ...BUILT_IN_PROXIES,
    ...proxyGroups.map((g) => g.name),
    ...sources.flatMap((s) => s.proxies.map((p) => p.name)),
  ]

  const toggleExpand = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleAddGroup = () => {
    addProxyGroup({
      name: `Group${proxyGroups.length + 1}`,
      type: 'select',
      proxies: ['DIRECT'],
      url: 'http://www.gstatic.com/generate_204',
      interval: 300,
    })
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

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
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
            allProxyNames={allProxyNames}
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

interface GroupCardProps {
  group: ProxyGroup
  expanded: boolean
  editing: boolean
  allProxyNames: string[]
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
  allProxyNames,
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

  const typeColor: Record<ProxyGroupType, string> = {
    select: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'url-test': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    fallback: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    'load-balance': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    relay: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  }

  const filteredProxies = allProxyNames.filter(
    (n) => !group.proxies.includes(n) && n.toLowerCase().includes(proxySearch.toLowerCase())
  )

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
        <span className="text-xs text-gray-400">{group.proxies.length} 个节点</span>
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
                  value={group.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  className="flex-1 text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <EmojiPicker
                  inputRef={nameInputRef}
                  value={group.name}
                  onChange={(v) => onUpdate({ name: v })}
                  onSelect={(e) => onUpdate({ name: group.name + e })}
                />
              </div>
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

      {/* Proxy list with DnD */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={group.proxies} strategy={verticalListSortingStrategy}>
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
                {group.proxies.map((proxyName) => (
                  <SortableProxyItem
                    key={proxyName}
                    id={proxyName}
                    active={activeId === proxyName}
                    onRemove={() => onRemoveProxy(proxyName)}
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

          {/* Add proxy picker */}
          <div className="p-2 border-t border-gray-100 dark:border-gray-700">
            {showProxyPicker ? (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="搜索节点..."
                    value={proxySearch}
                    onChange={(e) => setProxySearch(e.target.value)}
                    autoFocus
                    className="flex-1 text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button onClick={() => { setShowProxyPicker(false); setProxySearch('') }} className="p-1.5 text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto rounded border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {filteredProxies.length === 0 && (
                    <p className="text-center py-3 text-xs text-gray-400">无匹配节点</p>
                  )}
                  {filteredProxies.slice(0, 50).map((name) => (
                    <button
                      key={name}
                      onClick={() => { onAddProxy(name); setProxySearch('') }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowProxyPicker(true)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors border border-dashed border-blue-300 dark:border-blue-700"
              >
                <Plus size={12} />
                添加节点
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SortableProxyItem({ id, active, onRemove }: { id: string; active: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const isBuiltIn = BUILT_IN_PROXIES.includes(id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-1.5 group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${active ? 'ring-1 ring-blue-400' : ''}`}
    >
      <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors">
        <GripVertical size={13} />
      </button>
      <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">{id}</span>
      {isBuiltIn && (
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded">内置</span>
      )}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all"
      >
        <X size={11} />
      </button>
    </div>
  )
}
