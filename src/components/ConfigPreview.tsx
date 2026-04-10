import { useState, useEffect, useMemo, useRef } from 'react'
import { Copy, Download, Check, FileText, ChevronRight, CheckCircle, XCircle, Upload, X, ShieldCheck } from 'lucide-react'
import yaml from 'js-yaml'
import { useAppStore } from '../store/useAppStore'
import { generateClashConfig } from '../utils/parseYaml'
import ValidationPanel from './ValidationPanel'
import type { ClashConfig, DnsConfig, DnsFallbackFilter } from '../types/clash'

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function parseArr(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}
function joinArr(a: string[]): string {
  return a.join(', ')
}

/** Text input that syncs to store on blur to avoid per-keystroke re-renders */
function BlurInput({
  value,
  onChange,
  className = '',
  placeholder = '',
  type = 'text',
}: {
  value: string | number
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  type?: string
}) {
  const [local, setLocal] = useState(String(value))
  useEffect(() => { setLocal(String(value)) }, [value])
  return (
    <input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onChange(local)}
      className={`text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  )
}

/** Toggle switch */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-3' : 'translate-x-0'}`} />
    </button>
  )
}

/** Collapsible section */
function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 w-full text-left py-1 mb-1"
      >
        <ChevronRight size={11} className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {title}
        </span>
      </button>
      {open && <div className="space-y-1.5 pl-3">{children}</div>}
    </div>
  )
}

/** Label + control row */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-36 shrink-0 text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── Settings Panel ─────────────────────────────────────────────────────────────
function SettingsPanel() {
  const { globalSettings, updateGlobalSettings, updateDnsSettings, updateDnsFallbackFilter } = useAppStore()
  const gs = globalSettings
  const dns = gs.dns
  const ff = dns['fallback-filter']

  const updDns = (k: keyof Omit<DnsConfig, 'fallback-filter'>, v: unknown) =>
    updateDnsSettings({ [k]: v } as Partial<Omit<DnsConfig, 'fallback-filter'>>)

  const updFF = (k: keyof DnsFallbackFilter, v: unknown) =>
    updateDnsFallbackFilter({ [k]: v } as Partial<DnsFallbackFilter>)

  const sel = 'text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none'

  return (
    <div className="space-y-4">
      <Section title="基本设置">
        <Row label="mixed-port">
          <BlurInput
            type="number"
            value={gs['mixed-port']}
            onChange={(v) => updateGlobalSettings({ 'mixed-port': parseInt(v) || 7890 })}
            className="w-20"
          />
        </Row>
        <Row label="allow-lan">
          <Toggle checked={gs['allow-lan']} onChange={(v) => updateGlobalSettings({ 'allow-lan': v })} />
        </Row>
        <Row label="bind-address">
          <BlurInput value={gs['bind-address']} onChange={(v) => updateGlobalSettings({ 'bind-address': v })} className="w-full" />
        </Row>
        <Row label="mode">
          <select value={gs.mode} onChange={(e) => updateGlobalSettings({ mode: e.target.value })} className={sel}>
            {['rule', 'global', 'direct'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="log-level">
          <select value={gs['log-level']} onChange={(e) => updateGlobalSettings({ 'log-level': e.target.value })} className={sel}>
            {['debug', 'info', 'warning', 'error', 'silent'].map((l) => <option key={l}>{l}</option>)}
          </select>
        </Row>
        <Row label="external-controller">
          <BlurInput value={gs['external-controller']} onChange={(v) => updateGlobalSettings({ 'external-controller': v })} className="w-full" />
        </Row>
        <Row label="tcp-concurrent">
          <Toggle checked={gs['tcp-concurrent'] ?? false} onChange={(v) => updateGlobalSettings({ 'tcp-concurrent': v })} />
        </Row>
        <Row label="unified-delay">
          <Toggle checked={gs['unified-delay'] ?? false} onChange={(v) => updateGlobalSettings({ 'unified-delay': v })} />
        </Row>
        <Row label="find-process-mode">
          <select value={gs['find-process-mode'] ?? 'strict'} onChange={(e) => updateGlobalSettings({ 'find-process-mode': e.target.value })} className={sel}>
            {['always', 'strict', 'off'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="global-fingerprint">
          <select value={gs['global-client-fingerprint'] ?? 'chrome'} onChange={(e) => updateGlobalSettings({ 'global-client-fingerprint': e.target.value })} className={sel}>
            {['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', '360', 'qq', 'random'].map((f) => <option key={f}>{f}</option>)}
          </select>
        </Row>
      </Section>

      <Section title="Sniffer（嗅探）" defaultOpen={false}>
        <Row label="enable">
          <Toggle
            checked={gs.sniffer?.enable ?? false}
            onChange={(v) => updateGlobalSettings({ sniffer: { ...gs.sniffer!, enable: v } })}
          />
        </Row>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-snug pl-1">
          开启后 Clash 可识别 HTTP/TLS/QUIC 流量的真实域名，让域名规则覆盖直连 IP 请求。
        </p>
      </Section>

      <Section title="GeoData" defaultOpen={false}>
        <Row label="geodata-mode">
          <Toggle checked={gs['geodata-mode'] ?? false} onChange={(v) => updateGlobalSettings({ 'geodata-mode': v })} />
        </Row>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-snug pl-1">
          启用后使用 MetaCubeX .dat 格式 GeoIP/GeoSite 数据库，精度更高。数据从 jsdelivr CDN 下载，首次启动需联网。
        </p>
      </Section>

      <Section title="DNS 设置">
        <Row label="enable">
          <Toggle checked={dns.enable} onChange={(v) => updDns('enable', v)} />
        </Row>
        <Row label="ipv6">
          <Toggle checked={dns.ipv6} onChange={(v) => updDns('ipv6', v)} />
        </Row>
        <Row label="enhanced-mode">
          <select value={dns['enhanced-mode']} onChange={(e) => updDns('enhanced-mode', e.target.value)} className={sel}>
            {['fake-ip', 'redir-host'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="fake-ip-range">
          <BlurInput value={dns['fake-ip-range']} onChange={(v) => updDns('fake-ip-range', v)} className="w-full" />
        </Row>
        <Row label="use-hosts">
          <Toggle checked={dns['use-hosts']} onChange={(v) => updDns('use-hosts', v)} />
        </Row>
        <Row label="respect-rules">
          <Toggle checked={dns['respect-rules']} onChange={(v) => updDns('respect-rules', v)} />
        </Row>
        <Row label="default-nameserver">
          <BlurInput
            value={joinArr(dns['default-nameserver'])}
            onChange={(v) => updDns('default-nameserver', parseArr(v))}
            placeholder="223.5.5.5, 119.29.29.29"
            className="w-full"
          />
        </Row>
        <Row label="nameserver (DoH)">
          <BlurInput
            value={joinArr(dns.nameserver)}
            onChange={(v) => updDns('nameserver', parseArr(v))}
            placeholder="https://doh.pub/dns-query"
            className="w-full"
          />
        </Row>
        <Row label="proxy-server-ns">
          <BlurInput
            value={joinArr(dns['proxy-server-nameserver'])}
            onChange={(v) => updDns('proxy-server-nameserver', parseArr(v))}
            placeholder="https://doh.pub/dns-query"
            className="w-full"
          />
        </Row>
        <Row label="fallback (DoH)">
          <BlurInput
            value={joinArr(dns.fallback)}
            onChange={(v) => updDns('fallback', parseArr(v))}
            placeholder="https://1.1.1.1/dns-query"
            className="w-full"
          />
        </Row>
        <Row label="fake-ip-filter">
          <BlurInput
            value={joinArr(dns['fake-ip-filter'] ?? [])}
            onChange={(v) => updDns('fake-ip-filter', parseArr(v))}
            placeholder="*.lan, *.local, ..."
            className="w-full"
          />
        </Row>
      </Section>

      <Section title="Fallback Filter" defaultOpen={false}>
        <Row label="geoip">
          <Toggle checked={ff.geoip} onChange={(v) => updFF('geoip', v)} />
        </Row>
        <Row label="geoip-code">
          <BlurInput value={ff['geoip-code']} onChange={(v) => updFF('geoip-code', v)} className="w-16" />
        </Row>
        <Row label="geosite">
          <BlurInput
            value={joinArr(ff.geosite)}
            onChange={(v) => updFF('geosite', parseArr(v))}
            placeholder="gfw"
            className="w-full"
          />
        </Row>
        <Row label="ipcidr">
          <BlurInput
            value={joinArr(ff.ipcidr)}
            onChange={(v) => updFF('ipcidr', parseArr(v))}
            placeholder="240.0.0.0/4"
            className="w-full"
          />
        </Row>
        <Row label="domain">
          <BlurInput
            value={joinArr(ff.domain)}
            onChange={(v) => updFF('domain', parseArr(v))}
            placeholder="+.google.com, +.youtube.com"
            className="w-full"
          />
        </Row>
      </Section>
    </div>
  )
}

// ── ImportModal ───────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (config: ClashConfig) => void }) {
  const [tab, setTab] = useState<'file' | 'paste'>('file')
  const [pasteText, setPasteText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<{ proxies: number; groups: number; rules: number; providers: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ClashConfig | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function parseConfig(text: string) {
    try {
      const config = yaml.load(text) as ClashConfig
      if (!config || typeof config !== 'object') throw new Error('不是有效的 YAML 对象')
      setParsed(config)
      setError(null)
      setPreview({
        proxies: Array.isArray(config.proxies) ? config.proxies.length : 0,
        groups: Array.isArray(config['proxy-groups']) ? config['proxy-groups'].length : 0,
        rules: Array.isArray(config.rules) ? config.rules.length : 0,
        providers: config['rule-providers'] ? Object.keys(config['rule-providers']).length : 0,
      })
    } catch (e) {
      setParsed(null)
      setPreview(null)
      setError((e as Error).message)
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => parseConfig(e.target?.result as string)
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">导入配置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(['file', 'paste'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setParsed(null); setPreview(null); setError(null) }}
              className={`px-5 py-2.5 text-xs font-medium transition-colors ${
                tab === t
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t === 'file' ? '上传文件' : '粘贴文本'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {tab === 'file' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 h-40 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                dragOver
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Upload size={24} className="text-gray-400" />
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">拖拽 YAML 文件到此处，或点击选择</p>
                <p className="text-xs text-gray-400 mt-1">.yaml / .yml</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".yaml,.yml"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          ) : (
            <textarea
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); if (e.target.value.trim()) { parseConfig(e.target.value) } else { setParsed(null); setPreview(null); setError(null) } }}
              placeholder="将 Clash/Mihomo YAML 配置粘贴到这里..."
              className="w-full h-52 text-xs font-mono px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          )}

          {/* Parse preview */}
          {preview && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-green-700 dark:text-green-400">解析成功，将导入：</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-green-600 dark:text-green-500">
                <span>节点 <strong>{preview.proxies}</strong> 个</span>
                <span>代理组 <strong>{preview.groups}</strong> 个</span>
                <span>规则 <strong>{preview.rules}</strong> 条</span>
                <span>规则集 <strong>{preview.providers}</strong> 个</span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ 导入将覆盖当前的代理组、规则和规则集，节点将追加为新订阅源</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-xs text-red-600 dark:text-red-400">解析失败：{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            disabled={!parsed}
            onClick={() => { if (parsed) { onImport(parsed); onClose() } }}
            className="px-4 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ConfigPreview ─────────────────────────────────────────────────────────────
export default function ConfigPreview() {
  const { sources, manualProxies, proxyGroups, ruleProviders, rules, globalSettings, importFullConfig } = useAppStore()
  const [copied, setCopied] = useState(false)
  const [filename, setFilename] = useState('config.yaml')
  const [editingFilename, setEditingFilename] = useState(false)
  const [softWrap, setSoftWrap] = useState(false)
  const [flowArrays, setFlowArrays] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const allProxies = [...sources.flatMap((s) => s.proxies), ...manualProxies]
  const enabledProviders = ruleProviders.filter((p) => p.enabled)

  const allProxyNames = allProxies.map((p) => p.name)

  const configYaml = generateClashConfig(
    allProxies,
    proxyGroups.map((g) => ({
      name: g.name,
      type: g.type,
      proxies: g.autoAllNodes ? allProxyNames : g.proxies,
      url: g.url,
      interval: g.interval,
      tolerance: g.tolerance,
      lazy: g.lazy,
    })),
    ruleProviders,
    rules.map((r) => ({ type: r.type, payload: r.payload, target: r.target, noResolve: r.noResolve })),
    globalSettings,
    flowArrays
  )

  // Validate generated YAML by re-parsing it
  const yamlValidation = useMemo(() => {
    try {
      yaml.load(configYaml)
      return { valid: true, error: undefined }
    } catch (e) {
      return { valid: false, error: (e as Error).message }
    }
  }, [configYaml])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(configYaml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const name = filename.trim() || 'config.yaml'
    const blob = new Blob([configYaml], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name.endsWith('.yaml') || name.endsWith('.yml') ? name : `${name}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full min-h-0">
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importFullConfig} />}
      {/* Left: settings panel */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700">
        <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">全局配置</h3>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <SettingsPanel />
          {/* Validation section */}
          <div>
            <button
              onClick={() => {}}
              className="flex items-center gap-1.5 w-full text-left py-1 mb-2"
            >
              <ShieldCheck size={12} className="text-indigo-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">配置校验</span>
            </button>
            <ValidationPanel />
          </div>
        </div>
      </div>

      {/* Right: preview — fills remaining space edge-to-edge */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-wrap">
          <FileText size={14} className="text-gray-400 shrink-0" />

          {/* Editable filename */}
          {editingFilename ? (
            <input
              autoFocus
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onBlur={() => setEditingFilename(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingFilename(false) }}
              className="text-xs px-2 py-1 rounded border border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none w-40 font-mono"
            />
          ) : (
            <button
              onClick={() => setEditingFilename(true)}
              className="text-xs font-mono text-gray-600 dark:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              title="点击编辑文件名"
            >
              {filename}
            </button>
          )}

          {/* Soft wrap toggle */}
          <button
            onClick={() => setSoftWrap((v) => !v)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              softWrap
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
            }`}
            title="切换自动换行"
          >
            soft wrap
          </button>

          {/* Flow arrays toggle */}
          <button
            onClick={() => setFlowArrays((v) => !v)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              flowArrays
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
            }`}
            title={flowArrays ? '当前：行内压缩模式，点击切换为展开模式' : '当前：展开模式，点击切换为行内压缩模式'}
          >
            {flowArrays ? '行内压缩' : '展开模式'}
          </button>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <Upload size={13} />
              导入配置
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
            >
              <Download size={13} />
              导出
            </button>
          </div>
        </div>

        {/* Code area — fills all remaining height, no padding so it's truly edge-to-edge */}
        <div className="flex-1 min-h-0 overflow-hidden bg-gray-950">
          <div className="h-full overflow-auto">
            <pre className={`p-4 text-xs text-green-300 font-mono leading-relaxed ${softWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
              {configYaml}
            </pre>
          </div>
        </div>

        {/* Stats bar */}
        <div className="shrink-0 border-t border-gray-800 px-4 py-1.5 flex items-center gap-4 text-xs text-gray-500 bg-gray-950">
          <span>节点 <strong className="text-gray-400">{allProxies.length}</strong></span>
          <span>代理组 <strong className="text-gray-400">{proxyGroups.length}</strong></span>
          <span>规则集 <strong className="text-gray-400">{enabledProviders.length}/{ruleProviders.length}</strong></span>
          <span>规则 <strong className="text-gray-400">{rules.length}</strong></span>
          <span className="ml-auto flex items-center gap-1">
            {yamlValidation.valid ? (
              <>
                <CheckCircle size={12} className="text-green-500" />
                <span className="text-green-500">YAML 合法</span>
              </>
            ) : (
              <>
                <XCircle size={12} className="text-red-400" />
                <span className="text-red-400" title={yamlValidation.error}>YAML 错误：{yamlValidation.error}</span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
