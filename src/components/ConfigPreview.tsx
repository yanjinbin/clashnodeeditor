import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Copy, Download, Check, FileText, ChevronRight, CheckCircle, XCircle, Upload, X, ShieldCheck, RotateCcw, Pencil } from 'lucide-react'
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
      {/* Documentation banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
        <span className="shrink-0">📖</span>
        <span>完整参数说明：</span>
        <a
          href="https://wiki.metacubex.one/config/general/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-900 dark:hover:text-blue-100 font-medium"
        >
          wiki.metacubex.one/config/general
        </a>
      </div>

      <Section title="基本设置">
        <Row label="mixed-port" hint="HTTP/SOCKS5 混合代理监听端口，应用设置系统代理时填此端口。">
          <BlurInput
            type="number"
            value={gs['mixed-port']}
            onChange={(v) => updateGlobalSettings({ 'mixed-port': parseInt(v) || 7890 })}
            className="w-20"
          />
        </Row>
        <Row label="allow-lan" hint="允许局域网内其他设备（手机、电视等）将此机器作为代理网关使用。">
          <Toggle checked={gs['allow-lan']} onChange={(v) => updateGlobalSettings({ 'allow-lan': v })} />
        </Row>
        <Row label="bind-address" hint="代理监听的网卡/IP。* 表示所有网卡；填具体 IP 则只在该网卡监听。">
          <BlurInput value={gs['bind-address']} onChange={(v) => updateGlobalSettings({ 'bind-address': v })} className="w-full" />
        </Row>
        <Row label="mode" hint="控制默认流量走规则、全局代理或直连。">
          <select value={gs.mode} onChange={(e) => updateGlobalSettings({ mode: e.target.value })} className={sel}>
            {['rule', 'global', 'direct'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="log-level" hint="控制日志详细程度。">
          <select value={gs['log-level']} onChange={(e) => updateGlobalSettings({ 'log-level': e.target.value })} className={sel}>
            {['debug', 'info', 'warning', 'error', 'silent'].map((l) => <option key={l}>{l}</option>)}
          </select>
        </Row>
        <Row label="external-controller" hint="RESTful API 监听地址，Yacd / MetaCubeXD 等面板通过此地址管理 Mihomo。对外暴露时务必设置 secret。">
          <BlurInput value={gs['external-controller']} onChange={(v) => updateGlobalSettings({ 'external-controller': v })} className="w-full" />
        </Row>
        <Row label="tcp-concurrent" hint="同时向多个目标 IP 发起连接，取最快响应（类 Happy Eyeballs），减少因单路握手超时造成的等待。">
          <Toggle checked={gs['tcp-concurrent'] ?? false} onChange={(v) => updateGlobalSettings({ 'tcp-concurrent': v })} />
        </Row>
        <Row label="unified-delay" hint="延迟测试时显示 本地→中转→落地 的端到端总延迟，而非只测本地到代理的一段。">
          <Toggle checked={gs['unified-delay'] ?? false} onChange={(v) => updateGlobalSettings({ 'unified-delay': v })} />
        </Row>
        <Row label="udp" hint="全局 UDP 开关。关闭后可消除 QUIC 流量绕过代理导致的 IP 漂移（TCP/UDP 同时可见时 Google 等平台会触发风控）。">
          <Toggle checked={gs.udp ?? false} onChange={(v) => updateGlobalSettings({ udp: v })} />
        </Row>
        {!(gs.udp ?? false) && (
          <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 leading-relaxed">
            <span className="font-semibold">防 IP 漂移提示：</span>
            {' '}UDP 已关闭，但 Chrome 仍会用 QUIC（UDP）绕过代理直连，导致<strong>机场节点</strong>和<strong>原生 IP 节点</strong>的真实地址同时泄露，造成 IP 漂移。
            建议在 Chrome 地址栏打开{' '}
            <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">chrome://flags/#enable-quic</code>
            {' '}，将 <em>Experimental QUIC protocol</em> 设为 <strong>Disabled</strong>。
          </div>
        )}
        <Row label="udp-timeout" hint="UDP 会话静默超时（秒）。超过此时间无流量则释放 NAT 映射。300 秒适合游戏和视频场景。">
          <BlurInput
            type="number"
            value={gs['udp-timeout'] ?? 300}
            onChange={(v) => updateGlobalSettings({ 'udp-timeout': parseInt(v) || 300 })}
            className="w-20"
          />
        </Row>
        <Row label="keep-alive-interval" hint="TCP/UDP 保活探测间隔（秒）。定期发送探活包，防止中间 NAT/路由器在无流量时静默断开连接。15 秒适合移动网络场景。">
          <BlurInput
            type="number"
            value={gs['keep-alive-interval'] ?? 15}
            onChange={(v) => updateGlobalSettings({ 'keep-alive-interval': parseInt(v) || 15 })}
            className="w-20"
          />
        </Row>
        <Row label="find-process-mode" hint="进程匹配模式。off=关闭，strict=按需，always=强制。链式代理建议设为 off，减少无效查询开销。">
          <select value={gs['find-process-mode'] ?? 'strict'} onChange={(e) => updateGlobalSettings({ 'find-process-mode': e.target.value })} className={sel}>
            {['always', 'strict', 'off'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="global-fingerprint" hint="为所有节点统一 TLS/JA3 指纹，降低 Google、Cloudflare 等识别为异常流量的概率。建议每节点单独设 client-fingerprint 优先。">
          <select value={gs['global-client-fingerprint'] ?? 'chrome'} onChange={(e) => updateGlobalSettings({ 'global-client-fingerprint': e.target.value })} className={sel}>
            {['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', '360', 'qq', 'random'].map((f) => <option key={f}>{f}</option>)}
          </select>
        </Row>
        <Row label="prefer-h3" hint="优先使用 HTTP/3（QUIC）协议与代理节点通信。需同时开启 udp，否则实际无效；开启后可能增加被识别为代理流量的概率。">
          <Toggle checked={gs['prefer-h3'] ?? false} onChange={(v) => updateGlobalSettings({ 'prefer-h3': v })} />
        </Row>
      </Section>

      <Section title="Sniffer（嗅探）" defaultOpen={false}>
        <Row label="enable" hint="对 HTTP/TLS 流量嗅探域名，将裸 IP 请求反向映射回域名，确保基于域名的分流规则命中。链式代理下有极小性能开销。">
          <Toggle
            checked={gs.sniffer?.enable ?? false}
            onChange={(v) => updateGlobalSettings({ sniffer: { ...gs.sniffer!, enable: v } })}
          />
        </Row>
        <Row label="parse-pure-ip" hint="对裸 IP 连接（无域名）也尝试嗅探，结合 fake-ip 模式将 IP 反查为域名后再匹配规则。">
          <Toggle
            checked={gs.sniffer?.['parse-pure-ip'] ?? false}
            onChange={(v) => updateGlobalSettings({ sniffer: { ...gs.sniffer!, 'parse-pure-ip': v } })}
          />
        </Row>
        <Row label="force-dns-mapping" hint="强制将 IP 连接通过 DNS 映射表反查为域名（parse-pure-ip 增强版），让没有域名的 IP 请求也能命中域名规则。">
          <Toggle
            checked={gs.sniffer?.['force-dns-mapping'] ?? false}
            onChange={(v) => updateGlobalSettings({ sniffer: { ...gs.sniffer!, 'force-dns-mapping': v } })}
          />
        </Row>
        <Row label="override-destination" hint="将嗅探到的真实域名覆盖连接的目标地址，让下游节点用域名而非 IP 建立连接，避免 IP 直连被 SNI 检测。">
          <Toggle
            checked={gs.sniffer?.['override-destination'] ?? false}
            onChange={(v) => updateGlobalSettings({ sniffer: { ...gs.sniffer!, 'override-destination': v } })}
          />
        </Row>
      </Section>

      <Section title="TUN" defaultOpen={false}>
        <Row label="enable" hint="创建虚拟网卡接管系统全部流量，让分流规则对所有应用完整生效（包括不走系统代理的程序）。">
          <Toggle
            checked={gs.tun?.enable ?? false}
            onChange={(v) => updateGlobalSettings({ tun: { ...gs.tun!, enable: v } })}
          />
        </Row>
        <Row label="stack" hint="协议栈。mixed=同时处理 TCP/UDP（推荐）；system=性能最优但部分系统兼容性差；gvisor=用户态协议栈，兼容性最好。">
          <select
            value={gs.tun?.stack ?? 'mixed'}
            onChange={(e) => updateGlobalSettings({ tun: { ...gs.tun!, stack: e.target.value as 'system' | 'gvisor' | 'mixed' } })}
            className={sel}
          >
            {['system', 'gvisor', 'mixed'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="auto-route" hint="自动向系统路由表注入规则，将流量引导进 TUN 网卡。关闭后需手动配置路由。">
          <Toggle
            checked={gs.tun?.['auto-route'] ?? true}
            onChange={(v) => updateGlobalSettings({ tun: { ...gs.tun!, 'auto-route': v } })}
          />
        </Row>
        <Row label="auto-redirect" hint="自动将非 TUN 的 TCP 流量 redirect 进 TUN，确保全量接管。推荐与 auto-route 同时开启。">
          <Toggle
            checked={gs.tun?.['auto-redirect'] ?? true}
            onChange={(v) => updateGlobalSettings({ tun: { ...gs.tun!, 'auto-redirect': v } })}
          />
        </Row>
        <Row label="auto-detect-if" hint="自动识别默认出口网卡并绑定 TUN，避免路由回环或走错物理网卡。">
          <Toggle
            checked={gs.tun?.['auto-detect-interface'] ?? true}
            onChange={(v) => updateGlobalSettings({ tun: { ...gs.tun!, 'auto-detect-interface': v } })}
          />
        </Row>
      </Section>

      <Section title="GeoData" defaultOpen={false}>
        <Row label="geodata-mode" hint="使用 dat 格式 GeoData（MetaCubeX 增强版），匹配精度优于 mmdb。关闭则使用 mmdb 格式。">
          <Toggle checked={gs['geodata-mode'] ?? false} onChange={(v) => updateGlobalSettings({ 'geodata-mode': v })} />
        </Row>
        <Row label="geo-auto-update" hint="Mihomo 启动时自动从 geox-url 下载最新 GeoData 文件，无需手动更新。">
          <Toggle checked={gs['geo-auto-update'] ?? false} onChange={(v) => updateGlobalSettings({ 'geo-auto-update': v })} />
        </Row>
        <Row label="geo-update-interval" hint="GeoData 自动更新间隔（小时）。72 = 每 3 天检查一次更新，平衡时效性与网络开销。">
          <BlurInput
            type="number"
            value={gs['geo-update-interval'] ?? 72}
            onChange={(v) => updateGlobalSettings({ 'geo-update-interval': parseInt(v) || 72 })}
            className="w-20"
          />
        </Row>
      </Section>

      <Section title="DNS 设置">
        {/* DNS flow diagram callout */}
        <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300">
          <span className="shrink-0">🔍</span>
          <span>DNS 解析流程图（强烈建议阅读）：</span>
          <a
            href="https://wiki.metacubex.one/config/dns/diagram/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100"
          >
            查看流程图 →
          </a>
        </div>
        <Row label="enable" hint="开启 Mihomo 内置 DNS 模块。关闭则依赖系统 DNS，fake-ip 和 nameserver-policy 均失效。">
          <Toggle checked={dns.enable} onChange={(v) => updDns('enable', v)} />
        </Row>
        <Row label="ipv6" hint="是否在 DNS 响应中包含 AAAA 记录（IPv6 地址）。国内大多数场景建议关闭，避免 IPv6 直连绕过代理。">
          <Toggle checked={dns.ipv6} onChange={(v) => updDns('ipv6', v)} />
        </Row>
        <Row label="enhanced-mode" hint="fake-ip：返回虚假 IP，连接时再映射为真实地址，速度快；redir-host：返回真实 IP 再路由，兼容性更好但稍慢。">
          <select value={dns['enhanced-mode']} onChange={(e) => updDns('enhanced-mode', e.target.value)} className={sel}>
            {['fake-ip', 'redir-host'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="fake-ip-range" hint="fake-ip 模式分配虚假 IP 的地址段（RFC 5737 保留段）。不应与真实网络地址冲突。">
          <BlurInput value={dns['fake-ip-range']} onChange={(v) => updDns('fake-ip-range', v)} className="w-full" />
        </Row>
        <Row label="use-hosts" hint="DNS 解析时优先查询系统 /etc/hosts 文件，适合内网自定义域名映射。">
          <Toggle checked={dns['use-hosts'] ?? false} onChange={(v) => updDns('use-hosts', v)} />
        </Row>
        <Row label="respect-rules" hint="DNS 查询是否遵守分流规则（即根据规则选择走哪个 DNS）。注意：若规则依赖 DNS 且 DNS 又依赖规则会造成循环死锁，一般建议设为 false。">
          <Toggle checked={dns['respect-rules']} onChange={(v) => updDns('respect-rules', v)} />
        </Row>
        <Row label="default-nameserver" hint="引导 DNS：仅用于解析 nameserver 列表中 DoH/DoT 服务器的域名（如 dns.google）。必须填纯 IP 型国内 DNS，否则 DoH 地址无法解析导致启动失败。">
          <BlurInput
            value={joinArr(dns['default-nameserver'] ?? [])}
            onChange={(v) => updDns('default-nameserver', parseArr(v))}
            placeholder="223.5.5.5, 119.29.29.29"
            className="w-full"
          />
        </Row>
        <Row label="nameserver" hint="默认 DNS 服务器，处理所有未被 nameserver-policy 命中的域名查询。可填 IP 或 DoH/DoT 地址。">
          <BlurInput
            value={joinArr(dns.nameserver)}
            onChange={(v) => updDns('nameserver', parseArr(v))}
            placeholder="223.5.5.5, https://dns.google/dns-query"
            className="w-full"
          />
        </Row>
        <Row label="proxy-server-ns" hint="专用于解析代理节点服务器域名（机场域名）。必须走国内可直连 DNS，防止节点域名被 GFW 污染解析到错误 IP。">
          <BlurInput
            value={joinArr(dns['proxy-server-nameserver'])}
            onChange={(v) => updDns('proxy-server-nameserver', parseArr(v))}
            placeholder="223.5.5.5, 119.29.29.29"
            className="w-full"
          />
        </Row>
        <Row label="fallback" hint="fallback DNS：当 nameserver 返回的 IP 被 fallback-filter 判定为受污染时，改用这里的 DNS 重新解析。通常填境外加密 DoH。">
          <BlurInput
            value={joinArr(dns.fallback ?? [])}
            onChange={(v) => updDns('fallback', parseArr(v))}
            placeholder="https://1.1.1.1/dns-query"
            className="w-full"
          />
        </Row>
        <Row label="fake-ip-filter" hint="这些域名绕过 fake-ip 直接返回真实 IP。适合时间同步(NTP)、IoT 设备、Apple/小米服务等不能用虚假 IP 的场景。">
          <BlurInput
            value={joinArr(dns['fake-ip-filter'] ?? [])}
            onChange={(v) => updDns('fake-ip-filter', parseArr(v))}
            placeholder="*.lan, *.local, ..."
            className="w-full"
          />
        </Row>
      </Section>

      <Section title="Fallback Filter" defaultOpen={false}>
        <Row label="geoip" hint="启用 GeoIP 过滤：若 nameserver 返回的 IP 不属于 geoip-code 指定的国家，则触发 fallback 重新解析。用于过滤被污染的 DNS 结果。">
          <Toggle checked={ff?.geoip ?? false} onChange={(v) => updFF('geoip', v)} />
        </Row>
        <Row label="geoip-code" hint="GeoIP 判定的国家代码。返回 IP 不属于此国家时触发 fallback。通常填 CN，用于识别被污染到境外 IP 的国内域名。">
          <BlurInput value={ff?.['geoip-code'] ?? 'CN'} onChange={(v) => updFF('geoip-code', v)} className="w-16" />
        </Row>
        <Row label="geosite" hint="这些 geosite 分类下的域名始终触发 fallback（不依赖 GeoIP 判断）。常填 gfw 确保被封锁域名走境外 DNS。">
          <BlurInput
            value={joinArr(ff?.geosite ?? [])}
            onChange={(v) => updFF('geosite', parseArr(v))}
            placeholder="gfw"
            className="w-full"
          />
        </Row>
        <Row label="ipcidr" hint="这些 IP 段被视为受污染地址，命中时触发 fallback 重新解析。常见值：240.0.0.0/4（虚假 IP 段）。">
          <BlurInput
            value={joinArr(ff?.ipcidr ?? [])}
            onChange={(v) => updFF('ipcidr', parseArr(v))}
            placeholder="240.0.0.0/4"
            className="w-full"
          />
        </Row>
        <Row label="domain" hint="这些域名始终触发 fallback 解析，无论 nameserver 返回什么结果。适合手动指定已知受污染域名。">
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
          <div className="relative flex items-center gap-1">
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
            {flowArrays && (
              <span className="relative group/tip cursor-default select-none text-[10px] text-amber-600 dark:text-amber-400">
                ⚠️ 不推荐
                <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-[11px] leading-relaxed px-2.5 py-2 opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 shadow-lg whitespace-normal text-center">
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700" />
                  行内压缩使用 YAML flow 语法，部分 Mihomo 版本可能无法正确解析，建议使用展开模式
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {manualYaml !== null && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <Pencil size={11} />
                已手动编辑
              </span>
            )}
            {manualYaml !== null && (
              <button
                onClick={handleReset}
                title="丢弃手动编辑，恢复自动生成内容"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-amber-400 dark:border-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 transition-colors"
              >
                <RotateCcw size={13} />
                重置
              </button>
            )}
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
