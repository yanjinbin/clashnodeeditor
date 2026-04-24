import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  'RULE-SET',
  'MATCH',
]
const BEHAVIORS: RuleProvider['behavior'][] = ['domain', 'ipcidr', 'classical']

// ─────────────────────────────────────────────────────────────────────────────
export default function RuleSetManager() {
  return (
    <div className="h-full overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
      <RuleOrderNotice />
      <AiQuickSetup />
      <ProviderSection />
      <ManualRulesSection />
    </div>
  )
}

// ── Rule Order Notice ─────────────────────────────────────────────────────────
function RuleOrderNotice() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ruleOrderSteps = [
    { label: t('rule.orderLocal'), items: ['DOMAIN-SUFFIX local', 'IP-CIDR x4', 'GEOIP LAN', 'RULE-SET private', 'RULE-SET lancidr'] },
    { label: t('rule.orderReject'), items: ['RULE-SET reject'] },
    { label: t('rule.orderAi'), items: ['openai', 'claude', 'copilot', 'gemini', 'docker'] },
    { label: t('rule.orderMedia'), items: ['youtube-music', 'youtube', 'google', 'telegram', 'twitter', 'tiktok', 'linkedin', 'GoogleFCM'] },
    { label: t('rule.orderGeneral'), items: ['RULE-SET direct', 'RULE-SET gfw'] },
    { label: t('rule.orderIp'), items: ['telegramcidr no-resolve', 'cncidr no-resolve'] },
    { label: t('rule.orderChina'), items: ['RULE-SET cn', 'GEOIP CN no-resolve'] },
    { label: 'MATCH', items: ['♻️ 自动选择'] },
  ]
  return (
    <div className="px-5 py-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Shield size={13} className="text-indigo-400 shrink-0" />
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex-1">
          {t('rule.orderHeading')}
        </h2>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* 核心机制说明 */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/60 px-3.5 py-3 space-y-2">
            <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <span className="text-indigo-500">⚡</span> {t('rule.orderEngine').replace(/^⚡\s*/, '')}
            </p>
            <div className="flex items-stretch gap-2 text-[10px]">
              <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <div className="w-px flex-1 bg-gradient-to-b from-indigo-300 to-transparent" />
              </div>
              <div className="space-y-2 text-gray-500 dark:text-gray-400 leading-relaxed pb-1">
                <p dangerouslySetInnerHTML={{ __html: t('rule.orderEngineDesc1') }} />
                <p dangerouslySetInnerHTML={{ __html: t('rule.orderEngineDesc2') }} />
                <p dangerouslySetInnerHTML={{ __html: t('rule.orderEngineDesc3') }} />
              </div>
            </div>
          </div>

        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-900/10 p-3 space-y-1.5">
          {ruleOrderSteps.map((step, i) => (
            <div key={step.label} className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 w-4 text-right shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">{step.label}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1.5">
                  {step.items.join(' → ')}
                </span>
              </div>
            </div>
          ))}
          <p className="text-[9px] text-gray-400 dark:text-gray-600 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
            {t('rule.orderNote')}
          </p>
        </div>
        </div>
      )}
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
  const { t } = useTranslation()
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
    <div className="px-5 py-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left mb-3"
      >
        <Zap size={13} className="text-amber-500 shrink-0" />
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex-1">
          {t('rule.aiHeading')}
        </h2>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/70 dark:border-amber-800/60 rounded-xl p-4 space-y-3">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('rule.aiDesc')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {AI_SERVICES.map((svc) => {
              const provider = ruleProviders.find((p) => p.id === svc.id)
              const current = targets[svc.id] ?? defaultTarget
              return (
                <div key={svc.id} className="flex items-center gap-2 bg-white dark:bg-gray-800/80 rounded-xl px-3 py-2.5 border border-amber-100 dark:border-gray-700/80 shadow-sm">
                  <span className="text-sm shrink-0">{svc.emoji}</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-14 shrink-0">{svc.label}</span>
                  <select
                    value={validTarget(current)}
                    onChange={(e) => setTargets((prev) => ({ ...prev, [svc.id]: e.target.value }))}
                    className="flex-1 min-w-0 text-xs px-1.5 py-1 rounded-lg border border-amber-200 dark:border-gray-600 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                  >
                    {allTargets.map((t) => (
                      <option key={t} value={t} className="bg-white dark:bg-gray-800">{t}</option>
                    ))}
                  </select>
                  {provider?.enabled && (
                    <span className="text-emerald-500 shrink-0" title={t('rule.enabled')}><Check size={12} /></span>
                  )}
                </div>
              )
            })}
          </div>
          <button
            onClick={handleApply}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white text-xs font-semibold rounded-xl shadow-sm shadow-amber-200 dark:shadow-none transition-all"
          >
            <Zap size={13} />
            {t('rule.aiApply')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Rule Providers ────────────────────────────────────────────────────────────
function ProviderSection() {
  const { t } = useTranslation()
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
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <Link size={12} />
          {t('rule.providerHeading')}
          <span className="text-[10px] font-medium text-gray-400 normal-case font-mono">
            {t('rule.providerEnabled', { enabled: enabledCount, total: ruleProviders.length })}
          </span>
        </h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium rounded-xl shadow-sm shadow-indigo-200 dark:shadow-none transition-all"
        >
          {showAddForm ? <X size={12} /> : <Plus size={13} />}
          {showAddForm ? t('rule.providerCancel') : t('rule.providerAdd')}
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
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 rounded-xl shadow-xl text-xs opacity-95 font-medium">
              <GripVertical size={12} className="text-indigo-400" />
              <span className="text-gray-900 dark:text-gray-100">{ruleProviders.find((p) => p.id === activeId)?.name}</span>
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
  const { t } = useTranslation()
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
    <div className="mb-3 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/15 border border-indigo-200/70 dark:border-indigo-800/60 space-y-2.5">
      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{t('rule.newProvider')}</p>

      {/* URL input */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          {t('rule.providerUrlLabel')}
          <span className="ml-1 text-gray-400 font-normal">{t('rule.providerUrlHint')}</span>
        </label>
        <input
          type="text"
          placeholder="https://github.com/blackmatrix7/ios_rule_script/tree/master/rule/Clash/OpenAI.yaml"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
        />
        {preview && preview !== url.trim() && (
          <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ExternalLink size={10} />
            {t('rule.providerConverted', { url: preview })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('rule.providerNameLabel')}</label>
          <input
            type="text"
            placeholder="auto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-xs px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('rule.providerTypeLabel')}</label>
          <select
            value={behavior}
            onChange={(e) => {
              const b = e.target.value as RuleProvider['behavior']
              setBehavior(b)
              setNoResolve(b === 'ipcidr')
            }}
            className="w-full text-xs px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
          >
            {BEHAVIORS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('rule.providerTargetLabel')}</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full text-xs px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
          >
            {allTargets.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={noResolve}
            onChange={(e) => setNoResolve(e.target.checked)}
            className="rounded accent-indigo-500"
          />
          no-resolve
        </label>
        <button
          onClick={handleSubmit}
          disabled={!url.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white text-xs font-medium rounded-xl transition-all"
        >
          <Check size={12} />
          {t('rule.providerConfirm')}
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
  const { t } = useTranslation()
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
    classical: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  }

  const targetColor: Record<string, string> = {
    DIRECT: 'text-emerald-600 dark:text-emerald-400',
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
      className={`group rounded-xl border transition-all shadow-sm ${
        provider.enabled
          ? 'border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800/50 hover:shadow-md'
          : 'border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20 opacity-55'
      } ${active ? 'ring-2 ring-indigo-400' : ''}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
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
          title={provider.enabled ? t('rule.toggleDisable') : t('rule.toggleEnable')}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            provider.enabled ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
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
            className="w-24 text-xs px-2 py-1 rounded-lg border border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        ) : (
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 w-28 truncate shrink-0">
            {provider.name}
          </span>
        )}

        {/* Behavior badge */}
        <span className={`text-xs px-1.5 py-0.5 rounded-lg shrink-0 font-mono font-medium ${behaviorColor[provider.behavior]}`}>
          {provider.behavior}
        </span>

        {/* Target selector */}
        {(() => {
          const targetInList = allTargets.includes(provider.target)
          const selectOptions = targetInList ? allTargets : [...allTargets, provider.target]
          return (
            <div className="flex items-center gap-0.5 shrink-0">
              <select
                value={provider.target}
                onChange={(e) => onUpdate({ target: e.target.value })}
                className={`text-xs px-1.5 py-0.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-400 font-medium bg-transparent cursor-pointer ${
                  !targetInList
                    ? 'border-red-400 text-red-500 dark:text-red-400'
                    : `border-gray-200 dark:border-gray-700 ${targetColor[provider.target] ?? 'text-indigo-600 dark:text-indigo-400'}`
                }`}
                title={!targetInList ? t('rule.targetNotFound', { target: provider.target }) : undefined}
              >
                {selectOptions.map((t) => (
                  <option key={t} value={t} className="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800">
                    {t}
                  </option>
                ))}
              </select>
              {!targetInList && (
                <span className="text-red-500 text-xs" title={t('rule.targetNotFound', { target: provider.target })}>⚠</span>
              )}
            </div>
          )
        })()}

        {/* no-resolve toggle */}
        <button
          onClick={() => onUpdate({ noResolve: !provider.noResolve })}
          className={`text-xs px-1.5 py-0.5 rounded-lg border transition-all shrink-0 font-medium ${
            provider.noResolve
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 hover:text-gray-500'
          }`}
          title={t('rule.toggleNoResolve')}
        >
          no-res
        </button>

        {/* URL (edit mode) */}
        {editing && (
          <input
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            placeholder="URL"
            className="flex-1 min-w-0 text-xs px-2 py-0.5 rounded-lg border border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
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
              <button onClick={saveEdit} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 transition-all">
                <Check size={12} />
              </button>
              <button onClick={() => { setEditing(false); setEditUrl(provider.url ?? ''); setEditName(provider.name) }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-all">
                <X size={12} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setEditing(true); setEditUrl(provider.url ?? ''); setEditName(provider.name) }}
                className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Pencil size={12} />
              </button>
              {!provider.isPreset && (
                <button
                  onClick={onRemove}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={12} />
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
  const { t } = useTranslation()
  const { rules, addRule, removeRule, reorderRules, proxyGroups, ruleProviders, resetRules } = useAppStore()
  const [newRule, setNewRule] = useState({
    type: 'DOMAIN',
    payload: '',
    target: proxyGroups[0]?.name ?? 'DIRECT',
    noResolve: false,
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [confirmReset, setConfirmReset] = useState(false)
  const confirmResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleResetClick = () => {
    if (confirmReset) {
      resetRules()
      setConfirmReset(false)
      if (confirmResetTimer.current) clearTimeout(confirmResetTimer.current)
    } else {
      setConfirmReset(true)
      confirmResetTimer.current = setTimeout(() => setConfirmReset(false), 3000)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const allTargets = ['DIRECT', 'REJECT', ...proxyGroups.map((g) => g.name)]

  const handleAddRule = () => {
    if (newRule.type !== 'MATCH' && !newRule.payload.trim()) return
    addRule({ ...newRule })
    setNewRule({ type: 'DOMAIN', payload: '', target: allTargets[2] ?? allTargets[0] ?? 'DIRECT', noResolve: false })
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
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 flex-1 text-left"
        >
          <Shield size={13} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex-1">
            {t('rule.customHeading')}
            <span className="text-xs font-normal text-gray-400 normal-case ml-1">({rules.length})</span>
          </h2>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
        </button>
        {rules.length > 0 && (
          <button
            onClick={handleResetClick}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors shrink-0 ${
              confirmReset
                ? 'bg-red-500 border-red-500 text-white hover:bg-red-600'
                : 'border-red-200 dark:border-red-800/50 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
          >
            <Trash2 size={11} />
            {confirmReset ? t('rule.customConfirmReset') : t('rule.customReset')}
          </button>
        )}
      </div>

      {expanded && (
        <>
          {/* Add rule form */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 mb-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <select
                value={newRule.type}
                onChange={(e) => {
                  const type = e.target.value
                  const payload = type === 'RULE-SET' ? (ruleProviders[0]?.name ?? '') : ''
                  setNewRule({ ...newRule, type, payload })
                }}
                className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {RULE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              {newRule.type === 'RULE-SET' ? (
                <select
                  value={newRule.payload}
                  onChange={(e) => setNewRule({ ...newRule, payload: e.target.value })}
                  className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {ruleProviders.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="payload"
                  value={newRule.payload}
                  onChange={(e) => setNewRule({ ...newRule, payload: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
                  disabled={newRule.type === 'MATCH'}
                  className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              )}
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
                {t('rule.addRule')}
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
                    allTargets={allTargets}
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
  allTargets,
  onRemove,
}: {
  rule: Rule
  index: number
  active: boolean
  allTargets: string[]
  onRemove: () => void
}) {
  const { t } = useTranslation()
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
  }

  const targetValid = allTargets.includes(rule.target)

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
      <span
        className={`text-xs font-medium shrink-0 ${
          !targetValid
            ? 'text-red-500 dark:text-red-400'
            : (targetColor[rule.target] ?? 'text-purple-600 dark:text-purple-400')
        }`}
        title={!targetValid ? t('rule.targetNotFound', { target: rule.target }) : undefined}
      >
        → {rule.target}{!targetValid && ' ⚠'}
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
