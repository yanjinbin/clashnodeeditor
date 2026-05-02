import { useState, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveToIp, fetchIpInfoBatch, IP_RE } from '../utils/ipUtils'
import type { IpData } from '../utils/ipUtils'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import {
  Plus, Trash2, RefreshCw, CheckCircle, XCircle, Loader, Globe,
  Upload, AlertTriangle, ChevronDown, ChevronRight, ShieldCheck,
  Pencil, Check, X, Tag, Layers, ExternalLink, RotateCcw,
  Activity, Database, Clock, MapPin,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { fetchAndParseYaml, parseYamlFull } from '../utils/parseYaml'
import EmojiPicker from './EmojiPicker'
import { PRESET_USER_AGENTS, DEFAULT_USER_AGENT } from '../types/clash'
import type { SourceConfig, SubscriptionInfo } from '../types/clash'

// ── Constants ─────────────────────────────────────────────────────────────────

const IP_VERSION_OPTS = [
  { value: '',            label: '默认' },
  { value: 'ipv4',        label: 'ipv4' },
  { value: 'ipv6',        label: 'ipv6' },
  { value: 'dual',        label: 'dual' },
  { value: 'ipv4-prefer', label: 'ipv4-prefer' },
  { value: 'ipv6-prefer', label: 'ipv6-prefer' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

function formatExpire(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ── Protocol distribution chart ───────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  ss:        'bg-green-500',
  ssr:       'bg-green-400',
  vmess:     'bg-blue-500',
  vless:     'bg-purple-500',
  trojan:    'bg-orange-500',
  hysteria2: 'bg-pink-500',
  hysteria:  'bg-pink-400',
  tuic:      'bg-cyan-500',
}
const TYPE_TEXT: Record<string, string> = {
  ss:        'text-green-600 dark:text-green-400',
  ssr:       'text-green-500 dark:text-green-300',
  vmess:     'text-blue-600 dark:text-blue-400',
  vless:     'text-purple-600 dark:text-purple-400',
  trojan:    'text-orange-600 dark:text-orange-400',
  hysteria2: 'text-pink-600 dark:text-pink-400',
  hysteria:  'text-pink-500 dark:text-pink-300',
  tuic:      'text-cyan-600 dark:text-cyan-400',
}

function ProtocolChart({ proxies }: { proxies: SourceConfig['proxies'] }) {
  const { t } = useTranslation()
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of proxies) {
      const tp = (String(p.type ?? '')).toLowerCase()
      map.set(tp, (map.get(tp) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [proxies])

  if (counts.length === 0) return null
  const total = proxies.length
  const top = counts.slice(0, 5)
  const otherCount = counts.slice(5).reduce((s, [, n]) => s + n, 0)
  const rows = otherCount > 0 ? [...top, [t('source.geoOther'), otherCount] as [string, number]] : top

  return (
    <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-2.5 space-y-1.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t('source.protocolDistribution')}</p>
      {rows.map(([type, count]) => {
        const pct = (count / total) * 100
        const barColor = TYPE_COLOR[type] ?? 'bg-gray-400'
        const textColor = TYPE_TEXT[type] ?? 'text-gray-500'
        return (
          <div key={type} className="flex items-center gap-2">
            <span className={`text-[10px] font-mono w-16 shrink-0 truncate ${textColor}`}>{type}</span>
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 font-mono w-8 text-right shrink-0">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Country flag helper ───────────────────────────────────────────────────────
function countryFlag(cc: string): string {
  if (!cc || cc.length !== 2) return '🌐'
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

// ── Geo Distribution Chart (on-demand) ────────────────────────────────────────
type GeoScanState = 'idle' | 'loading' | 'done' | 'error'

type MapMarker = { id: string, lat: number, lon: number, count: number, city: string, cc: string }

function GeoChart({ proxies }: { proxies: SourceConfig['proxies'] }) {
  const { t } = useTranslation()
  const [state, setState] = useState<GeoScanState>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [geoMap, setGeoMap] = useState<Map<string, { country: string; cc: string; count: number }>>(new Map())
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [error, setError] = useState('')

  const handleScan = async () => {
    if (state === 'loading') return
    setState('loading')
    setProgress({ done: 0, total: proxies.length })
    setError('')

    try {
      const CONCURRENCY = 20
      const ipResults: { name: string; ip: string }[] = []
      for (let i = 0; i < proxies.length; i += CONCURRENCY) {
        const batch = proxies.slice(i, i + CONCURRENCY)
        const settled = await Promise.allSettled(
          batch.map(async (p) => {
            const server = String(p.server ?? '')
            if (!server) throw new Error('no server')
            const ip = await resolveToIp(server)
            return { name: p.name, ip }
          })
        )
        for (const r of settled) {
          if (r.status === 'fulfilled') ipResults.push(r.value)
        }
        setProgress({ done: Math.min(i + CONCURRENCY, proxies.length), total: proxies.length })
      }

      const uniqueIps = [...new Set(ipResults.map((r) => r.ip))]
      const geoArr: IpData[] = []
      for (let i = 0; i < uniqueIps.length; i += 100) {
        const fetched = await fetchIpInfoBatch(uniqueIps.slice(i, i + 100))
        geoArr.push(...fetched)
      }
      const ipToGeo = new Map<string, IpData>()
      uniqueIps.forEach((ip, i) => ipToGeo.set(ip, geoArr[i]))

      const countMap = new Map<string, { country: string; cc: string; count: number }>()
      const locMap = new Map<string, MapMarker>()

      for (const { ip } of ipResults) {
        const geo = ipToGeo.get(ip)
        if (!geo || geo.status !== 'success') continue
        const cc = geo.countryCode ?? 'XX'
        const country = geo.country ?? cc

        const prev = countMap.get(cc)
        countMap.set(cc, { country, cc, count: (prev?.count ?? 0) + 1 })

        if (geo.lat && geo.lon) {
          const locId = `${geo.lat},${geo.lon}`
          const prevLoc = locMap.get(locId)
          locMap.set(locId, {
            id: locId,
            lat: geo.lat,
            lon: geo.lon,
            count: (prevLoc?.count ?? 0) + 1,
            city: geo.city || country,
            cc
          })
        }
      }

      setGeoMap(countMap)
      setMarkers([...locMap.values()])
      setState('done')
    } catch (e) {
      setError((e as Error).message)
      setState('error')
    }
  }

  const rows = useMemo(() =>
    [...geoMap.values()].sort((a, b) => b.count - a.count),
    [geoMap]
  )
  const total = rows.reduce((s, r) => s + r.count, 0)

  return (
    <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <MapPin size={11} className="text-gray-400 shrink-0" />
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest flex-1">{t('source.geoDistribution')}</p>
        {state === 'idle' || state === 'error' ? (
          <button
            onClick={handleScan}
            className="text-[10px] px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 font-medium transition-all"
          >
            {state === 'error' ? t('source.retry') : t('source.query')}
          </button>
        ) : state === 'loading' ? (
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Loader size={10} className="animate-spin" />
            {progress.done}/{progress.total}
          </span>
        ) : (
          <button
            onClick={handleScan}
            className="text-[10px] px-2 py-1 rounded-lg text-gray-400 hover:text-indigo-500 transition-colors"
            title={t('source.requery')}
          >
            <RefreshCw size={10} />
          </button>
        )}
      </div>

      {state === 'error' && (
        <p className="text-[10px] text-red-400 mb-2">{error}</p>
      )}

      {state === 'done' && rows.length === 0 && (
        <p className="text-[10px] text-gray-400">{t('source.noIpResolved')}</p>
      )}

      {state === 'done' && rows.length > 0 && (
        <div className="space-y-4 pt-2">
          {markers.length > 0 && (
            <div className="h-56 w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-inner relative z-0">
              <MapContainer center={[20, 0]} zoom={1} style={{ height: '100%', width: '100%', background: '#e5e7eb' }} scrollWheelZoom={true}>
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  attribution='&copy; Google Maps'
                />
                {markers.map((m) => (
                  <CircleMarker
                    key={m.id}
                    center={[m.lat, m.lon]}
                    radius={Math.max(6, Math.min(24, 4 + m.count * 1.5))}
                    pathOptions={{ color: '#4f46e5', fillColor: '#6366f1', fillOpacity: 0.7, weight: 2 }}
                  >
                    <Tooltip sticky>
                      <div className="text-xs font-mono">
                        {countryFlag(m.cc)} {m.city}: <strong>{m.count}</strong> {t('source.geoNodeCount', { count: m.count }).replace(String(m.count), '').trim() || '个节点'}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          )}

          <div className="space-y-1.5">
          {rows.map((r) => {
            const pct = (r.count / total) * 100
            return (
              <div key={r.cc} className="flex items-center gap-2">
                <span className="text-sm shrink-0 w-5 text-center">{countryFlag(r.cc)}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 w-24 shrink-0 truncate">{r.country}</span>
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-mono w-6 text-right shrink-0">{r.count}</span>
              </div>
            )
          })}
        </div>
        </div>
      )}
    </div>
  )
}

// ── Subscription Info ─────────────────────────────────────────────────────────
function SubscriptionInfoBar({ info }: { info: SubscriptionInfo }) {
  const { t } = useTranslation()
  const used = info.upload + info.download
  const pct = info.total > 0 ? Math.min((used / info.total) * 100, 100) : 0
  const isExpiringSoon = info.expire && info.expire - Date.now() / 1000 < 7 * 86400
  const isExpired = info.expire && info.expire < Date.now() / 1000

  return (
    <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-2.5 space-y-1">
      <div className="flex items-center gap-2">
        <Database size={11} className="text-gray-400 shrink-0" />
        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-400 font-mono shrink-0 whitespace-nowrap">
          {formatBytes(used)} / {formatBytes(info.total)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <Activity size={10} />
          {t('source.upload_used', { upload: formatBytes(info.upload), download: formatBytes(info.download) })}
        </span>
        {info.expire !== undefined && (
          <span className={`flex items-center gap-1 ml-auto font-medium ${
            isExpired ? 'text-red-500' : isExpiringSoon ? 'text-amber-500' : 'text-gray-400'
          }`}>
            <Clock size={10} />
            {isExpired ? t('source.expired') : t('source.expireDate', { date: formatExpire(info.expire) })}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SourceManager() {
  const { t } = useTranslation()
  const { sources, proxyGroups, addSource, updateSource, removeSource, resetSources, updateProxy } = useAppStore()
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newUa, setNewUa] = useState(DEFAULT_USER_AGENT)
  const [customUa, setCustomUa] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState<{ done: number; total: number } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const confirmResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [globalIpVersion, setGlobalIpVersion] = useState('ipv4')

  const handleApplyGlobalIpVersion = () => {
    for (const source of sources) {
      source.proxies.forEach((_, i) => updateProxy(source.id, i, { 'ip-version': globalIpVersion }))
    }
  }

  const handleResetClick = () => {
    if (confirmReset) {
      resetSources()
      setConfirmReset(false)
      if (confirmResetTimer.current) clearTimeout(confirmResetTimer.current)
    } else {
      setConfirmReset(true)
      confirmResetTimer.current = setTimeout(() => setConfirmReset(false), 3000)
    }
  }

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
    let dupGroupCount = 0
    for (const [, srcs] of groupMap) {
      if (srcs.length > 1) dupGroupCount++
    }
    const dupProxyCount = [...nameMap.values()].filter((c) => c > 1).length
    return { dupProxyCount, dupGroupCount }
  }, [sources, proxyGroups])

  const resolvedUa = newUa === '__custom__' ? customUa : newUa

  const loadSource = useCallback(async (id: string, url: string, ua?: string) => {
    updateSource(id, { status: 'loading', error: undefined })
    try {
      const { proxies, groups, subscriptionInfo } = await fetchAndParseYaml(url, ua)
      updateSource(id, { status: 'success', proxies, importedGroups: groups, subscriptionInfo })
    } catch (err) {
      updateSource(id, { status: 'error', error: (err as Error).message, proxies: [] })
    }
  }, [updateSource])

  const handleAddSource = () => {
    if (!newUrl.trim()) return
    let name = newName.trim()
    try { name = name || new URL(newUrl).hostname } catch { name = name || newUrl }
    const id = addSource({ name, url: newUrl.trim(), userAgent: resolvedUa || DEFAULT_USER_AGENT })
    setNewUrl('')
    setNewName('')
    loadSource(id, newUrl.trim(), resolvedUa || DEFAULT_USER_AGENT)
  }

  const handleRefreshAll = async () => {
    const activeSources = sources.filter((s) => s.url && !s.url.startsWith('file://'))
    if (activeSources.length === 0) return
    setRefreshingAll(true)
    setRefreshProgress({ done: 0, total: activeSources.length })

    await Promise.allSettled(
      activeSources.map(async (src) => {
        await loadSource(src.id, src.url, src.userAgent)
        setRefreshProgress((prev) => prev ? { ...prev, done: prev.done + 1 } : null)
      })
    )
    setRefreshingAll(false)
    setTimeout(() => setRefreshProgress(null), 1500)
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

  const hasRefreshableSources = sources.some((s) => s.url && !s.url.startsWith('file://'))

  return (
    <div className="h-full overflow-y-auto">
      {/* Form */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            {t('source.heading')}
          </h2>
          <div className="flex items-center gap-2">
          {sources.some((s) => s.proxies.length > 0) && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 whitespace-nowrap">
                {t('source.globalIpVersionLabel')}
              </span>
              <select
                value={globalIpVersion}
                onChange={(e) => setGlobalIpVersion(e.target.value)}
                className="text-xs px-1.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {IP_VERSION_OPTS.filter((o) => o.value !== '').map((o) => (
                  <option key={o.value} value={o.value}>{o.value}</option>
                ))}
              </select>
              <button
                onClick={handleApplyGlobalIpVersion}
                title={t('source.applyGlobalIpVersion')}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-medium transition-all whitespace-nowrap"
              >
                {t('source.applyGlobalIpVersion')}
              </button>
            </div>
          )}
          {sources.length > 0 && (
            <button
              onClick={handleResetClick}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                confirmReset
                  ? 'bg-red-500 border-red-500 text-white hover:bg-red-600'
                  : 'border-red-200 dark:border-red-800/50 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
              }`}
            >
              <Trash2 size={11} />
              {confirmReset ? t('source.confirmReset') : t('source.reset')}
            </button>
          )}
          {hasRefreshableSources && (
            <button
              onClick={handleRefreshAll}
              disabled={refreshingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 disabled:opacity-60 transition-all"
            >
              {refreshingAll
                ? <><Loader size={12} className="animate-spin" />
                    {refreshProgress ? `${refreshProgress.done}/${refreshProgress.total}` : t('source.refreshing')}</>
                : <><RotateCcw size={12} />{t('source.refreshAll')}</>
              }
            </button>
          )}
        </div>
        </div>

        <div className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/60">
          <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
            {t('source.proxyNotice').replace('<code>', '').replace('</code>', '')}
          </p>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <input ref={nameInputRef} type="text" placeholder={t('source.namePlaceholder')} value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-800" />
            <EmojiPicker inputRef={nameInputRef} value={newName} onChange={setNewName} onSelect={(e) => setNewName((n) => n + e)} />
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder={t('source.urlPlaceholder')} value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-800" />
            <button onClick={handleAddSource} disabled={!newUrl.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-xl shadow-sm shadow-indigo-200 dark:shadow-none font-medium transition-all">
              <Plus size={16} />
            </button>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/60 rounded-xl px-3 py-2 leading-relaxed">
            {t('source.airportHint')}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0 w-20">{t('source.userAgent')}</span>
            <div className="relative flex-1">
              <select value={newUa} onChange={(e) => setNewUa(e.target.value)}
                className="w-full text-xs pl-3 pr-7 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none cursor-pointer">
                {PRESET_USER_AGENTS.map((p) => {
                  const label = p.value === DEFAULT_USER_AGENT
                    ? `Clash Verge Rev (${t('source.defaultUserAgent')})`
                    : p.value === '__custom__'
                      ? t('source.customUserAgent')
                      : p.label
                  return <option key={p.value} value={p.value}>{label}</option>
                })}
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
          </div>
          {newUa === '__custom__' ? (
            <input type="text" placeholder={t('source.customUaPlaceholder')} value={customUa}
              onChange={(e) => setCustomUa(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
          ) : (
            <p className="text-xs text-gray-400">
              {t('source.uaHint')}
              <a href="https://github.com/clash-verge-rev/clash-verge-rev/releases"
                target="_blank" rel="noopener noreferrer" className="ml-1 text-indigo-500 hover:text-indigo-400 hover:underline">{t('source.uaCheckLatest')}</a>
            </p>
          )}
          <label className="flex items-center gap-2.5 px-3 py-2.5 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all text-gray-400 dark:text-gray-500">
            <Upload size={14} />
            <span>{t('source.uploadYaml')}</span>
            <input type="file" accept=".yaml,.yml" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {(totalDupProxy > 0 || totalDupGroup > 0) && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/15 px-3.5 py-3 flex items-start gap-2.5">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {totalDupProxy > 0 && <span dangerouslySetInnerHTML={{ __html: t('source.dupProxy', { count: totalDupProxy }) }} />}
              {totalDupProxy > 0 && totalDupGroup > 0 && <span className="mx-1">·</span>}
              {totalDupGroup > 0 && <span dangerouslySetInnerHTML={{ __html: t('source.dupGroup', { count: totalDupGroup }) }} />}
              {t('source.dupBanner')}
            </p>
          </div>
        )}

        {sources.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300 dark:text-gray-600">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Globe size={28} className="opacity-60" />
            </div>
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">{t('source.empty')}</p>
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
  const { t } = useTranslation()
  const { sources, updateProxy, applyPrefixToSource, importSourceGroup, proxyGroups } = useAppStore()

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
  const [batchIpVersion, setBatchIpVersion] = useState('ipv4')

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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <StatusIcon status={source.status} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{source.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate font-mono">{source.url}</p>
          {source.userAgent && <p className="text-xs text-indigo-400 truncate font-mono">UA: {source.userAgent}</p>}

          {source.subscriptionInfo && (() => {
            const info = source.subscriptionInfo!
            const used = info.upload + info.download
            const pct = info.total > 0 ? Math.min((used / info.total) * 100, 100) : 0
            const isExpiringSoon = info.expire && info.expire - Date.now() / 1000 < 7 * 86400
            const isExpired = info.expire && info.expire < Date.now() / 1000
            return (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium tabular-nums">
                    {formatBytes(used)}
                    <span className="text-gray-300 dark:text-gray-600 mx-1">/</span>
                    {formatBytes(info.total)}
                    <span className="text-gray-300 dark:text-gray-600 mx-1.5">·</span>
                    <span className={pct >= 90 ? 'text-red-500 font-semibold' : pct >= 70 ? 'text-amber-500 font-semibold' : 'text-indigo-500'}>
                      {t('source.usedPercent', { pct: pct.toFixed(1) })}
                    </span>
                  </span>
                  {info.expire !== undefined && (
                    <span className={`text-[11px] font-medium ${
                      isExpired ? 'text-red-500' : isExpiringSoon ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {isExpired ? t('source.warningExpired') : t('source.expireDate', { date: formatExpire(info.expire) })}
                    </span>
                  )}
                </div>
                <div className="h-1 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })()}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {source.status === 'success' && (
            <span className="text-xs bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium border border-emerald-200 dark:border-emerald-800/50">
              {t('source.nodeCount', { count: source.proxies.length })}
            </span>
          )}
          {importedGroups.length > 0 && (
            <span className="text-xs bg-indigo-50 dark:bg-indigo-900/25 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium border border-indigo-200 dark:border-indigo-800/50">
              {t('source.groupCount', { count: importedGroups.length })}
            </span>
          )}
          {dupProxyCount > 0 && (
            <span className="text-xs bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium border border-amber-200 dark:border-amber-800/50">
              {t('source.dupCount', { count: dupProxyCount })}
            </span>
          )}
          <button onClick={onReload} disabled={source.status === 'loading'}
            className="p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 transition-all">
            <RefreshCw size={14} className={source.status === 'loading' ? 'animate-spin' : ''} />
          </button>
          <button onClick={onRemove}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {source.error && (
        <div className="mx-4 mb-3 px-3 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/50 rounded-lg">
          {source.error}
        </div>
      )}

      {source.status === 'success' && source.proxies.length > 0 && (
        <ProtocolChart proxies={source.proxies} />
      )}

      {source.status === 'success' && source.proxies.length > 0 && (
        <GeoChart proxies={source.proxies} />
      )}

      {/* Tools bar */}
      {hasTools && (
        <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-2.5 flex items-center gap-2 flex-wrap bg-gray-50/80 dark:bg-gray-700/20">
          <Tag size={11} className="text-gray-400 shrink-0" />
          <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyPrefix()}
            placeholder={t('source.batchPrefix')}
            className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400" />
          <button onClick={handleApplyPrefix} disabled={!prefix.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium transition-all shrink-0">
            {t('source.applyPrefix')}
          </button>
          {(dupProxyCount > 0 || dupGroupCount > 0) && (
            <button onClick={handleQuickPrefix}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all shrink-0"
              title={`前缀 "${source.name.replace(/\s+/g, '-')}|"`}>
              <AlertTriangle size={11} />
              {t('source.quickPrefix')}
            </button>
          )}
          {source.proxies.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={batchIpVersion}
                onChange={(e) => setBatchIpVersion(e.target.value)}
                className="text-xs px-1.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {IP_VERSION_OPTS.filter((o) => o.value !== '').map((o) => (
                  <option key={o.value} value={o.value}>{o.value}</option>
                ))}
              </select>
              <button
                onClick={() => source.proxies.forEach((_, i) => updateProxy(source.id, i, { 'ip-version': batchIpVersion }))}
                title={t('source.batchSetIpVersion')}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-medium transition-all whitespace-nowrap"
              >
                {t('source.batchSetIpVersion')}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {source.proxies.length > 0 && (
              <button onClick={() => setShowProxies((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all">
                {showProxies ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {t('source.nodes')}
              </button>
            )}
            {importedGroups.length > 0 && (
              <button onClick={() => setShowGroups((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all">
                {showGroups ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {t('source.proxyGroups')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Proxy list */}
      {showProxies && source.proxies.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700/50">
          <div className="px-4 pt-2.5 pb-1.5">
            <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder={t('source.filterPlaceholder')}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-800" />
          </div>
          <div className="max-h-52 overflow-y-auto px-3 pb-2">
            {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-3">{t('source.noMatch')}</p>}
            {filtered.map((proxy) => {
              const realIdx = source.proxies.indexOf(proxy)
              return (
                <ProxyRow key={realIdx} name={proxy.name} type={String(proxy.type ?? '')}
                  server={String(proxy.server ?? '')}
                  ipVersion={String(proxy['ip-version'] ?? '')}
                  onChange={(n) => updateProxy(source.id, realIdx, { name: n })}
                  onChangeIpVersion={(v) => updateProxy(source.id, realIdx, { 'ip-version': v || undefined })} />
              )
            })}
          </div>
        </div>
      )}

      {/* Imported proxy groups */}
      {showGroups && importedGroups.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700/50">
          <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{t('source.sourceGroups')}</span>
            {dupGroupCount > 0 && (
              <button onClick={handleQuickPrefix}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-all"
                title={`代理组名加前缀 "${source.name.replace(/\s+/g, '-')}|"`}>
                <AlertTriangle size={11} />
                {t('source.addSource')}
              </button>
            )}
            <button
              onClick={() => {
                for (const g of importedGroups) {
                  if (!importedNames.has(g.name)) importSourceGroup(source.id, g.name)
                }
              }}
              className="ml-auto text-xs px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all">
              {t('source.importAll')}
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto px-3 pb-2.5 space-y-0.5">
            {importedGroups.map((g) => {
              const isDup = dupGroupNames.has(g.name)
              const alreadyIn = importedNames.has(g.name)
              return (
                <div key={g.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <Layers size={11} className="text-gray-400 shrink-0" />
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-mono shrink-0 ${
                    g.type === 'select' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                    : g.type === 'url-test' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>{g.type}</span>
                  <span className="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-300 truncate">{g.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{t('source.nodeCount', { count: g.proxies.length })}</span>
                  {isDup && (
                    <span className="shrink-0" title={dupGroupNames.get(g.name)?.join(', ')}>
                      <AlertTriangle size={11} className="text-amber-500" />
                    </span>
                  )}
                  {alreadyIn ? (
                    <span className="text-xs text-emerald-500 shrink-0 flex items-center gap-0.5 font-medium"><Check size={11} />{t('source.imported')}</span>
                  ) : (
                    <button onClick={() => importSourceGroup(source.id, g.name)}
                      className="text-xs px-2 py-0.5 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-medium transition-all shrink-0">
                      {t('source.import')}
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
function ProxyRow({ name, type, server, ipVersion, onChange, onChangeIpVersion }: {
  name: string
  type: string
  server?: string
  ipVersion?: string
  onChange: (n: string) => void
  onChangeIpVersion?: (v: string) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [ipState, setIpState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [resolvedIp, setResolvedIp] = useState<string>('')

  const commit = () => {
    const tp = draft.trim()
    if (tp && tp !== name) onChange(tp); else setDraft(name)
    setEditing(false)
  }

  const handleCheckIp = async () => {
    if (!server || ipState === 'loading') return
    setIpState('loading')
    try {
      const ip = await resolveToIp(server)
      setResolvedIp(ip)
      setIpState('done')
      window.open(`https://ippure.com/?ip=${encodeURIComponent(ip)}`, '_blank', 'noopener,noreferrer')
    } catch {
      setIpState('error')
      if (server) window.open(`https://ippure.com/?ip=${encodeURIComponent(server)}`, '_blank', 'noopener,noreferrer')
    }
  }

  const BADGE_COLOR: Record<string, string> = {
    ss:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    ssr:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    vmess:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    vless:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    trojan:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    hysteria2: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    hysteria:  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    tuic:      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  }

  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-indigo-50/60 dark:hover:bg-indigo-900/10 transition-colors">
      <span className={`text-[10px] px-1.5 py-0.5 rounded-md shrink-0 font-mono font-medium ${BADGE_COLOR[type.toLowerCase()] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
        {type || '?'}
      </span>
      {editing ? (
        <>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(name); setEditing(false) } }}
            className="flex-1 min-w-0 text-xs px-2 py-0.5 rounded-lg border border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          <button onClick={commit} className="p-1 text-emerald-500 hover:text-emerald-400 shrink-0"><Check size={12} /></button>
          <button onClick={() => { setDraft(name); setEditing(false) }} className="p-1 text-gray-400 hover:text-gray-600 shrink-0"><X size={12} /></button>
        </>
      ) : (
        <>
          <span className="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-300 truncate">{name}</span>
          {ipState === 'done' && resolvedIp && !IP_RE.test(server ?? '') && (
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 shrink-0">{resolvedIp}</span>
          )}
          {onChangeIpVersion && (
            <select
              value={ipVersion ?? ''}
              onChange={(e) => onChangeIpVersion(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              title={t('source.ipVersionTitle')}
              className={`shrink-0 text-[10px] rounded px-1 py-0.5 border focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer transition-colors
                ${ipVersion
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'opacity-0 group-hover:opacity-100 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}
            >
              {IP_VERSION_OPTS.map((o) => (
                <option key={o.value} value={o.value}>{o.value || t('source.defaultIpVersion')}</option>
              ))}
            </select>
          )}
          {server && (
            <button
              onClick={handleCheckIp}
              disabled={ipState === 'loading'}
              title={ipState === 'done' ? t('source.ipQualityTitle_done', { ip: resolvedIp }) : t('source.ipQualityTitle_idle', { server })}
              className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all shrink-0 ${
                ipState === 'error' ? 'text-red-400' :
                ipState === 'done'  ? 'text-emerald-500 opacity-100' :
                'text-gray-400 hover:text-violet-500'
              }`}
            >
              {ipState === 'loading'
                ? <Loader size={11} className="animate-spin" />
                : <ExternalLink size={11} />}
            </button>
          )}
          <button onClick={() => { setDraft(name); setEditing(true) }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-indigo-500 transition-all shrink-0">
            <Pencil size={11} />
          </button>
        </>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'loading': return <Loader size={15} className="text-indigo-500 animate-spin" />
    case 'success': return <CheckCircle size={15} className="text-emerald-500" />
    case 'error':   return <XCircle size={15} className="text-red-500" />
    default:        return <div className="w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-600" />
  }
}
