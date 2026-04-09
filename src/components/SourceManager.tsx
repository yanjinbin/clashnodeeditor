import { useState, useRef, useMemo } from 'react'
import {
  Plus, Trash2, RefreshCw, CheckCircle, XCircle, Loader, Globe,
  Upload, AlertTriangle, ChevronDown, ChevronRight, ShieldCheck,
  Pencil, Check, X, Tag, Layers,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { fetchAndParseYaml, parseYamlFull } from '../utils/parseYaml'
import EmojiPicker from './EmojiPicker'
import { PRESET_USER_AGENTS, DEFAULT_USER_AGENT } from '../types/clash'
import type { SourceConfig } from '../types/clash'

// ── Main Component ────────────────────────────────────────────────────────────
export default function SourceManager() {
  const { sources, proxyGroups, addSource, updateSource, removeSource } = useAppStore()
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newUa, setNewUa] = useState(DEFAULT_USER_AGENT)
  const [customUa, setCustomUa] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Global dup summary for the top banner
  const { dupProxyCount: totalDupProxy, dupGroupCount: totalDupGroup } = useMemo(() => {
    const nameMap = new Map<string, number>()
    for (const src of sources) {
      for (const p of src.proxies) nameMap.set(p.name, (nameMap.get(p.name) ?? 0) + 1)
    }
    const groupMap = new Map<string, string[]>()
    for (const src of sources) {
      for (const g of src.importedGroups ?? []) {
        groupMap.set(g.name, [...(groupMap.get(g.name) ?? []), src.name])
      }
    }
    // Only count true cross-source duplicates (same name in 2+ sources)
    // A name that exists in only 1 source and also in storeGroups is the normal "already imported" state
    let dupGroupCount = 0
    for (const [, srcs] of groupMap) {
      if (srcs.length > 1) dupGroupCount++
    }
    const dupProxyCount = [...nameMap.values()].filter((c) => c > 1).length
    return { dupProxyCount, dupGroupCount }
  }, [sources, proxyGroups])

  const resolvedUa = newUa === '__custom__' ? customUa : newUa

  const handleAddSource = () => {
    if (!newUrl.trim()) return
    let name = newName.trim()
    try { name = name || new URL(newUrl).hostname } catch { name = name || newUrl }
    const id = addSource({ name, url: newUrl.trim(), userAgent: resolvedUa || DEFAULT_USER_AGENT })
    setNewUrl('')
    setNewName('')
    loadSource(id, newUrl.trim(), resolvedUa || DEFAULT_USER_AGENT)
  }

  const loadSource = async (id: string, url: string, ua?: string) => {
    updateSource(id, { status: 'loading', error: undefined })
    try {
      const { proxies, groups } = await fetchAndParseYaml(url, ua)
      updateSource(id, { status: 'success', proxies, importedGroups: groups })
    } catch (err) {
      updateSource(id, { status: 'error', error: (err as Error).message, proxies: [] })
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const name = file.name.replace(/\.(yaml|yml)$/, '')
      const id = addSource({ name, url: `file://${file.name}` })
      try {
        const { proxies, groups } = parseYamlFull(text)
        updateSource(id, { status: 'success', proxies, importedGroups: groups })
      } catch (err) {
        updateSource(id, { status: 'error', error: (err as Error).message, proxies: [] })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Form */}
      <div className="shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
          机场订阅源
        </h2>
        <div className="flex items-start gap-2 mb-3 px-2.5 py-2 rounded-lg bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-800">
          <ShieldCheck size={13} className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
            订阅请求通过部署在你自己 Vercel 账号下的 Edge Function（<code className="font-mono">api/proxy.ts</code>）转发，不经过任何第三方服务，透明可审计。
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <input ref={nameInputRef} type="text" placeholder="订阅名称（可选）" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <EmojiPicker inputRef={nameInputRef} value={newName} onChange={setNewName} onSelect={(e) => setNewName((n) => n + e)} />
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="订阅 URL" value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleAddSource} disabled={!newUrl.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors">
              <Plus size={16} />
            </button>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5 leading-relaxed">
            温馨提示：不是所有机场都支持订阅链接直接导入，部分机场可能仅提供特定客户端格式或需要手动下载配置文件。
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0">User-Agent</span>
            <div className="relative flex-1">
              <select value={newUa} onChange={(e) => setNewUa(e.target.value)}
                className="w-full text-xs pl-2.5 pr-7 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none">
                {PRESET_USER_AGENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
          </div>
          {newUa === '__custom__' ? (
            <input type="text" placeholder="如：clash-verge/v2.3.0" value={customUa}
              onChange={(e) => setCustomUa(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
          ) : (
            <p className="text-xs text-gray-400">
              机场通过 UA 识别客户端并返回对应节点。
              <a href="https://github.com/clash-verge-rev/clash-verge-rev/releases"
                target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 hover:underline">查看最新版本 →</a>
            </p>
          )}
          <label className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-gray-500 dark:text-gray-400">
            <Upload size={14} />
            <span>上传本地 YAML 文件</span>
            <input type="file" accept=".yaml,.yml" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {(totalDupProxy > 0 || totalDupGroup > 0) && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {totalDupProxy > 0 && <span>检测到 <strong>{totalDupProxy}</strong> 个重复节点名</span>}
              {totalDupProxy > 0 && totalDupGroup > 0 && <span className="mx-1">·</span>}
              {totalDupGroup > 0 && <span><strong>{totalDupGroup}</strong> 个重复代理组名</span>}
              ，建议为各订阅源批量加前缀做区分
            </p>
          </div>
        )}

        {sources.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Globe size={32} className="mx-auto mb-2 opacity-30" />
            <p>添加机场订阅源开始使用</p>
          </div>
        )}

        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            onReload={() => loadSource(source.id, source.url, source.userAgent)}
            onRemove={() => removeSource(source.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Source Card ───────────────────────────────────────────────────────────────
function SourceCard({
  source, onReload, onRemove,
}: {
  source: SourceConfig
  onReload: () => void
  onRemove: () => void
}) {
  const { sources, updateProxy, applyPrefixToSource, importSourceGroup, proxyGroups } = useAppStore()

  // Compute dup counts directly from store so they update in the same render cycle
  const dupProxyCount = useMemo(() => {
    const nameMap = new Map<string, number>()
    for (const src of sources) {
      for (const p of src.proxies) nameMap.set(p.name, (nameMap.get(p.name) ?? 0) + 1)
    }
    return source.proxies.filter((p) => (nameMap.get(p.name) ?? 0) > 1).length
  }, [sources, source.proxies])

  const dupGroupNames = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const src of sources) {
      for (const g of src.importedGroups ?? []) {
        map.set(g.name, [...(map.get(g.name) ?? []), src.name])
      }
    }
    // Only flag true cross-source duplicates (name appears in 2+ sources)
    // Single-source groups that are already imported share the name by design — not a conflict
    const result = new Map<string, string[]>()
    for (const [name, srcs] of map) {
      if (srcs.length > 1) result.set(name, srcs)
    }
    return result
  }, [sources])

  const dupGroupCount = (source.importedGroups ?? []).filter((g) => dupGroupNames.has(g.name)).length
  const [showProxies, setShowProxies] = useState(true)
  const [showGroups, setShowGroups] = useState(true)
  const [prefix, setPrefix] = useState('')
  const [filter, setFilter] = useState('')

  const importedGroups = source.importedGroups ?? []
  const importedNames = new Set(proxyGroups.map((g) => g.name))

  const filtered = filter.trim()
    ? source.proxies.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : source.proxies

  const handleApplyPrefix = () => {
    const p = prefix.trim()
    if (p) applyPrefixToSource(source.id, p)
  }

  const handleQuickPrefix = () => {
    applyPrefixToSource(source.id, source.name.replace(/\s+/g, '-') + '|')
  }

  const hasTools = source.status === 'success' && (source.proxies.length > 0 || importedGroups.length > 0)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <StatusIcon status={source.status} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{source.name}</p>
          <p className="text-xs text-gray-400 truncate">{source.url}</p>
          {source.userAgent && <p className="text-xs text-blue-400 truncate font-mono">UA: {source.userAgent}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {source.status === 'success' && (
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
              {source.proxies.length} 节点
            </span>
          )}
          {importedGroups.length > 0 && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
              {importedGroups.length} 代理组
            </span>
          )}
          {dupProxyCount > 0 && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
              {dupProxyCount} 重复
            </span>
          )}
          <button onClick={onReload} disabled={source.status === 'loading'}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors">
            <RefreshCw size={13} className={source.status === 'loading' ? 'animate-spin' : ''} />
          </button>
          <button onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {source.error && <div className="px-3 pb-2 text-xs text-red-500">{source.error}</div>}

      {/* Tools bar */}
      {hasTools && (
        <div className="border-t border-gray-100 dark:border-gray-700/50 px-3 py-2 flex items-center gap-2 flex-wrap bg-gray-50/50 dark:bg-gray-700/20">
          <Tag size={11} className="text-gray-400 shrink-0" />
          <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyPrefix()}
            placeholder="批量前缀…"
            className="flex-1 min-w-0 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <button onClick={handleApplyPrefix} disabled={!prefix.trim()}
            className="text-xs px-2 py-1 rounded bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white transition-colors shrink-0">
            应用
          </button>
          {(dupProxyCount > 0 || dupGroupCount > 0) && (
            <button onClick={handleQuickPrefix}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors shrink-0"
              title={`前缀 "${source.name.replace(/\s+/g, '-')}|"`}>
              <AlertTriangle size={11} />
              一键加源名前缀
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {source.proxies.length > 0 && (
              <button onClick={() => setShowProxies((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                {showProxies ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                节点
              </button>
            )}
            {importedGroups.length > 0 && (
              <button onClick={() => setShowGroups((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                {showGroups ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                代理组
              </button>
            )}
          </div>
        </div>
      )}

      {/* Proxy list */}
      {showProxies && source.proxies.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700/50">
          <div className="px-3 pt-2 pb-1">
            <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="过滤节点名…"
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="max-h-52 overflow-y-auto px-2 pb-2">
            {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-3">无匹配节点</p>}
            {filtered.map((proxy) => {
              const realIdx = source.proxies.indexOf(proxy)
              return (
                <ProxyRow key={realIdx} name={proxy.name} type={String(proxy.type ?? '')}
                  onChange={(n) => updateProxy(source.id, realIdx, { name: n })} />
              )
            })}
          </div>
        </div>
      )}

      {/* Imported proxy groups */}
      {showGroups && importedGroups.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700/50">
          <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">来源代理组</span>
            {dupGroupCount > 0 && (
              <button onClick={handleQuickPrefix}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors"
                title={`代理组名加前缀 "${source.name.replace(/\s+/g, '-')}|"`}>
                <AlertTriangle size={11} />
                一键加前缀
              </button>
            )}
            <button
              onClick={() => {
                for (const g of importedGroups) {
                  if (!importedNames.has(g.name)) importSourceGroup(source.id, g.name)
                }
              }}
              className="ml-auto text-xs px-2 py-0.5 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors">
              全部导入
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto px-2 pb-2 space-y-0.5">
            {importedGroups.map((g) => {
              const isDup = dupGroupNames.has(g.name)
              const alreadyIn = importedNames.has(g.name)
              return (
                <div key={g.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <Layers size={11} className="text-gray-400 shrink-0" />
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono shrink-0 ${
                    g.type === 'select' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : g.type === 'url-test' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>{g.type}</span>
                  <span className="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-300 truncate">{g.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{g.proxies.length}节点</span>
                  {isDup && (
                    <span className="shrink-0" title={dupGroupNames.get(g.name)?.join(', ')}>
                      <AlertTriangle size={11} className="text-amber-500" />
                    </span>
                  )}
                  {alreadyIn ? (
                    <span className="text-xs text-green-500 shrink-0 flex items-center gap-0.5"><Check size={11} />已导入</span>
                  ) : (
                    <button onClick={() => importSourceGroup(source.id, g.name)}
                      className="text-xs px-1.5 py-0.5 rounded border border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shrink-0">
                      导入
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Proxy Row ─────────────────────────────────────────────────────────────────
function ProxyRow({ name, type, onChange }: { name: string; type: string; onChange: (n: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  const commit = () => {
    const t = draft.trim()
    if (t && t !== name) onChange(t); else setDraft(name)
    setEditing(false)
  }

  const TYPE_COLOR: Record<string, string> = {
    ss: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    ssr: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    vmess: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    vless: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    trojan: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    hysteria2: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    hysteria: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    tuic: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  }

  return (
    <div className="group flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 font-mono ${TYPE_COLOR[type.toLowerCase()] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
        {type || '?'}
      </span>
      {editing ? (
        <>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(name); setEditing(false) } }}
            className="flex-1 min-w-0 text-xs px-1.5 py-0.5 rounded border border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
          <button onClick={commit} className="p-0.5 text-green-500 shrink-0"><Check size={12} /></button>
          <button onClick={() => { setDraft(name); setEditing(false) }} className="p-0.5 text-gray-400 shrink-0"><X size={12} /></button>
        </>
      ) : (
        <>
          <span className="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-300 truncate">{name}</span>
          <button onClick={() => { setDraft(name); setEditing(true) }}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-500 transition-all shrink-0">
            <Pencil size={11} />
          </button>
        </>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'loading': return <Loader size={14} className="text-blue-500 animate-spin" />
    case 'success': return <CheckCircle size={14} className="text-green-500" />
    case 'error':   return <XCircle size={14} className="text-red-500" />
    default:        return <div className="w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-600" />
  }
}
