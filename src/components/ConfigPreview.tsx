import { useState, useEffect, useMemo } from 'react'
import { Copy, Download, Check, FileText, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import yaml from 'js-yaml'
import { useAppStore } from '../store/useAppStore'
import { generateClashConfig } from '../utils/parseYaml'
import type { DnsConfig, DnsFallbackFilter } from '../types/clash'

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
          <BlurInput
            value={gs['bind-address']}
            onChange={(v) => updateGlobalSettings({ 'bind-address': v })}
            className="w-full"
          />
        </Row>
        <Row label="mode">
          <select
            value={gs.mode}
            onChange={(e) => updateGlobalSettings({ mode: e.target.value })}
            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
          >
            {['rule', 'global', 'direct'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="log-level">
          <select
            value={gs['log-level']}
            onChange={(e) => updateGlobalSettings({ 'log-level': e.target.value })}
            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
          >
            {['debug', 'info', 'warning', 'error', 'silent'].map((l) => <option key={l}>{l}</option>)}
          </select>
        </Row>
        <Row label="external-controller">
          <BlurInput
            value={gs['external-controller']}
            onChange={(v) => updateGlobalSettings({ 'external-controller': v })}
            className="w-full"
          />
        </Row>
      </Section>

      <Section title="DNS 设置">
        <Row label="enable">
          <Toggle checked={dns.enable} onChange={(v) => updDns('enable', v)} />
        </Row>
        <Row label="ipv6">
          <Toggle checked={dns.ipv6} onChange={(v) => updDns('ipv6', v)} />
        </Row>
        <Row label="enhanced-mode">
          <select
            value={dns['enhanced-mode']}
            onChange={(e) => updDns('enhanced-mode', e.target.value)}
            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
          >
            {['fake-ip', 'redir-host', 'normal'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="fake-ip-range">
          <BlurInput
            value={dns['fake-ip-range']}
            onChange={(v) => updDns('fake-ip-range', v)}
            className="w-full"
          />
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
        <Row label="proxy-server-nameserver">
          <BlurInput
            value={joinArr(dns['proxy-server-nameserver'])}
            onChange={(v) => updDns('proxy-server-nameserver', parseArr(v))}
            placeholder="223.5.5.5, 8.8.8.8"
            className="w-full"
          />
        </Row>
        <Row label="nameserver">
          <BlurInput
            value={joinArr(dns.nameserver)}
            onChange={(v) => updDns('nameserver', parseArr(v))}
            placeholder="223.5.5.5, 114.114.114.114"
            className="w-full"
          />
        </Row>
        <Row label="fallback">
          <BlurInput
            value={joinArr(dns.fallback)}
            onChange={(v) => updDns('fallback', parseArr(v))}
            placeholder="1.1.1.1, 8.8.8.8"
            className="w-full"
          />
        </Row>
      </Section>

      <Section title="Fallback Filter" defaultOpen={false}>
        <Row label="geoip">
          <Toggle checked={ff.geoip} onChange={(v) => updFF('geoip', v)} />
        </Row>
        <Row label="geoip-code">
          <BlurInput
            value={ff['geoip-code']}
            onChange={(v) => updFF('geoip-code', v)}
            className="w-16"
          />
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

// ── ConfigPreview ─────────────────────────────────────────────────────────────
export default function ConfigPreview() {
  const { sources, proxyGroups, ruleProviders, rules, globalSettings } = useAppStore()
  const [copied, setCopied] = useState(false)
  const [filename, setFilename] = useState('config.yaml')
  const [editingFilename, setEditingFilename] = useState(false)
  const [softWrap, setSoftWrap] = useState(false)

  const allProxies = sources.flatMap((s) => s.proxies)
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
    globalSettings
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
      {/* Left: settings panel */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700">
        <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">全局配置</h3>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <SettingsPanel />
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

          <div className="flex gap-2 ml-auto">
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
