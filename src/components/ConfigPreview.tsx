import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Download, Check, FileText, ChevronRight, CheckCircle, XCircle, Upload, X, ShieldCheck, RotateCcw, Pencil } from 'lucide-react'
import yaml from 'js-yaml'
import { useAppStore } from '../store/useAppStore'
import { generateClashConfig } from '../utils/parseYaml'
import ValidationPanel from './ValidationPanel'
import { MERLIN_CLASH_ROUTER_GLOBAL_SETTINGS } from '../types/clash'
import type { ClashConfig, DnsConfig, DnsFallbackFilter } from '../types/clash'

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function parseArr(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}
function joinArr(a: string[]): string {
  return a.join(', ')
}

function parseHostEntries(s: string): Record<string, string> {
  return s
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const normalized = line.replace(/\s+/g, ' ')
      const [host, ip] = normalized.includes('=')
        ? normalized.split('=').map((part) => part.trim())
        : normalized.split(' ').map((part) => part.trim())
      if (host && ip) acc[host] = ip
      return acc
    }, {})
}

function stringifyHostEntries(hosts?: Record<string, string>): string {
  if (!hosts) return ''
  return Object.entries(hosts)
    .map(([host, ip]) => `${host} ${ip}`)
    .join('\n')
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
function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center">
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-[10px] font-semibold text-gray-400 dark:text-gray-500 cursor-help">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 w-56 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-[11px] leading-relaxed px-2.5 py-2 opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 shadow-lg whitespace-normal">
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        {text}
      </span>
    </span>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-36 shrink-0 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 leading-tight">
        <span>{label}</span>
        {hint ? <InfoTip text={hint} /> : null}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── Settings Panel ─────────────────────────────────────────────────────────────
function SettingsPanel() {
  const { t } = useTranslation()
  const h = (key: string) => t(`preview.settings.hints.${key}`)
  const { globalSettings, updateGlobalSettings, updateDnsSettings, updateDnsFallbackFilter } = useAppStore()
  const gs = globalSettings
  const dns = gs.dns
  const ff = dns['fallback-filter']

  const updDns = (k: keyof Omit<DnsConfig, 'fallback-filter'>, v: unknown) =>
    updateDnsSettings({ [k]: v } as Partial<Omit<DnsConfig, 'fallback-filter'>>)

  const updFF = (k: keyof DnsFallbackFilter, v: unknown) =>
    updateDnsFallbackFilter({ [k]: v } as Partial<DnsFallbackFilter>)

  const sel = 'text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none'
  const applyMerlinPreset = () => {
    const merlin = JSON.parse(JSON.stringify(MERLIN_CLASH_ROUTER_GLOBAL_SETTINGS)) as typeof MERLIN_CLASH_ROUTER_GLOBAL_SETTINGS
    const { dns: merlinDns, ...merlinTopLevel } = merlin
    updateGlobalSettings(merlinTopLevel)
    updateDnsSettings(merlinDns)
    if (merlinDns['fallback-filter']) {
      updateDnsFallbackFilter(merlinDns['fallback-filter'])
    }
  }

  return (
    <div className="space-y-4">
      {/* Documentation banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
        <span className="shrink-0">📖</span>
        <span>{t('preview.settings.docBanner')}</span>
        <a
          href="https://wiki.metacubex.one/config/general/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-900 dark:hover:text-blue-100 font-medium"
        >
          wiki.metacubex.one/config/general
        </a>
      </div>

      <Section title={t('preview.settings.merlinSection')} defaultOpen={false}>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          {t('preview.settings.merlinNote')}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={applyMerlinPreset}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
          >
            {t('preview.settings.merlinApply')}
          </button>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('preview.settings.merlinApplyNote')}
          </span>
        </div>
        <Row label="redir-port" hint={h('redirPort')}>
          <BlurInput
            type="number"
            value={gs['redir-port'] ?? 23457}
            onChange={(v) => updateGlobalSettings({ 'redir-port': parseInt(v) || 23457 })}
            className="w-20"
          />
        </Row>
        <Row label="routing-mark" hint={h('routingMark')}>
          <BlurInput
            type="number"
            value={gs['routing-mark'] ?? 255}
            onChange={(v) => updateGlobalSettings({ 'routing-mark': parseInt(v) || 255 })}
            className="w-20"
          />
        </Row>
        <Row label="hosts" hint={h('hosts')}>
          <textarea
            value={stringifyHostEntries(gs.hosts)}
            onChange={(e) => updateGlobalSettings({ hosts: parseHostEntries(e.target.value) })}
            placeholder={'services.googleapis.cn 74.125.193.94\ntime.android.com 203.107.6.88'}
            className="min-h-[68px] w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-mono dark:border-gray-600 dark:bg-gray-800"
          />
        </Row>
      </Section>

      <Section title={t('preview.settings.basicSection')}>
        <Row label="mixed-port" hint={h('mixedPort')}>
          <BlurInput
            type="number"
            value={gs['mixed-port']}
            onChange={(v) => updateGlobalSettings({ 'mixed-port': parseInt(v) || 7890 })}
            className="w-20"
          />
        </Row>
        <Row label="allow-lan" hint={h('allowLan')}>
          <Toggle checked={gs['allow-lan']} onChange={(v) => updateGlobalSettings({ 'allow-lan': v })} />
        </Row>
        <Row label="bind-address" hint={h('bindAddress')}>
          <BlurInput value={gs['bind-address']} onChange={(v) => updateGlobalSettings({ 'bind-address': v })} className="w-full" />
        </Row>
        <Row label="mode" hint={h('mode')}>
          <select value={gs.mode} onChange={(e) => updateGlobalSettings({ mode: e.target.value })} className={sel}>
            {['rule', 'global', 'direct'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="log-level" hint={h('logLevel')}>
          <select value={gs['log-level']} onChange={(e) => updateGlobalSettings({ 'log-level': e.target.value })} className={sel}>
            {['debug', 'info', 'warning', 'error', 'silent'].map((l) => <option key={l}>{l}</option>)}
          </select>
        </Row>
        <Row label="external-controller" hint={h('externalController')}>
          <BlurInput value={gs['external-controller']} onChange={(v) => updateGlobalSettings({ 'external-controller': v })} className="w-full" />
        </Row>
        <Row label="secret" hint={h('secret')}>
          <BlurInput value={gs.secret ?? ''} onChange={(v) => updateGlobalSettings({ secret: v })} className="w-full" />
        </Row>
        <Row label="cors origins" hint={h('corsOrigins')}>
          <BlurInput
            value={joinArr(gs['external-controller-cors']?.['allow-origins'] ?? ['*'])}
            onChange={(v) => updateGlobalSettings({
              'external-controller-cors': {
                ...gs['external-controller-cors'],
                'allow-origins': parseArr(v).length > 0 ? parseArr(v) : ['*'],
              },
            })}
            className="w-full"
          />
        </Row>
        <Row label="allow-private-network" hint={h('allowPrivateNetwork')}>
          <Toggle
            checked={gs['external-controller-cors']?.['allow-private-network'] ?? true}
            onChange={(v) => updateGlobalSettings({
              'external-controller-cors': {
                ...gs['external-controller-cors'],
                'allow-origins': gs['external-controller-cors']?.['allow-origins'] ?? ['*'],
                'allow-private-network': v,
              },
            })}
          />
        </Row>
        <Row label="external-ui" hint={h('externalUi')}>
          <BlurInput value={gs['external-ui'] ?? './ui'} onChange={(v) => updateGlobalSettings({ 'external-ui': v })} className="w-full" />
        </Row>
        <Row label="external-ui-name" hint={h('externalUiName')}>
          <BlurInput value={gs['external-ui-name'] ?? 'zashboard'} onChange={(v) => updateGlobalSettings({ 'external-ui-name': v })} className="w-full" />
        </Row>
        <Row label="external-ui-url" hint={h('externalUiUrl')}>
          <BlurInput value={gs['external-ui-url'] ?? ''} onChange={(v) => updateGlobalSettings({ 'external-ui-url': v })} className="w-full" />
        </Row>
        <Row label="tcp-concurrent" hint={h('tcpConcurrent')}>
          <Toggle checked={gs['tcp-concurrent'] ?? false} onChange={(v) => updateGlobalSettings({ 'tcp-concurrent': v })} />
        </Row>
        <Row label="unified-delay" hint={h('unifiedDelay')}>
          <Toggle checked={gs['unified-delay'] ?? false} onChange={(v) => updateGlobalSettings({ 'unified-delay': v })} />
        </Row>
        <Row label="ipv6" hint={h('ipv6')}>
          <Toggle checked={gs.ipv6 ?? false} onChange={(v) => updateGlobalSettings({ ipv6: v })} />
        </Row>
        <Row label="udp" hint={h('udp')}>
          <Toggle checked={gs.udp ?? false} onChange={(v) => updateGlobalSettings({ udp: v })} />
        </Row>
        {!(gs.udp ?? false) && (
          <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 leading-relaxed">
            <span className="font-semibold">{t('preview.udpOffWarnPrefix')}</span>
            <span dangerouslySetInnerHTML={{ __html: t('preview.udpOffWarn') }} />
            {' '}{t('preview.udpOffWarnChromeHint')}{' '}
            <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">chrome://flags/#enable-quic</code>
            <span dangerouslySetInnerHTML={{ __html: t('preview.udpOffWarnChromeEnd') }} />
          </div>
        )}
        <Row label="udp-timeout" hint={h('udpTimeout')}>
          <BlurInput
            type="number"
            value={gs['udp-timeout'] ?? 300}
            onChange={(v) => updateGlobalSettings({ 'udp-timeout': parseInt(v) || 300 })}
            className="w-20"
          />
        </Row>
        <Row label="keep-alive-interval" hint={h('keepAliveInterval')}>
          <BlurInput
            type="number"
            value={gs['keep-alive-interval'] ?? 15}
            onChange={(v) => updateGlobalSettings({ 'keep-alive-interval': parseInt(v) || 15 })}
            className="w-20"
          />
        </Row>
        <Row label="find-process-mode" hint={h('findProcessMode')}>
          <select value={gs['find-process-mode'] ?? 'strict'} onChange={(e) => updateGlobalSettings({ 'find-process-mode': e.target.value })} className={sel}>
            {['always', 'strict', 'off'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="global-fingerprint" hint={h('globalFingerprint')}>
          <select value={gs['global-client-fingerprint'] ?? 'chrome'} onChange={(e) => updateGlobalSettings({ 'global-client-fingerprint': e.target.value })} className={sel}>
            {['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', '360', 'qq', 'random'].map((f) => <option key={f}>{f}</option>)}
          </select>
        </Row>
        <Row label="prefer-h3" hint={h('preferH3')}>
          <Toggle checked={gs['prefer-h3'] ?? false} onChange={(v) => updateGlobalSettings({ 'prefer-h3': v })} />
        </Row>
      </Section>

      <Section title={t('preview.settings.snifferSection')} defaultOpen={false}>
        <Row label="enable" hint={h('snifferEnable')}>
          <Toggle
            checked={gs.sniffer?.enable ?? false}
            onChange={(v) => updateGlobalSettings({ sniffer: { ...gs.sniffer!, enable: v } })}
          />
        </Row>
        <Row label="parse-pure-ip" hint={h('parsePureIp')}>
          <Toggle
            checked={gs.sniffer?.['parse-pure-ip'] ?? false}
            onChange={(v) => updateGlobalSettings({ sniffer: { ...gs.sniffer!, 'parse-pure-ip': v } })}
          />
        </Row>
        <Row label="force-dns-mapping" hint={h('forceDnsMapping')}>
          <Toggle
            checked={gs.sniffer?.['force-dns-mapping'] ?? false}
            onChange={(v) => updateGlobalSettings({ sniffer: { ...gs.sniffer!, 'force-dns-mapping': v } })}
          />
        </Row>
        <Row label="override-destination" hint={h('overrideDestination')}>
          <Toggle
            checked={gs.sniffer?.['override-destination'] ?? false}
            onChange={(v) => updateGlobalSettings({ sniffer: { ...gs.sniffer!, 'override-destination': v } })}
          />
        </Row>
      </Section>

      <Section title="TUN" defaultOpen={false}>
        <Row label="enable" hint={h('tunEnable')}>
          <Toggle
            checked={gs.tun?.enable ?? false}
            onChange={(v) => updateGlobalSettings({ tun: { ...gs.tun!, enable: v } })}
          />
        </Row>
        <Row label="stack" hint={h('tunStack')}>
          <select
            value={gs.tun?.stack ?? 'mixed'}
            onChange={(e) => updateGlobalSettings({ tun: { ...gs.tun!, stack: e.target.value as 'system' | 'gvisor' | 'mixed' } })}
            className={sel}
          >
            {['system', 'gvisor', 'mixed'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="auto-route" hint={h('autoRoute')}>
          <Toggle
            checked={gs.tun?.['auto-route'] ?? true}
            onChange={(v) => updateGlobalSettings({ tun: { ...gs.tun!, 'auto-route': v } })}
          />
        </Row>
        <Row label="auto-redirect" hint={h('autoRedirect')}>
          <Toggle
            checked={gs.tun?.['auto-redirect'] ?? true}
            onChange={(v) => updateGlobalSettings({ tun: { ...gs.tun!, 'auto-redirect': v } })}
          />
        </Row>
        <Row label="auto-detect-if" hint={h('autoDetectIf')}>
          <Toggle
            checked={gs.tun?.['auto-detect-interface'] ?? true}
            onChange={(v) => updateGlobalSettings({ tun: { ...gs.tun!, 'auto-detect-interface': v } })}
          />
        </Row>
        <Row label="inet6-address" hint={h('inet6Address')}>
          <input
            type="text"
            value={(gs.tun?.['inet6-address'] ?? []).join(', ')}
            onChange={(e) => {
              const val = e.target.value.trim()
              const addrs = val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []
              updateGlobalSettings({ tun: { ...gs.tun!, 'inet6-address': addrs } })
            }}
            placeholder="fc00::a/112"
            className="w-48 rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
          />
        </Row>
      </Section>

      <Section title={t('preview.settings.geodataSection')} defaultOpen={false}>
        <Row label="geodata-mode" hint={h('geodataMode')}>
          <Toggle checked={gs['geodata-mode'] ?? false} onChange={(v) => updateGlobalSettings({ 'geodata-mode': v })} />
        </Row>
        <Row label="geo-auto-update" hint={h('geoAutoUpdate')}>
          <Toggle checked={gs['geo-auto-update'] ?? false} onChange={(v) => updateGlobalSettings({ 'geo-auto-update': v })} />
        </Row>
        <Row label="geo-update-interval" hint={h('geoUpdateInterval')}>
          <BlurInput
            type="number"
            value={gs['geo-update-interval'] ?? 72}
            onChange={(v) => updateGlobalSettings({ 'geo-update-interval': parseInt(v) || 72 })}
            className="w-20"
          />
        </Row>
        <Row label="geoip url" hint={h('geoipUrl')}>
          <BlurInput
            value={gs['geox-url']?.geoip ?? ''}
            onChange={(v) => updateGlobalSettings({ 'geox-url': { ...gs['geox-url'], geoip: v } })}
            className="w-full"
          />
        </Row>
        <Row label="geosite url" hint={h('geositeUrl')}>
          <BlurInput
            value={gs['geox-url']?.geosite ?? ''}
            onChange={(v) => updateGlobalSettings({ 'geox-url': { ...gs['geox-url'], geosite: v } })}
            className="w-full"
          />
        </Row>
        <Row label="mmdb url" hint={h('mmdbUrl')}>
          <BlurInput
            value={gs['geox-url']?.mmdb ?? ''}
            onChange={(v) => updateGlobalSettings({ 'geox-url': { ...gs['geox-url'], mmdb: v } })}
            className="w-full"
          />
        </Row>
      </Section>

      <Section title={t('preview.settings.profileSection')} defaultOpen={false}>
        <Row label="store-selected" hint={h('storeSelected')}>
          <Toggle
            checked={gs.profile?.['store-selected'] ?? false}
            onChange={(v) => updateGlobalSettings({ profile: { ...gs.profile, 'store-selected': v } })}
          />
        </Row>
        <Row label="store-fake-ip" hint={h('storeFakeIp')}>
          <Toggle
            checked={gs.profile?.['store-fake-ip'] ?? false}
            onChange={(v) => updateGlobalSettings({ profile: { ...gs.profile, 'store-fake-ip': v } })}
          />
        </Row>
      </Section>

      <Section title={t('preview.settings.dnsSection')}>
        {/* DNS flow diagram callout */}
        <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300">
          <span className="shrink-0">🔍</span>
          <span>{t('preview.settings.dnsFlowDiagram')}</span>
          <a
            href="https://wiki.metacubex.one/config/dns/diagram/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100"
          >
            {t('preview.settings.dnsFlowLink')}
          </a>
        </div>
        <Row label="enable" hint={h('dnsEnable')}>
          <Toggle checked={dns.enable} onChange={(v) => updDns('enable', v)} />
        </Row>
        <Row label="ipv6" hint={h('dnsIpv6')}>
          <Toggle checked={dns.ipv6} onChange={(v) => updDns('ipv6', v)} />
        </Row>
        <Row label="listen" hint={h('dnsListen')}>
          <BlurInput value={dns.listen ?? ':53'} onChange={(v) => updDns('listen', v)} className="w-full" />
        </Row>
        <Row label="enhanced-mode" hint={h('enhancedMode')}>
          <select value={dns['enhanced-mode']} onChange={(e) => updDns('enhanced-mode', e.target.value)} className={sel}>
            {['fake-ip', 'redir-host'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="fake-ip-filter-mode" hint={h('fakeIpFilterMode')}>
          <select
            value={dns['fake-ip-filter-mode'] ?? 'blacklist'}
            onChange={(e) => updDns('fake-ip-filter-mode', e.target.value)}
            className={sel}
          >
            {['blacklist', 'whitelist'].map((mode) => <option key={mode}>{mode}</option>)}
          </select>
        </Row>
        <Row label="fake-ip-range" hint={h('fakeIpRange')}>
          <BlurInput value={dns['fake-ip-range']} onChange={(v) => updDns('fake-ip-range', v)} className="w-full" />
        </Row>
        <Row label="use-hosts" hint={h('useHosts')}>
          <Toggle checked={dns['use-hosts'] ?? false} onChange={(v) => updDns('use-hosts', v)} />
        </Row>
        <Row label="respect-rules" hint={h('respectRules')}>
          <Toggle checked={dns['respect-rules']} onChange={(v) => updDns('respect-rules', v)} />
        </Row>
        <Row label="default-nameserver" hint={h('defaultNameserver')}>
          <BlurInput
            value={joinArr(dns['default-nameserver'] ?? [])}
            onChange={(v) => updDns('default-nameserver', parseArr(v))}
            placeholder="223.5.5.5, 119.29.29.29"
            className="w-full"
          />
        </Row>
        <Row label="nameserver" hint={h('nameserver')}>
          <BlurInput
            value={joinArr(dns.nameserver)}
            onChange={(v) => updDns('nameserver', parseArr(v))}
            placeholder="223.5.5.5, https://dns.google/dns-query"
            className="w-full"
          />
        </Row>
        <Row label="proxy-server-ns" hint={h('proxyServerNs')}>
          <BlurInput
            value={joinArr(dns['proxy-server-nameserver'])}
            onChange={(v) => updDns('proxy-server-nameserver', parseArr(v))}
            placeholder="223.5.5.5, 119.29.29.29"
            className="w-full"
          />
        </Row>
        <Row label="fallback" hint={h('fallback')}>
          <BlurInput
            value={joinArr(dns.fallback ?? [])}
            onChange={(v) => updDns('fallback', parseArr(v))}
            placeholder="https://1.1.1.1/dns-query"
            className="w-full"
          />
        </Row>
        <Row label="fake-ip-filter" hint={h('fakeIpFilter')}>
          <BlurInput
            value={joinArr(dns['fake-ip-filter'] ?? [])}
            onChange={(v) => updDns('fake-ip-filter', parseArr(v))}
            placeholder="*.lan, *.local, ..."
            className="w-full"
          />
        </Row>
      </Section>

      <Section title={t('preview.settings.fallbackFilterSection')} defaultOpen={false}>
        <Row label="geoip" hint={h('fallbackGeoip')}>
          <Toggle checked={ff?.geoip ?? false} onChange={(v) => updFF('geoip', v)} />
        </Row>
        <Row label="geoip-code" hint={h('geoipCode')}>
          <BlurInput value={ff?.['geoip-code'] ?? 'CN'} onChange={(v) => updFF('geoip-code', v)} className="w-16" />
        </Row>
        <Row label="geosite" hint={h('geosite')}>
          <BlurInput
            value={joinArr(ff?.geosite ?? [])}
            onChange={(v) => updFF('geosite', parseArr(v))}
            placeholder="gfw"
            className="w-full"
          />
        </Row>
        <Row label="ipcidr" hint={h('ipcidr')}>
          <BlurInput
            value={joinArr(ff?.ipcidr ?? [])}
            onChange={(v) => updFF('ipcidr', parseArr(v))}
            placeholder="240.0.0.0/4"
            className="w-full"
          />
        </Row>
        <Row label="domain" hint={h('domain')}>
          <BlurInput
            value={joinArr(ff?.domain ?? [])}
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
  const { t } = useTranslation()
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
      if (!config || typeof config !== 'object') throw new Error(t('preview.importModal.parseInvalidYaml'))
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
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('preview.importModal.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(['file', 'paste'] as const).map((tabName) => (
            <button
              key={tabName}
              onClick={() => { setTab(tabName); setParsed(null); setPreview(null); setError(null) }}
              className={`px-5 py-2.5 text-xs font-medium transition-colors ${
                tab === tabName
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tabName === 'file' ? t('preview.importModal.tabFile') : t('preview.importModal.tabPaste')}
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
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('preview.importModal.dropzone')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('preview.importModal.dropzoneHint')}</p>
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
              placeholder={t('preview.importModal.pastePlaceholder')}
              className="w-full h-52 text-xs font-mono px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          )}

          {/* Parse preview */}
          {preview && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-green-700 dark:text-green-400">{t('preview.importModal.parseSuccess')}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-green-600 dark:text-green-500">
                <span dangerouslySetInnerHTML={{ __html: t('preview.importModal.parseNodes', { count: preview.proxies }) }} />
                <span dangerouslySetInnerHTML={{ __html: t('preview.importModal.parseGroups', { count: preview.groups }) }} />
                <span dangerouslySetInnerHTML={{ __html: t('preview.importModal.parseRules', { count: preview.rules }) }} />
                <span dangerouslySetInnerHTML={{ __html: t('preview.importModal.parseProviders', { count: preview.providers }) }} />
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('preview.importModal.parseOverwriteWarn')}</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-xs text-red-600 dark:text-red-400">{t('preview.importModal.parseFailed', { error })}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('preview.importModal.cancel')}
          </button>
          <button
            disabled={!parsed}
            onClick={() => { if (parsed) { onImport(parsed); onClose() } }}
            className="px-4 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {t('preview.importModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ConfigPreview ─────────────────────────────────────────────────────────────
export default function ConfigPreview() {
  const { t } = useTranslation()
  const { sources, manualProxies, proxyGroups, ruleProviders, rules, globalSettings, importFullConfig } = useAppStore()
  const [copied, setCopied] = useState(false)
  const [filename, setFilename] = useState('config.yaml')
  const [editingFilename, setEditingFilename] = useState(false)
  const [softWrap, setSoftWrap] = useState(false)
  const [flowArrays, setFlowArrays] = useState(false)
  const [showImport, setShowImport] = useState(false)
  /** null = follow generated; string = user has manually edited */
  const [manualYaml, setManualYaml] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const allProxies = [...sources.flatMap((s) => s.proxies), ...manualProxies]
  const enabledProviders = ruleProviders.filter((p) => p.enabled)

  const allProxyNames = allProxies.map((p) => p.name)

  const configYaml = generateClashConfig(
    allProxies,
    proxyGroups.map((g) => ({
      name: g.name,
      type: g.type,
      proxies: g.autoAllNodes ? allProxyNames : g.proxies,
      ...(g.use && g.use.length > 0 ? { use: g.use } : {}),
      ...(g.timeout !== undefined ? { timeout: g.timeout } : {}),
      url: g.url,
      interval: g.interval,
      tolerance: g.tolerance,
      lazy: g.lazy,
      ...(g.hidden ? { hidden: true } : {}),
      ...(g.filter ? { filter: g.filter } : {}),
      ...(g['exclude-filter'] ? { 'exclude-filter': g['exclude-filter'] } : {}),
      ...(g.strategy ? { strategy: g.strategy } : {}),
    })),
    ruleProviders,
    rules.map((r) => ({ type: r.type, payload: r.payload, target: r.target, noResolve: r.noResolve })),
    globalSettings,
    flowArrays
  )

  const displayYaml = manualYaml ?? configYaml

  const yamlValidation = useMemo(() => {
    try {
      yaml.load(displayYaml)
      return { valid: true, error: undefined }
    } catch (e) {
      return { valid: false, error: (e as Error).message }
    }
  }, [displayYaml])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(displayYaml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [displayYaml])

  const handleDownload = useCallback(() => {
    const name = filename.trim() || 'config.yaml'
    const blob = new Blob([displayYaml], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name.endsWith('.yaml') || name.endsWith('.yml') ? name : `${name}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }, [displayYaml, filename])

  const handleReset = useCallback(() => {
    setManualYaml(null)
  }, [])

  return (
    <div className="flex h-full min-h-0">
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importFullConfig} />}
      {/* Left: settings panel */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700">
        <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('preview.globalConfig')}</h3>
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
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('preview.validationHeading')}</span>
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
              title={t('preview.filenameTitle')}
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
            title={t('preview.softWrapTitle')}
          >
            soft wrap
          </button>

          {/* Flow arrays toggle */}
          <div className="relative flex items-center gap-1">
            <button
              onClick={() => setFlowArrays((v) => !v)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                flowArrays
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
              }`}
              title={flowArrays ? t('preview.flowArraysTitle_on') : t('preview.flowArraysTitle_off')}
            >
              {flowArrays ? t('preview.flowArraysOn') : t('preview.flowArraysOff')}
            </button>
            {flowArrays && (
              <span className="relative group/tip cursor-default select-none text-[10px] text-amber-600 dark:text-amber-400">
                {t('preview.flowArraysWarn')}
                <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-[11px] leading-relaxed px-2.5 py-2 opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 shadow-lg whitespace-normal text-center">
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700" />
                  {t('preview.flowArraysWarnTooltip')}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {manualYaml !== null && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <Pencil size={11} />
                {t('preview.manualEdited')}
              </span>
            )}
            {manualYaml !== null && (
              <button
                onClick={handleReset}
                title={t('preview.resetTitle')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-amber-400 dark:border-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 transition-colors"
              >
                <RotateCcw size={13} />
                {t('preview.resetManual')}
              </button>
            )}
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <Upload size={13} />
              {t('preview.importConfig')}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
              {copied ? t('preview.copied') : t('preview.copy')}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
            >
              <Download size={13} />
              {t('preview.export')}
            </button>
          </div>
        </div>

        {/* Code area — editable textarea */}
        <div className="flex-1 min-h-0 overflow-hidden bg-gray-950">
          <textarea
            ref={textareaRef}
            value={displayYaml}
            onChange={(e) => setManualYaml(e.target.value)}
            spellCheck={false}
            className={`w-full h-full p-4 text-xs text-green-300 font-mono leading-relaxed bg-gray-950 resize-none focus:outline-none ${softWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'}`}
          />
        </div>

        {/* Stats bar */}
        <div className="shrink-0 border-t border-gray-800 px-4 py-1.5 flex items-center gap-4 text-xs text-gray-500 bg-gray-950">
          <span>{t('preview.statNodes')} <strong className="text-gray-400">{allProxies.length}</strong></span>
          <span>{t('preview.statGroups')} <strong className="text-gray-400">{proxyGroups.length}</strong></span>
          <span>{t('preview.statProviders')} <strong className="text-gray-400">{enabledProviders.length}/{ruleProviders.length}</strong></span>
          <span>{t('preview.statRules')} <strong className="text-gray-400">{rules.length}</strong></span>
          <span className="ml-auto flex items-center gap-1">
            {yamlValidation.valid ? (
              <>
                <CheckCircle size={12} className="text-green-500" />
                <span className="text-green-500">{t('preview.yamlValid')}</span>
              </>
            ) : (
              <>
                <XCircle size={12} className="text-red-400" />
                <span className="text-red-400" title={yamlValidation.error}>{t('preview.yamlError', { error: yamlValidation.error })}</span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
