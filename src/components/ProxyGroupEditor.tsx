import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
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
  Loader,
  Globe,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { ProxyGroup, ProxyGroupType } from '../types/clash'
import { BUILT_IN_PROXIES } from '../types/clash'
import EmojiPicker from './EmojiPicker'
import { resolveToIp, fetchIpInfoBatch, type IpData } from '../utils/ipUtils'

const GROUP_TYPES: { value: ProxyGroupType; label: string; desc: string }[] = [
  { value: 'select', label: 'select', desc: '手动选择' },
  { value: 'url-test', label: 'url-test', desc: '自动测速' },
  { value: 'fallback', label: 'fallback', desc: '自动回退' },
  { value: 'load-balance', label: 'load-balance', desc: '负载均衡' },
  { value: 'relay', label: 'relay', desc: '链式代理' },
]

export default function ProxyGroupEditor() {
  const { sources, manualProxies, proxyGroups, addProxyGroup, removeProxyGroup, updateProxyGroup, addProxyToGroup, removeProxyFromGroup, reorderProxiesInGroup, reorderProxyGroups, resetProxyGroups } =
    useAppStore()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Outer drag state — for reordering group cards
  const [outerActiveId, setOuterActiveId] = useState<string | null>(null)

  // Grouped sections for the proxy picker — no built-in presets
  const proxySections = [
    { label: '代理组', items: proxyGroups.map((g) => g.name) },
    ...(manualProxies.length > 0 ? [{ label: '手动节点', items: manualProxies.map((p) => p.name) }] : []),
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
  const [showPresets, setShowPresets] = useState(false)
  const presetsRef = useRef<HTMLDivElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const confirmResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleResetClick = () => {
    if (confirmReset) {
      resetProxyGroups()
      setConfirmReset(false)
      if (confirmResetTimer.current) clearTimeout(confirmResetTimer.current)
    } else {
      setConfirmReset(true)
      confirmResetTimer.current = setTimeout(() => setConfirmReset(false), 3000)
    }
  }

  const PRESETS: { icon: string; name: string; type: ProxyGroupType; interval?: number; tolerance?: number }[] = [
    { icon: '♻️', name: '自动选择', type: 'url-test', interval: 300, tolerance: 50 },
    { icon: '🌐', name: '节点选择', type: 'select' },
    { icon: '🛡️', name: '故障转移', type: 'fallback', interval: 300 },
    { icon: '📺', name: '油管', type: 'url-test', interval: 300, tolerance: 50 },
    { icon: '🐦', name: '社交媒体', type: 'fallback', interval: 300 },
    { icon: '🇺🇸', name: '美国住宅 IP 出口', type: 'select' },
    { icon: '🇯🇵', name: '日本住宅 IP 出口', type: 'select' },
  ]

  useEffect(() => {
    if (!showPresets) return
    const handler = (e: MouseEvent) => {
      if (!presetsRef.current?.contains(e.target as Node)) setShowPresets(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPresets])

  const handleAddPreset = (preset: typeof PRESETS[number]) => {
    setShowPresets(false)
    const id = addProxyGroup({
      name: `${preset.icon} ${preset.name}`,
      type: preset.type,
      proxies: [],
      url: 'http://www.gstatic.com/generate_204',
      interval: preset.interval ?? 300,
      ...(preset.tolerance !== undefined ? { tolerance: preset.tolerance } : {}),
    })
    setExpandedGroups((prev) => new Set([...prev, id]))
    setEditingGroup(id)
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

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
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          代理组配置
        </h2>
        <div className="flex items-center gap-2">
          {proxyGroups.length > 0 && (
            <button
              onClick={handleResetClick}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                confirmReset
                  ? 'bg-red-500 border-red-500 text-white hover:bg-red-600'
                  : 'border-red-200 dark:border-red-800/50 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
              }`}
            >
              <Trash2 size={11} />
              {confirmReset ? '确认重置？' : '重置'}
            </button>
          )}
          {/* 预设模板 */}
          <div className="relative" ref={presetsRef}>
            <button
              onClick={() => setShowPresets((v) => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-indigo-200 dark:border-indigo-700 hover:border-indigo-400 dark:hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-xl transition-all"
            >
              <ChevronDown size={13} className={`transition-transform ${showPresets ? 'rotate-180' : ''}`} />
              预设模板
            </button>
            {showPresets && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => handleAddPreset(p)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-700 dark:text-gray-300 transition-colors text-left"
                  >
                    <span className="text-sm shrink-0">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div>{p.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex gap-1.5">
                        <span>{p.type}</span>
                        {p.interval !== undefined && <span>· {p.interval}s</span>}
                        {p.tolerance !== undefined && <span>· ±{p.tolerance}ms</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAddGroup}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium rounded-xl shadow-sm shadow-indigo-200 dark:shadow-none transition-all"
          >
            <Plus size={14} />
            新建分组
          </button>
        </div>
      </div>

      <div ref={listRef} className="p-4 space-y-3">
        {proxyGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300 dark:text-gray-600">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Users size={28} className="opacity-60" />
            </div>
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">点击"新建分组"开始配置</p>
          </div>
        )}
        {/* ── Outer DnD: group card reordering ── */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setOuterActiveId(e.active.id as string)}
          onDragEnd={(e) => {
            setOuterActiveId(null)
            const { active, over } = e
            if (!over || active.id === over.id) return
            const oldIdx = proxyGroups.findIndex((g) => g.id === active.id)
            const newIdx = proxyGroups.findIndex((g) => g.id === over.id)
            if (oldIdx !== -1 && newIdx !== -1) reorderProxyGroups(oldIdx, newIdx)
          }}
        >
          <SortableContext items={proxyGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            {proxyGroups.map((group) => (
              <SortableGroupCard
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
          </SortableContext>
          <DragOverlay>
            {outerActiveId ? (
              <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 rounded-xl shadow-2xl opacity-90 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {proxyGroups.find((g) => g.id === outerActiveId)?.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
}

function SortableGroupCard(props: GroupCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.group.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <GroupCard {...props} dragHandleProps={{ ...listeners, ...attributes }} />
    </div>
  )
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
  dragHandleProps,
}: GroupCardProps) {
  const { sources } = useAppStore()
  const [proxySearch, setProxySearch] = useState('')
  const [showProxyPicker, setShowProxyPicker] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [nameDraft, setNameDraft] = useState(group.name)
  const [nameError, setNameError] = useState('')

  // IP 数据相关
  const [ipDataMap, setIpDataMap] = useState<Record<string, IpData>>({})
  const [ipFetchState, setIpFetchState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'hosting' | 'proxy' | 'residential'>('all')

  // proxy name → server 地址的查找表
  const serverByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const src of sources) {
      for (const p of src.proxies) {
        if (p.server) map.set(p.name, String(p.server))
      }
    }
    return map
  }, [sources])

  // 批量解析 IP 并拉取 ip-api 数据
  const handleFetchIps = async (proxyNames: string[]) => {
    setIpFetchState('loading')
    try {
      // 1. 并发解析域名 → IP
      const resolveResults = await Promise.allSettled(
        proxyNames.map(async (name) => {
          const server = serverByName.get(name) ?? ''
          const ip = await resolveToIp(server)
          return { name, ip }
        })
      )
      // 2. 建立 IP → [proxyName] 的映射（同一 IP 可能多个节点）
      const ipToNames = new Map<string, string[]>()
      for (const r of resolveResults) {
        if (r.status === 'fulfilled') {
          const { name, ip } = r.value
          ipToNames.set(ip, [...(ipToNames.get(ip) ?? []), name])
        }
      }
      const ips = [...ipToNames.keys()]
      if (ips.length === 0) { setIpFetchState('idle'); return }
      // 3. 批量拉取 ip-api 数据（每批最多 100）
      const all: IpData[] = []
      for (let i = 0; i < ips.length; i += 100) {
        const batch = ips.slice(i, i + 100)
        const data = await fetchIpInfoBatch(batch)
        all.push(...data)
      }
      // 4. 写回 ipDataMap（按 proxy name 索引）
      setIpDataMap((prev) => {
        const next = { ...prev }
        all.forEach((info, idx) => {
          for (const name of ipToNames.get(ips[idx]) ?? []) next[name] = info
        })
        return next
      })
      setIpFetchState('done')
    } catch {
      setIpFetchState('idle')
    }
  }

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
    select: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'url-test': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    fallback: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'load-balance': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    relay: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  }

  const q = proxySearch.toLowerCase()
  const filteredSections = proxySections
    .map((s) => ({
      ...s,
      items: s.items.filter((n) => {
        if (n === group.name || group.proxies.includes(n)) return false
        if (q && !n.toLowerCase().includes(q)) return false
        const ipd = ipDataMap[n]
        // 国家过滤（有 IP 数据才生效）
        if (ipd && filterCountry) {
          const cc = ipd.countryCode?.toUpperCase() ?? ''
          if (cc !== filterCountry.toUpperCase()) return false
        }
        // 类型过滤（有 IP 数据才生效）
        if (ipd && filterType !== 'all') {
          if (filterType === 'hosting' && !ipd.hosting) return false
          if (filterType === 'proxy' && !ipd.proxy) return false
          if (filterType === 'residential' && (ipd.hosting || ipd.proxy)) return false
        }
        return true
      }),
    }))
    .filter((s) => s.items.length > 0)

  // All items visible in current filtered picker
  const allFilteredItems = filteredSections.flatMap((s) => s.items)
  const allFilteredSelected = allFilteredItems.length > 0 && allFilteredItems.every((n) => pickerSelected.has(n))
  // Source-only sections (no proxy group names) for autoAllNodes display
  const sourceOnlySections = proxySections.filter((s) => s.label !== '代理组')

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        {/* Outer drag handle for group card reordering */}
        {dragHandleProps && (
          <button
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors shrink-0 touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </button>
        )}
        <button onClick={onToggleExpand} className="text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-0.5">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <span className={`text-xs px-2 py-0.5 rounded-lg font-medium font-mono ${typeColor[group.type]}`}>
          {group.type}
        </span>
        <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{group.name}</span>
        {group.autoAllNodes ? (
          <span className="text-xs px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0 font-medium border border-emerald-200 dark:border-emerald-800/50">自动全部节点</span>
        ) : (
          <span className="text-xs text-gray-400 font-mono">{group.proxies.length} 节点</span>
        )}
        <button onClick={onEdit} className="p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all">
          <Settings size={14} />
        </button>
        <button onClick={onRemove} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Edit settings */}
      {editing && (
        <div className="border-t border-gray-100 dark:border-gray-700/60 px-4 py-4 bg-gray-50/80 dark:bg-gray-900/40 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">分组名称</label>
              <div className="flex items-center gap-1.5">
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
                  className={`flex-1 text-sm px-2.5 py-1.5 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${
                    nameError
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-200 dark:border-gray-700 focus:ring-indigo-400 focus:border-indigo-400'
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
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">类型</label>
              <select
                value={group.type}
                onChange={(e) => onUpdate({ type: e.target.value as ProxyGroupType })}
                className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 cursor-pointer"
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">测速 URL</label>
                <input
                  type="text"
                  value={group.url ?? ''}
                  onChange={(e) => onUpdate({ url: e.target.value })}
                  className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">间隔（秒）</label>
                <input
                  type="number"
                  value={group.interval ?? 300}
                  onChange={(e) => onUpdate({ interval: Number(e.target.value) })}
                  className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proxy list with DnD — always batch-select mode */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700/60">
          {/* autoAllNodes: count header */}
          {group.autoAllNodes && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50/60 dark:bg-emerald-900/10 border-b border-gray-100 dark:border-gray-700/50">
              <CheckSquare size={12} className="text-emerald-500" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">自动包含全部导入节点</span>
              <span className="text-xs text-gray-400 ml-auto font-mono">共 {sourceOnlySections.flatMap((s) => s.items).length} 个</span>
            </div>
          )}
          {/* Batch remove toolbar */}
          {!group.autoAllNodes && group.proxies.length > 0 && (
            <div className="flex items-center gap-2.5 px-4 py-2 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/60 dark:bg-gray-700/20">
              <button onClick={toggleRemoveAll} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                {allRemoveSelected
                  ? <CheckSquare size={12} className="text-red-500" />
                  : <Square size={12} />}
                全选
              </button>
              <span className="text-xs text-gray-400 font-mono">
                {removeSelected.size > 0 ? `已选 ${removeSelected.size}` : `共 ${group.proxies.length} 节点`}
              </span>
              <button
                onClick={handleBatchRemove}
                disabled={removeSelected.size === 0}
                className="ml-auto text-xs px-3 py-1 rounded-lg bg-red-500 hover:bg-red-400 active:bg-red-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium transition-all"
              >
                移除{removeSelected.size > 0 ? ` (${removeSelected.size})` : ''}
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
                {group.proxies.length === 0 && !group.autoAllNodes && (
                  <p className="text-center py-4 text-xs text-gray-400">暂无节点，点击下方批量添加</p>
                )}
                {group.autoAllNodes && sourceOnlySections.length === 0 && (
                  <p className="text-center py-4 text-xs text-gray-400">暂无导入节点，请先在订阅源页面导入</p>
                )}
                {group.autoAllNodes && sourceOnlySections.map((section) => (
                  <div key={section.label}>
                    <div className="sticky top-0 px-4 py-1.5 bg-gray-50 dark:bg-gray-800/90 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{section.label}</span>
                      <span className="ml-1 text-[10px] text-gray-300 dark:text-gray-600 font-mono">{section.items.length}</span>
                    </div>
                    {section.items.map((name) => (
                      <div key={name} className="flex items-center gap-2 px-4 py-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-900/10">
                        <CheckSquare size={11} className="shrink-0 text-emerald-500" />
                        <span className="flex-1 truncate">{name}</span>
                      </div>
                    ))}
                  </div>
                ))}
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
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 rounded-lg shadow-xl text-sm opacity-95">
                  <GripVertical size={13} className="text-indigo-400" />
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{activeId}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Batch add proxy picker — hidden for autoAllNodes groups */}
          {!group.autoAllNodes && <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-700/60">
            {showProxyPicker ? (
              <div className="space-y-2">
                {/* Search + close */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="搜索节点 / 代理组..."
                    value={proxySearch}
                    onChange={(e) => setProxySearch(e.target.value)}
                    autoFocus
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-800"
                  />
                  <button
                    onClick={() => { setShowProxyPicker(false); setProxySearch(''); setPickerSelected(new Set()) }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* IP 过滤条件 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Globe size={11} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="CC"
                    maxLength={2}
                    className="w-12 text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono uppercase text-center"
                  />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                  >
                    <option value="all">全部类型</option>
                    <option value="residential">住宅 IP</option>
                    <option value="hosting">数据中心</option>
                    <option value="proxy">代理/VPN</option>
                  </select>
                  {(filterCountry || filterType !== 'all') && (
                    <button
                      onClick={() => { setFilterCountry(''); setFilterType('all') }}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                    >
                      <X size={11} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const allNames = proxySections.flatMap((s) => s.items).filter((n) => serverByName.has(n))
                      handleFetchIps(allNames)
                    }}
                    disabled={ipFetchState === 'loading'}
                    className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 disabled:opacity-50 transition-all shrink-0"
                  >
                    {ipFetchState === 'loading'
                      ? <><Loader size={10} className="animate-spin" />查询中…</>
                      : <><Globe size={10} />{ipFetchState === 'done' ? '重新查询 IP' : '批量查询 IP'}</>}
                  </button>
                </div>

                {/* Toolbar: select all filtered + add */}
                <div className="flex items-center gap-2">
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
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {allFilteredSelected
                      ? <CheckSquare size={12} className="text-indigo-500" />
                      : <Square size={12} />}
                    全选筛选结果
                  </button>
                  <span className="text-xs text-gray-400 font-mono">
                    {pickerSelected.size > 0 ? `已选 ${pickerSelected.size}` : ''}
                  </span>
                  <button
                    onClick={handleBatchAdd}
                    disabled={pickerSelected.size === 0}
                    className="ml-auto text-xs px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium transition-all"
                  >
                    批量添加{pickerSelected.size > 0 ? ` (${pickerSelected.size})` : ''}
                  </button>
                </div>

                {/* List */}
                <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700/80">
                  {filteredSections.length === 0 && (
                    <p className="text-center py-4 text-xs text-gray-400">
                      {proxySections.length === 0 ? '请先在订阅源页面导入节点' : '无匹配节点'}
                    </p>
                  )}
                  {filteredSections.map((section) => {
                    const sectionAllChecked = section.items.every((n) => pickerSelected.has(n))
                    return (
                      <div key={section.label}>
                        <div className="sticky top-0 flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/90 border-b border-gray-100 dark:border-gray-700/50">
                          <button
                            onClick={() => toggleSectionAll(section.items)}
                            className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 uppercase tracking-widest transition-colors"
                          >
                            {sectionAllChecked
                              ? <CheckSquare size={11} className="text-indigo-500" />
                              : <Square size={11} />}
                            {section.label}
                          </button>
                          <span className="text-[10px] text-gray-300 dark:text-gray-600 font-mono">{section.items.length}</span>
                        </div>
                        {section.items.map((name) => {
                          const checked = pickerSelected.has(name)
                          const ipd = ipDataMap[name]
                          return (
                            <div
                              key={name}
                              onClick={() => togglePickerItem(name)}
                              className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-700/30 last:border-0 ${
                                checked
                                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/10'
                              }`}
                            >
                              {checked
                                ? <CheckSquare size={12} className="shrink-0 text-indigo-500" />
                                : <Square size={12} className="shrink-0 text-gray-300 dark:text-gray-600" />}
                              <span className="flex-1 truncate">{name}</span>
                              {/* IP 信息徽章 */}
                              {ipd?.status === 'success' && (
                                <span className="flex items-center gap-1 shrink-0">
                                  {ipd.countryCode && (
                                    <span className="font-mono text-gray-400 dark:text-gray-500 text-[10px]">{ipd.countryCode}</span>
                                  )}
                                  {ipd.hosting && (
                                    <span className="px-1 py-0.5 rounded-md text-[10px] bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 font-medium">DC</span>
                                  )}
                                  {ipd.proxy && (
                                    <span className="px-1 py-0.5 rounded-md text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-medium">VPN</span>
                                  )}
                                  {!ipd.hosting && !ipd.proxy && (
                                    <span className="px-1 py-0.5 rounded-md text-[10px] bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">住宅</span>
                                  )}
                                </span>
                              )}
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
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/15 rounded-xl transition-all border-2 border-dashed border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 font-medium"
              >
                <Plus size={13} />
                批量添加节点 / 代理组
              </button>
            )}
          </div>}
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
      className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-colors ${
        selected ? 'bg-red-50 dark:bg-red-900/15' : 'hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10'
      } ${active ? 'ring-1 ring-inset ring-indigo-400' : ''}`}
    >
      <button
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors shrink-0"
      >
        <GripVertical size={13} />
      </button>
      <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">{id}</span>
      {selected
        ? <CheckSquare size={13} className="shrink-0 text-red-500" />
        : <Square size={13} className="shrink-0 text-gray-300 dark:text-gray-600" />}
    </div>
  )
}
