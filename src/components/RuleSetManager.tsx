import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  Shield,
  ChevronDown,
  ExternalLink,
  Link,
  Pencil,
  Check,
  X,
  Zap,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { normalizeRuleUrl, inferProviderName, inferBehavior } from '../utils/parseYaml'
import type { Rule, RuleProvider } from '../types/clash'

const RULE_TYPES = [
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'IP-CIDR',
  'IP-CIDR6',
  'GEOIP',
  'MATCH',
]
const BEHAVIORS: RuleProvider['behavior'][] = ['domain', 'ipcidr', 'classical']

// ─────────────────────────────────────────────────────────────────────────────
export default function RuleSetManager() {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
      <AiQuickSetup />
      <ProviderSection />
      <ManualRulesSection />
    </div>
  )
}

// ── AI Quick Setup ────────────────────────────────────────────────────────────
const AI_SERVICES = [
  { id: 'bm7-openai',  label: 'OpenAI',  emoji: '🤖' },
  { id: 'bm7-claude',  label: 'Claude',  emoji: '🧠' },
  { id: 'bm7-gemini',  label: 'Gemini',  emoji: '✨' },
  { id: 'bm7-copilot', label: 'Copilot', emoji: '💡' },
] as const

function AiQuickSetup() {
  const { ruleProviders, proxyGroups, updateRuleProvider } = useAppStore()
  const [open, setOpen] = useState(true)

  // Per-service target: default to current provider target or first proxy group
  const allTargets = ['DIRECT', 'REJECT', ...proxyGroups.map((g) => g.name)]
  const defaultTarget = proxyGroups[0]?.name ?? 'PROXY'

  const [targets, setTargets] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const svc of AI_SERVICES) {
      const existing = ruleProviders.find((p) => p.id === svc.id)
      init[svc.id] = existing?.target ?? defaultTarget
    }
    return init
  })

  const handleApply = () => {
    for (const svc of AI_SERVICES) {
      const target = targets[svc.id]
      if (target) updateRuleProvider(svc.id, { target, enabled: true })
    }
  }

  // Update targets when proxy groups change to keep them valid
  const validTarget = (t: string) => allTargets.includes(t) ? t : (allTargets[2] ?? allTargets[0])

  return (
    <div className="p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left mb-2"
      >
        <Zap size={13} className="text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex-1">
          AI 规则快速配置
        </h2>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-2">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            为 AI 服务规则集选择目标代理组，一键启用：
          </p>
          <div className="grid grid-cols-2 gap-2">
            {AI_SERVICES.map((svc) => {
              const provider = ruleProviders.find((p) => p.id === svc.id)
              const current = targets[svc.id] ?? defaultTarget
              return (
                <div key={svc.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-2.5 py-2 border border-gray-200 dark:border-gray-700">
                  <span className="text-sm shrink-0">{svc.emoji}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-14 shrink-0">{svc.label}</span>
                  <select
                    value={validTarget(current)}
                    onChange={(e) => setTargets((prev) => ({ ...prev, [svc.id]: e.target.value }))}
                    className="flex-1 min-w-0 text-xs px-1.5 py-1 rounded border border-gray-200 dark:border-gray-600 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    {allTargets.map((t) => (
                      <option key={t} value={t} className="bg-white dark:bg-gray-800">{t}</option>
                    ))}
                  </select>
                  {provider?.enabled && (
                    <span className="text-green-500 shrink-0" title="已启用"><Check size={11} /></span>
                  )}
                </div>
              )
            })}
          </div>
          <button
            onClick={handleApply}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Zap size={12} />
            一键应用 AI 规则
          </button>
        </div>
      )}
    </div>
  )
}

// ── Rule Providers ────────────────────────────────────────────────────────────
function ProviderSection() {
  const {
    ruleProviders,
    proxyGroups,
    addRuleProvider,
    updateRuleProvider,
    removeRuleProvider,
    reorderRuleProviders,
  } = useAppStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const allTargets = ['DIRECT', 'REJECT', ...proxyGroups.map((g) => g.name)]
  const enabledCount = ruleProviders.filter((p) => p.enabled).length

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = ruleProviders.findIndex((p) => p.id === active.id)
    const newIndex = ruleProviders.findIndex((p) => p.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) reorderRuleProviders(oldIndex, newIndex)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
          <Link size={13} />
          规则集
          <span className="text-xs font-normal text-gray-400 normal-case ml-1">
            {enabledCount}/{ruleProviders.length} 已启用
          </span>
        </h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
        >
          {showAddForm ? <X size={12} /> : <Plus size={12} />}
          {showAddForm ? '取消' : '添加规则集'}
        </button>
      </div>

      {showAddForm && (
        <AddProviderForm
          allTargets={allTargets}
          onAdd={(provider) => {
            addRuleProvider(provider)
            setShowAddForm(false)
          }}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={ruleProviders.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1 mt-2">
            {ruleProviders.map((provider) => (
              <SortableProviderRow
                key={provider.id}
                provider={provider}
                allTargets={allTargets}
                onUpdate={(updates) => updateRuleProvider(provider.id, updates)}
                onRemove={() => removeRuleProvider(provider.id)}
                active={activeId === provider.id}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 rounded-lg shadow-lg text-xs opacity-90">
              <GripVertical size={12} className="text-blue-400" />
              <span>{ruleProviders.find((p) => p.id === activeId)?.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ── Add Provider Form ─────────────────────────────────────────────────────────
function AddProviderForm({
  allTargets,
  onAdd,
}: {
  allTargets: string[]
  onAdd: (p: Omit<RuleProvider, 'id'>) => void
}) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [behavior, setBehavior] = useState<RuleProvider['behavior']>('domain')
  const [target, setTarget] = useState(allTargets[0] ?? 'PROXY')
  const [noResolve, setNoResolve] = useState(false)

  const handleUrlChange = (raw: string) => {
    setUrl(raw)
    // Auto-fill name and behavior from URL
    if (raw.trim()) {
      const normalized = normalizeRuleUrl(raw.trim())
      const autoName = inferProviderName(normalized)
      const autoBehavior = inferBehavior(normalized)
      if (!name) setName(autoName)
      setBehavior(autoBehavior)
      if (autoBehavior === 'ipcidr') setNoResolve(true)
    }
  }

  const handleSubmit = () => {
    if (!url.trim()) return
    const normalized = normalizeRuleUrl(url.trim())
    const finalName = name.trim() || inferProviderName(normalized)
    onAdd({
      name: finalName,
      type: 'http',
      behavior,
      url: normalized,
      path: `./ruleset/${finalName}.yaml`,
      interval: 86400,
      target,
      enabled: true,
      noResolve,
    })
    setUrl('')
    setName('')
    setBehavior('domain')
    setNoResolve(false)
  }

  const preview = url.trim() ? normalizeRuleUrl(url.trim()) : ''

  return (
    <div className="mb-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-2">
      <p className="text-xs font-medium text-blue-700 dark:text-blue-300">新建规则集</p>

      {/* URL input */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          URL
          <span className="ml-1 text-gray-400">（支持 GitHub 链接，自动转换为 CDN）</span>
        </label>
        <input
          type="text"
          placeholder="https://github.com/blackmatrix7/ios_rule_script/tree/master/rule/Clash/OpenAI.yaml"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          className="w-full text-xs px-2.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {preview && preview !== url.trim() && (
          <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <ExternalLink size={10} />
            已转换为: {preview}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">名称</label>
          <input
            type="text"
            placeholder="auto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">类型</label>
          <select
            value={behavior}
            onChange={(e) => {
              const b = e.target.value as RuleProvider['behavior']
              setBehavior(b)
              setNoResolve(b === 'ipcidr')
            }}
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {BEHAVIORS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">目标代理组</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {allTargets.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={noResolve}
            onChange={(e) => setNoResolve(e.target.checked)}
            className="rounded"
          />
          no-resolve
        </label>
        <button
          onClick={handleSubmit}
          disabled={!url.trim()}
          className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs rounded-lg transition-colors"
        >
          <Check size={12} />
          确认添加
        </button>
      </div>
    </div>
  )
}

// ── Sortable Provider Row ─────────────────────────────────────────────────────
function SortableProviderRow({
  provider,
  allTargets,
  onUpdate,
  onRemove,
  active,
}: {
  provider: RuleProvider
  allTargets: string[]
  onUpdate: (updates: Partial<Omit<RuleProvider, 'id'>>) => void
  onRemove: () => void
  active: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: provider.id,
  })
  const [editing, setEditing] = useState(false)
  const [editUrl, setEditUrl] = useState(provider.url ?? '')
  const [editName, setEditName] = useState(provider.name)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const behaviorColor: Record<RuleProvider['behavior'], string> = {
    domain: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    ipcidr: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    classical: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  }

  const targetColor: Record<string, string> = {
    DIRECT: 'text-green-600 dark:text-green-400',
    REJECT: 'text-red-600 dark:text-red-400',
  }

  const saveEdit = () => {
    const normalized = normalizeRuleUrl(editUrl.trim())
    onUpdate({
      name: editName.trim() || provider.name,
      url: normalized,
      path: `./ruleset/${editName.trim() || provider.name}.yaml`,
    })
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border transition-colors ${
        provider.enabled
          ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
          : 'border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 opacity-60'
      } ${active ? 'ring-2 ring-blue-400' : ''}`}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        {/* Drag handle */}
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0"
        >
          <GripVertical size={13} />
        </button>

        {/* Enabled toggle */}
        <button
          role="switch"
          aria-checked={provider.enabled}
          onClick={() => onUpdate({ enabled: !provider.enabled })}
          title={provider.enabled ? '点击禁用' : '点击启用'}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            provider.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              provider.enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>

        {/* Name */}
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-24 text-xs px-1.5 py-0.5 rounded border border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
          />
        ) : (
          <span className="text-xs font-medium text-gray-900 dark:text-gray-100 w-28 truncate shrink-0">
            {provider.name}
          </span>
        )}

        {/* Behavior badge */}
        <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${behaviorColor[provider.behavior]}`}>
          {provider.behavior}
        </span>

        {/* Target selector */}
        <select
          value={provider.target}
          onChange={(e) => onUpdate({ target: e.target.value })}
          className={`text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0 font-medium ${
            targetColor[provider.target] ?? 'text-purple-600 dark:text-purple-400'
          }`}
        >
          {allTargets.map((t) => (
            <option key={t} value={t} className="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800">
              {t}
            </option>
          ))}
        </select>

        {/* no-resolve toggle */}
        <button
          onClick={() => onUpdate({ noResolve: !provider.noResolve })}
          className={`text-xs px-1.5 py-0.5 rounded border transition-colors shrink-0 ${
            provider.noResolve
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300'
          }`}
          title="切换 no-resolve"
        >
          no-res
        </button>

        {/* URL (edit mode) */}
        {editing && (
          <input
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            placeholder="URL"
            className="flex-1 min-w-0 text-xs px-1.5 py-0.5 rounded border border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
          />
        )}
        {!editing && provider.url && (
          <span className="flex-1 min-w-0 text-xs text-gray-400 truncate hidden sm:block" title={provider.url}>
            {provider.url}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {editing ? (
            <>
              <button onClick={saveEdit} className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600">
                <Check size={12} />
              </button>
              <button onClick={() => { setEditing(false); setEditUrl(provider.url ?? ''); setEditName(provider.name) }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                <X size={12} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setEditing(true); setEditUrl(provider.url ?? ''); setEditName(provider.name) }}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Pencil size={11} />
              </button>
              {!provider.isPreset && (
                <button
                  onClick={onRemove}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Manual Rules ──────────────────────────────────────────────────────────────
function ManualRulesSection() {
  const { rules, addRule, removeRule, reorderRules, proxyGroups } = useAppStore()
  const [newRule, setNewRule] = useState({
    type: 'DOMAIN',
    payload: '',
    target: 'PROXY',
    noResolve: false,
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const allTargets = ['DIRECT', 'REJECT', ...proxyGroups.map((g) => g.name)]

  const handleAddRule = () => {
    if (newRule.type !== 'MATCH' && !newRule.payload.trim()) return
    addRule({ ...newRule })
    setNewRule({ type: 'DOMAIN', payload: '', target: 'PROXY', noResolve: false })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = rules.findIndex((r) => r.id === active.id)
    const newIndex = rules.findIndex((r) => r.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) reorderRules(oldIndex, newIndex)
  }

  return (
    <div className="p-4">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left mb-3"
      >
        <Shield size={13} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex-1">
          自定义规则
          <span className="text-xs font-normal text-gray-400 normal-case ml-1">({rules.length})</span>
        </h2>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
      </button>

      {expanded && (
        <>
          {/* Add rule form */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 mb-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <select
                value={newRule.type}
                onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {RULE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input
                type="text"
                placeholder="payload"
                value={newRule.payload}
                onChange={(e) => setNewRule({ ...newRule, payload: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
                disabled={newRule.type === 'MATCH'}
                className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              <select
                value={newRule.target}
                onChange={(e) => setNewRule({ ...newRule, target: e.target.value })}
                className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {allTargets.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRule.noResolve}
                  onChange={(e) => setNewRule({ ...newRule, noResolve: e.target.checked })}
                  className="rounded"
                />
                no-resolve
              </label>
              <button
                onClick={handleAddRule}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
              >
                <Plus size={12} />
                添加
              </button>
            </div>
          </div>

          {/* Rules list */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveId(e.active.id as string)}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {rules.map((rule, index) => (
                  <SortableRuleItem
                    key={rule.id}
                    rule={rule}
                    index={index}
                    active={activeId === rule.id}
                    onRemove={() => removeRule(rule.id)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded shadow-lg text-xs opacity-90">
                  {rules.find((r) => r.id === activeId)?.type} …
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}
    </div>
  )
}

function SortableRuleItem({
  rule,
  index,
  active,
  onRemove,
}: {
  rule: Rule
  index: number
  active: boolean
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const targetColor: Record<string, string> = {
    DIRECT: 'text-green-600 dark:text-green-400',
    REJECT: 'text-red-600 dark:text-red-400',
    PROXY:  'text-blue-600 dark:text-blue-400',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${active ? 'ring-1 ring-blue-400' : ''}`}
    >
      <span className="text-xs text-gray-300 dark:text-gray-600 w-5 text-right shrink-0">{index + 1}</span>
      <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
        <GripVertical size={12} />
      </button>
      <span className="text-xs font-mono text-orange-600 dark:text-orange-400 shrink-0 w-20">{rule.type}</span>
      {rule.payload && (
        <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{rule.payload}</span>
      )}
      {!rule.payload && <span className="flex-1" />}
      {rule.noResolve && <span className="text-xs text-gray-400 shrink-0">no-res</span>}
      <span className={`text-xs font-medium shrink-0 ${targetColor[rule.target] ?? 'text-purple-600 dark:text-purple-400'}`}>
        → {rule.target}
      </span>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}
