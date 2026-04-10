import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2, Link2, ExternalLink, Wifi, WifiOff, Loader2, ChevronRight, ChevronDown, Copy, Check, AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { Proxy } from '../types/clash'
import { resolveToIp, fetchIpInfoBatch } from '../utils/ipUtils'
import type { IpData } from '../utils/ipUtils'

// ── Constants ────────────────────────────────────────────────────────────────

const PROXY_TYPES = [
  'socks5', 'http', 'ss', 'ssr', 'vmess', 'vless',
  'trojan', 'hysteria2', 'hysteria', 'tuic', 'wireguard', 'ssh', 'anytls',
] as const
type ProxyType = (typeof PROXY_TYPES)[number]

const SS_CIPHERS = [
  'aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305',
  'aes-128-cfb', 'aes-256-cfb', 'chacha20-ietf', 'rc4-md5',
]

const SSR_CIPHERS = [
  'aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb',
  'aes-128-ctr', 'aes-192-ctr', 'aes-256-ctr',
  'chacha20', 'chacha20-ietf', 'xchacha20', 'rc4-md5', 'none',
]

const SSR_PROTOCOLS = [
  'origin', 'auth_sha1_v4', 'auth_aes128_md5', 'auth_aes128_sha1',
  'auth_chain_a', 'auth_chain_b',
]

const SSR_OBFS = [
  'plain', 'http_simple', 'http_post', 'random_head',
  'tls1.2_ticket_auth', 'tls1.2_ticket_fastauth',
]

const NETWORK_OPTS = ['tcp', 'ws', 'grpc', 'h2', 'h3']

const TYPE_COLORS: Record<string, string> = {
  socks5:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  http:      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  ss:        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  ssr:       'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  vmess:     'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  vless:     'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  trojan:    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  hysteria2: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  hysteria:  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  tuic:      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  wireguard: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  ssh:       'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
  anytls:    'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string
  type: ProxyType
  server: string
  port: string
  username: string
  password: string
  uuid: string
  alterId: string
  cipher: string
  network: string
  tls: boolean
  udp: boolean
  dialerProxy: string
  sni: string
  skipCertVerify: boolean
  flow: string
  obfs: string
  obfsPassword: string
  up: string
  down: string
  // SSR-specific
  ssrProtocol: string
  ssrProtocolParam: string
  ssrObfs: string
  ssrObfsParam: string
  // WireGuard-specific
  wgIp: string
  wgPrivateKey: string
  wgPublicKey: string
  wgPresharedKey: string
  wgMtu: string
  wgDns: string
  // SSH-specific
  sshPrivateKey: string
  sshPrivateKeyPassphrase: string
  sshHostKey: string
}

const EMPTY_FORM: FormState = {
  name: '', type: 'socks5', server: '', port: '',
  username: '', password: '', uuid: '', alterId: '0',
  cipher: 'aes-128-gcm', network: 'tcp',
  tls: false, udp: false,
  dialerProxy: '', sni: '', skipCertVerify: false,
  flow: '', obfs: '', obfsPassword: '', up: '', down: '',
  ssrProtocol: 'auth_sha1_v4', ssrProtocolParam: '', ssrObfs: 'plain', ssrObfsParam: '',
  wgIp: '', wgPrivateKey: '', wgPublicKey: '', wgPresharedKey: '', wgMtu: '1280', wgDns: '1.1.1.1',
  sshPrivateKey: '', sshPrivateKeyPassphrase: '', sshHostKey: '',
}

// ── Converters ────────────────────────────────────────────────────────────────

function proxyToForm(proxy: Proxy): FormState {
  return {
    name:           String(proxy.name ?? ''),
    type:           (proxy.type as ProxyType) ?? 'socks5',
    server:         String(proxy.server ?? ''),
    port:           String(proxy.port ?? ''),
    username:       String(proxy.username ?? ''),
    password:       String(proxy.password ?? proxy['auth-str'] ?? ''),
    uuid:           String(proxy.uuid ?? ''),
    alterId:        String(proxy.alterId ?? '0'),
    cipher:         String(proxy.cipher ?? 'aes-128-gcm'),
    network:        String(proxy.network ?? 'tcp'),
    tls:            Boolean(proxy.tls),
    udp:            Boolean(proxy.udp),
    dialerProxy:    String(proxy['dialer-proxy'] ?? ''),
    sni:            String(proxy.sni ?? proxy.servername ?? ''),
    skipCertVerify: Boolean(proxy['skip-cert-verify']),
    flow:           String(proxy.flow ?? ''),
    obfs:           String(proxy.obfs ?? ''),
    obfsPassword:   String(proxy['obfs-password'] ?? ''),
    up:             String(proxy.up ?? ''),
    down:           String(proxy.down ?? ''),
    ssrProtocol:        String(proxy.protocol ?? 'auth_sha1_v4'),
    ssrProtocolParam:   String(proxy['protocol-param'] ?? ''),
    ssrObfs:            String(proxy.obfs ?? 'plain'),
    ssrObfsParam:       String(proxy['obfs-param'] ?? ''),
    wgIp:               String(proxy.ip ?? ''),
    wgPrivateKey:       String(proxy['private-key'] ?? ''),
    wgPublicKey:        String(proxy['public-key'] ?? ''),
    wgPresharedKey:     String(proxy['pre-shared-key'] ?? ''),
    wgMtu:              String(proxy.mtu ?? '1280'),
    wgDns:              Array.isArray(proxy.dns) ? (proxy.dns as string[]).join(', ') : String(proxy.dns ?? '1.1.1.1'),
    sshPrivateKey:             String(proxy['private-key'] ?? ''),
    sshPrivateKeyPassphrase:   String(proxy['private-key-passphrase'] ?? ''),
    sshHostKey:                String(proxy['host-key'] ?? ''),
  }
}

function formToProxy(f: FormState): Proxy {
  const proxy: Proxy = {
    name:   f.name.trim(),
    type:   f.type,
    server: f.server.trim(),
    port:   parseInt(f.port) || 0,
  }
  if (f.dialerProxy.trim()) proxy['dialer-proxy'] = f.dialerProxy.trim()

  switch (f.type) {
    case 'socks5':
      if (f.username) proxy.username = f.username
      if (f.password) proxy.password = f.password
      if (f.tls) proxy.tls = true
      proxy.udp = f.udp
      break
    case 'http':
      if (f.username) proxy.username = f.username
      if (f.password) proxy.password = f.password
      if (f.tls) proxy.tls = true
      break
    case 'ss':
      proxy.cipher = f.cipher
      proxy.password = f.password
      if (f.udp) proxy.udp = true
      break
    case 'vmess':
      proxy.uuid = f.uuid
      proxy.alterId = parseInt(f.alterId) || 0
      proxy.cipher = f.cipher || 'auto'
      if (f.network && f.network !== 'tcp') proxy.network = f.network
      if (f.tls) proxy.tls = true
      if (f.sni) proxy.servername = f.sni
      break
    case 'vless':
      proxy.uuid = f.uuid
      if (f.network && f.network !== 'tcp') proxy.network = f.network
      if (f.tls) proxy.tls = true
      if (f.flow) proxy.flow = f.flow
      if (f.sni) proxy.servername = f.sni
      break
    case 'trojan':
      proxy.password = f.password
      if (f.network && f.network !== 'tcp') proxy.network = f.network
      if (f.sni) proxy.sni = f.sni
      if (f.skipCertVerify) proxy['skip-cert-verify'] = true
      break
    case 'hysteria2':
      proxy.password = f.password
      if (f.obfs) proxy.obfs = f.obfs
      if (f.obfsPassword) proxy['obfs-password'] = f.obfsPassword
      if (f.up) proxy.up = f.up
      if (f.down) proxy.down = f.down
      if (f.sni) proxy.sni = f.sni
      if (f.skipCertVerify) proxy['skip-cert-verify'] = true
      break
    case 'hysteria':
      proxy['auth-str'] = f.password
      if (f.up) proxy.up = f.up
      if (f.down) proxy.down = f.down
      if (f.obfs) proxy.obfs = f.obfs
      if (f.sni) proxy.sni = f.sni
      if (f.skipCertVerify) proxy['skip-cert-verify'] = true
      break
    case 'tuic':
      proxy.uuid = f.uuid
      proxy.password = f.password
      if (f.skipCertVerify) proxy['skip-cert-verify'] = true
      if (f.sni) proxy.sni = f.sni
      break
    case 'ssr':
      proxy.cipher = f.cipher
      proxy.password = f.password
      proxy.protocol = f.ssrProtocol
      if (f.ssrProtocolParam) proxy['protocol-param'] = f.ssrProtocolParam
      proxy.obfs = f.ssrObfs
      if (f.ssrObfsParam) proxy['obfs-param'] = f.ssrObfsParam
      if (f.udp) proxy.udp = true
      break
    case 'wireguard':
      proxy.ip = f.wgIp
      proxy['private-key'] = f.wgPrivateKey
      proxy['public-key'] = f.wgPublicKey
      if (f.wgPresharedKey) proxy['pre-shared-key'] = f.wgPresharedKey
      if (f.wgMtu) proxy.mtu = parseInt(f.wgMtu) || 1280
      if (f.wgDns) proxy.dns = f.wgDns.split(',').map((s) => s.trim()).filter(Boolean)
      proxy.udp = true
      break
    case 'ssh':
      proxy.username = f.username
      if (f.password) proxy.password = f.password
      if (f.sshPrivateKey) proxy['private-key'] = f.sshPrivateKey
      if (f.sshPrivateKeyPassphrase) proxy['private-key-passphrase'] = f.sshPrivateKeyPassphrase
      if (f.sshHostKey) proxy['host-key'] = f.sshHostKey
      break
    case 'anytls':
      proxy.password = f.password
      if (f.sni) proxy.sni = f.sni
      if (f.skipCertVerify) proxy['skip-cert-verify'] = true
      break
  }
  return proxy
}

// ── Tiny UI helpers ───────────────────────────────────────────────────────────

function Input({ label, value, onChange, placeholder = '', type = 'text', required = false, mono = false }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean; mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-4.5 rounded-full transition-colors ${checked ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-3.5' : ''}`} />
      </button>
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  )
}

// ── Searchable Select ─────────────────────────────────────────────────────────

function SearchableSelect({
  label,
  value,
  onChange,
  groups,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  groups: { label: string; items: { value: string; label: string }[] }[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = groups
    .map((g) => ({
      label: g.label,
      items: q ? g.items.filter((i) => i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q)) : g.items,
    }))
    .filter((g) => g.items.length > 0)

  const selectedLabel = groups.flatMap((g) => g.items).find((i) => i.value === value)?.label ?? value

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); if (!open) setQuery('') }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <span className={`flex-1 truncate ${value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
            {value ? selectedLabel : '— 无（直接连接）'}
          </span>
          {value && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange('') }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={13} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 border-b border-gray-100 dark:border-gray-700/60">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
                placeholder="搜索代理 / 代理组…"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${value === '' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
              >
                — 无（直接连接）
              </button>
              {filtered.map((group) => (
                <div key={group.label}>
                  <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 select-none">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => { onChange(item.value); setOpen(false); setQuery('') }}
                      className={`w-full text-left px-3 py-1.5 text-sm truncate transition-colors ${value === item.value ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
              {filtered.length === 0 && q && (
                <p className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500 text-center">无匹配结果</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── IP Detection ──────────────────────────────────────────────────────────────

interface IpCheckState {
  status: 'idle' | 'loading' | 'done' | 'error'
  ip?: string
  data?: IpData
  error?: string
}

function IpQualityBadge({ data }: { data: IpData }) {
  const isNative = !data.proxy && !data.hosting
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md ${isNative ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
      {isNative ? <Wifi size={11} /> : <WifiOff size={11} />}
      <span className="font-medium">{data.countryCode} · {data.isp}</span>
      {data.proxy && <span className="opacity-70">(代理IP)</span>}
      {data.hosting && <span className="opacity-70">(数据中心)</span>}
      {isNative && <span className="opacity-70">(住宅/原生)</span>}
    </div>
  )
}

function IpDetectionPanel({ proxy, allGroupNames }: { proxy: Proxy; allGroupNames: string[] }) {
  const [check, setCheck] = useState<IpCheckState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)

  const dialerProxy = proxy['dialer-proxy'] as string | undefined
  const server = proxy.server ?? ''

  const handleCheck = useCallback(async () => {
    if (!server) return
    setCheck({ status: 'loading' })
    try {
      const ip = await resolveToIp(server)
      const [data] = await fetchIpInfoBatch([ip])
      setCheck({ status: 'done', ip, data })
    } catch (err) {
      setCheck({ status: 'error', error: (err as Error).message })
    }
  }, [server])

  const yamlSnippet = [
    `- name: ${proxy.name}`,
    `  type: ${proxy.type}`,
    `  server: ${proxy.server}`,
    `  port: ${proxy.port}`,
    ...(proxy.username ? [`  username: ${proxy.username}`] : []),
    ...(proxy.password ? [`  password: ${proxy.password}`] : []),
    ...(proxy.udp !== undefined ? [`  udp: ${proxy.udp}`] : []),
    ...(dialerProxy ? [`  dialer-proxy: ${dialerProxy}`] : []),
  ].join('\n')

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(yamlSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [yamlSnippet])

  return (
    <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-3">
      {/* Chain topology */}
      {dialerProxy && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">链式代理拓扑</p>
          <div className="flex items-center gap-1.5 flex-wrap text-sm">
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-mono">本地</span>
            <ChevronRight size={14} className="text-gray-400 shrink-0" />
            <span className={`px-2 py-0.5 rounded-md border text-xs font-medium ${allGroupNames.includes(dialerProxy) ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'}`}>
              {dialerProxy}
              <span className="ml-1 font-normal opacity-60">{allGroupNames.includes(dialerProxy) ? '(代理组)' : '(节点)'}</span>
            </span>
            <ChevronRight size={14} className="text-gray-400 shrink-0" />
            <span className="px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 text-xs font-medium">
              {proxy.name}
              <span className="ml-1 font-normal opacity-60">({proxy.type})</span>
            </span>
            <ChevronRight size={14} className="text-gray-400 shrink-0" />
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-mono">
              {server}:{proxy.port}
            </span>
            <ChevronRight size={14} className="text-gray-400 shrink-0" />
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs">互联网</span>
          </div>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
            出口 IP = <strong>{server}</strong> 的静态 IP（由 {dialerProxy} 前置访问该代理服务器）
          </p>
        </div>
      )}

      {/* Server IP quality check */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">服务器 IP 质量检测</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCheck}
            disabled={!server || check.status === 'loading'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {check.status === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
            检测 {server || '(未填服务器)'}
          </button>

          {check.status === 'done' && check.data && (
            <IpQualityBadge data={check.data} />
          )}
          {check.status === 'done' && check.ip && (
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">IP: {check.ip}</span>
          )}
          {check.status === 'error' && (
            <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle size={11} /> {check.error}
            </span>
          )}
        </div>

        {check.status === 'done' && check.data && !check.data.proxy && !check.data.hosting && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1.5">
            该 IP 检测为住宅/原生 IP，适合 IP 敏感服务（流媒体、金融等）。
          </p>
        )}
        {check.status === 'done' && check.data && (check.data.proxy || check.data.hosting) && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
            该 IP 标记为{check.data.proxy ? '代理' : '数据中心'}，可能无法通过流媒体 IP 检测。
          </p>
        )}
      </div>

      {/* Verify in Clash */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">在 Clash 中验证出口 IP</p>
        <div className="flex items-center gap-2">
          <a
            href="https://whatismyipaddress.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ExternalLink size={11} />
            whatismyipaddress.com
          </a>
          <span className="text-xs text-gray-400">— 在 Clash 启用此节点后打开验证</span>
        </div>
      </div>

      {/* YAML snippet */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">YAML 配置片段</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        <pre className="text-xs font-mono bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto leading-relaxed">
          {yamlSnippet}
        </pre>
      </div>
    </div>
  )
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────

function NodeFormModal({
  initial,
  allGroupNames,
  allProxyNames,
  onSave,
  onClose,
}: {
  initial: FormState | null
  allGroupNames: string[]
  allProxyNames: string[]
  onSave: (proxy: Proxy) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM)
  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }))
  }, [])

  const isEdit = initial !== null

  const dialerGroups = useMemo(() => {
    const groupItems = allGroupNames.map((n) => ({ value: n, label: n }))
    const proxyItems = allProxyNames
      .filter((n) => !allGroupNames.includes(n) && n !== form.name && n !== 'DIRECT' && n !== 'REJECT')
      .map((n) => ({ value: n, label: n }))
    return [
      ...(groupItems.length ? [{ label: '代理组', items: groupItems }] : []),
      ...(proxyItems.length ? [{ label: '节点', items: proxyItems }] : []),
    ]
  }, [allGroupNames, allProxyNames, form.name])

  const errors: string[] = []
  if (!form.name.trim()) errors.push('节点名称不能为空')
  if (form.type !== 'wireguard' && !form.server.trim()) errors.push('服务器地址不能为空')
  if (!form.port || isNaN(parseInt(form.port))) errors.push('端口不合法')
  if (['vmess', 'vless', 'tuic'].includes(form.type) && !form.uuid.trim()) errors.push('UUID 不能为空')
  if (['ss', 'ssr', 'trojan', 'hysteria2', 'hysteria', 'tuic', 'anytls'].includes(form.type) && !form.password.trim()) errors.push('密码不能为空')
  if (form.type === 'wireguard' && (!form.wgPrivateKey.trim() || !form.wgPublicKey.trim())) errors.push('WireGuard 需填写私钥和公钥')
  if (form.type === 'ssh' && !form.username.trim()) errors.push('SSH 用户名不能为空')

  function handleSave() {
    if (errors.length > 0) return
    onSave(formToProxy(form))
  }

  const showAuth      = form.type === 'socks5' || form.type === 'http'
  const showPassword  = ['ss', 'ssr', 'trojan', 'hysteria2', 'hysteria', 'tuic', 'anytls'].includes(form.type)
  const showUuid      = ['vmess', 'vless', 'tuic'].includes(form.type)
  const showCipher    = form.type === 'ss' || form.type === 'vmess' || form.type === 'ssr'
  const showNetwork   = ['vmess', 'vless', 'trojan'].includes(form.type)
  const showTls       = ['socks5', 'http', 'vmess', 'vless'].includes(form.type)
  const showUdp       = form.type === 'socks5' || form.type === 'ss' || form.type === 'ssr'
  const showFlow      = form.type === 'vless'
  const showObfs      = form.type === 'hysteria2' || form.type === 'hysteria'
  const showSpeedLimit = form.type === 'hysteria2' || form.type === 'hysteria'
  const showSni       = ['vmess', 'vless', 'trojan', 'hysteria2', 'hysteria', 'tuic', 'anytls'].includes(form.type)
  const showSkipCert  = ['trojan', 'hysteria2', 'hysteria', 'tuic', 'anytls'].includes(form.type)
  const showSsr       = form.type === 'ssr'
  const showWg        = form.type === 'wireguard'
  const showSsh       = form.type === 'ssh'
  // dialer-proxy not applicable to wireguard
  const showDialer    = form.type !== 'wireguard'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? '编辑节点' : '添加节点'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Row 1: name + type */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="节点名称" value={form.name} onChange={(v) => set('name', v)} placeholder="🇺🇸｜美国原生IP" required />
            <Select
              label="协议类型"
              value={form.type}
              onChange={(v) => set('type', v as ProxyType)}
              options={PROXY_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>

          {/* Row 2: server + port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input label="服务器地址" value={form.server} onChange={(v) => set('server', v)} placeholder="example.com 或 1.2.3.4" required mono />
            </div>
            <Input label="端口" value={form.port} onChange={(v) => set('port', v)} placeholder="443" type="number" required />
          </div>

          {/* Auth fields */}
          {showAuth && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="用户名" value={form.username} onChange={(v) => set('username', v)} placeholder="（可选）" />
              <Input label="密码" value={form.password} onChange={(v) => set('password', v)} placeholder="（可选）" type="password" />
            </div>
          )}

          {/* Password (non-auth types) */}
          {showPassword && (
            <Input label="密码" value={form.password} onChange={(v) => set('password', v)} placeholder="proxy password" type="password" required />
          )}

          {/* UUID */}
          {showUuid && (
            <Input label="UUID" value={form.uuid} onChange={(v) => set('uuid', v)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required mono />
          )}

          {/* VMess: alterId */}
          {form.type === 'vmess' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="alterID" value={form.alterId} onChange={(v) => set('alterId', v)} placeholder="0" type="number" />
              <Select
                label="加密方式"
                value={form.cipher}
                onChange={(v) => set('cipher', v)}
                options={[{ value: 'auto', label: 'auto' }, { value: 'none', label: 'none' }, { value: 'aes-128-gcm', label: 'aes-128-gcm' }, { value: 'chacha20-poly1305', label: 'chacha20-poly1305' }]}
              />
            </div>
          )}

          {/* SS cipher */}
          {form.type === 'ss' && (
            <Select
              label="加密方式"
              value={form.cipher}
              onChange={(v) => set('cipher', v)}
              options={SS_CIPHERS.map((c) => ({ value: c, label: c }))}
            />
          )}

          {/* SSR specific */}
          {showSsr && (
            <div className="space-y-3">
              <Select
                label="加密方式"
                value={form.cipher}
                onChange={(v) => set('cipher', v)}
                options={SSR_CIPHERS.map((c) => ({ value: c, label: c }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="协议"
                  value={form.ssrProtocol}
                  onChange={(v) => set('ssrProtocol', v)}
                  options={SSR_PROTOCOLS.map((p) => ({ value: p, label: p }))}
                />
                <Input label="协议参数（可选）" value={form.ssrProtocolParam} onChange={(v) => set('ssrProtocolParam', v)} placeholder="" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="混淆"
                  value={form.ssrObfs}
                  onChange={(v) => set('ssrObfs', v)}
                  options={SSR_OBFS.map((o) => ({ value: o, label: o }))}
                />
                <Input label="混淆参数（可选）" value={form.ssrObfsParam} onChange={(v) => set('ssrObfsParam', v)} placeholder="" />
              </div>
            </div>
          )}

          {/* Network */}
          {showNetwork && (
            <Select
              label="传输协议"
              value={form.network}
              onChange={(v) => set('network', v)}
              options={NETWORK_OPTS.map((n) => ({ value: n, label: n }))}
            />
          )}

          {/* VLESS flow */}
          {showFlow && (
            <Input label="flow（可选）" value={form.flow} onChange={(v) => set('flow', v)} placeholder="xtls-rprx-vision" />
          )}

          {/* Hysteria obfs + speed */}
          {showObfs && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="obfs（可选）" value={form.obfs} onChange={(v) => set('obfs', v)} placeholder="salamander" />
              <Input label="obfs-password（可选）" value={form.obfsPassword} onChange={(v) => set('obfsPassword', v)} placeholder="" type="password" />
            </div>
          )}
          {showSpeedLimit && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="上行带宽（可选）" value={form.up} onChange={(v) => set('up', v)} placeholder="50 Mbps" />
              <Input label="下行带宽（可选）" value={form.down} onChange={(v) => set('down', v)} placeholder="200 Mbps" />
            </div>
          )}

          {/* SNI */}
          {showSni && (
            <Input label="SNI（可选）" value={form.sni} onChange={(v) => set('sni', v)} placeholder="example.com" />
          )}

          {/* SSH specific */}
          {showSsh && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="用户名" value={form.username} onChange={(v) => set('username', v)} placeholder="root" required />
                <Input label="密码（可选）" value={form.password} onChange={(v) => set('password', v)} placeholder="—" type="password" />
              </div>
              <Input label="私钥（base64，可选）" value={form.sshPrivateKey} onChange={(v) => set('sshPrivateKey', v)} placeholder="base64 编码的私钥" mono />
              <div className="grid grid-cols-2 gap-3">
                <Input label="私钥密码（可选）" value={form.sshPrivateKeyPassphrase} onChange={(v) => set('sshPrivateKeyPassphrase', v)} placeholder="" type="password" />
                <Input label="Host Key（可选）" value={form.sshHostKey} onChange={(v) => set('sshHostKey', v)} placeholder="ssh-rsa AAAA..." mono />
              </div>
            </div>
          )}

          {/* WireGuard specific */}
          {showWg && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="本机 IP (ip)" value={form.wgIp} onChange={(v) => set('wgIp', v)} placeholder="10.0.0.1/32" required mono />
                <Input label="MTU（可选）" value={form.wgMtu} onChange={(v) => set('wgMtu', v)} placeholder="1280" type="number" />
              </div>
              <Input label="私钥 (private-key)" value={form.wgPrivateKey} onChange={(v) => set('wgPrivateKey', v)} placeholder="base64 私钥" required mono />
              <Input label="对端公钥 (public-key)" value={form.wgPublicKey} onChange={(v) => set('wgPublicKey', v)} placeholder="base64 公钥" required mono />
              <div className="grid grid-cols-2 gap-3">
                <Input label="预共享密钥（可选）" value={form.wgPresharedKey} onChange={(v) => set('wgPresharedKey', v)} placeholder="base64 预共享密钥" mono />
                <Input label="DNS（可选）" value={form.wgDns} onChange={(v) => set('wgDns', v)} placeholder="1.1.1.1, 8.8.8.8" />
              </div>
            </div>
          )}

          {/* Booleans row */}
          {(showTls || showUdp || showSkipCert) && (
            <div className="flex flex-wrap gap-4 pt-1">
              {showTls && <Toggle label="TLS" checked={form.tls} onChange={(v) => set('tls', v)} />}
              {showUdp && <Toggle label="UDP" checked={form.udp} onChange={(v) => set('udp', v)} />}
              {showSkipCert && <Toggle label="跳过证书验证" checked={form.skipCertVerify} onChange={(v) => set('skipCertVerify', v)} />}
            </div>
          )}

          {/* ── Dialer Proxy (chain) ── */}
          <div className="border-t border-dashed border-indigo-200 dark:border-indigo-800 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Link2 size={14} className="text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">链式代理（dialer-proxy）</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              选择前置代理后，Clash 会先通过该代理/代理组建立与本节点服务器的连接，实现链式出口。
              <br />例：日本节点 → 本节点（美国静态IP）→ 互联网，出口 IP = 美国原生 IP。
            </p>
            <SearchableSelect
              label="前置代理 / 代理组"
              value={form.dialerProxy}
              onChange={(v) => set('dialerProxy', v)}
              groups={dialerGroups}
            />
            {form.dialerProxy && (
              <div className="mt-3 flex items-center gap-1.5 flex-wrap text-xs">
                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono">本地</span>
                <ChevronRight size={12} className="text-gray-400" />
                <span className="px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">{form.dialerProxy}</span>
                <ChevronRight size={12} className="text-gray-400" />
                <span className="px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">{form.name || '本节点'}</span>
                <ChevronRight size={12} className="text-gray-400" />
                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">{form.server || 'server'}:{form.port || 'port'}</span>
                <ChevronRight size={12} className="text-gray-400" />
                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">互联网</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          {errors.length > 0 ? (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle size={11} /> {errors[0]}
            </p>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={errors.length > 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isEdit ? '保存修改' : '添加节点'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Node row ──────────────────────────────────────────────────────────────────

function NodeRow({
  proxy,
  index,
  allGroupNames,
  allProxyNames,
  onEdit,
  onDelete,
}: {
  proxy: Proxy
  index: number
  allGroupNames: string[]
  allProxyNames: string[]
  onEdit: () => void
  onDelete: () => void
}) {
  const [showDetection, setShowDetection] = useState(false)
  const dialerProxy = proxy['dialer-proxy'] as string | undefined
  const typeColor = TYPE_COLORS[proxy.type] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <span className="text-xs text-gray-400 w-5 text-right shrink-0">{index + 1}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-medium shrink-0 ${typeColor}`}>{proxy.type}</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{proxy.name}</p>
          <p className="text-xs text-gray-400 font-mono truncate">{proxy.server}:{proxy.port}</p>
        </div>

        {dialerProxy && (
          <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-full shrink-0">
            <Link2 size={10} />
            <span className="max-w-[120px] truncate">{dialerProxy}</span>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowDetection((v) => !v)}
            title="IP 检测 / 链路验证"
            className={`p-1.5 rounded-lg transition-colors ${showDetection ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'}`}
          >
            <Wifi size={14} />
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showDetection && (
        <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
          <IpDetectionPanel proxy={proxy} allGroupNames={allGroupNames} />
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NodeManager() {
  const {
    sources,
    manualProxies,
    proxyGroups,
    addManualProxy,
    updateManualProxy,
    removeManualProxy,
    addProxyGroup,
  } = useAppStore()

  const [modalState, setModalState] = useState<{ open: boolean; editIndex: number | null }>({ open: false, editIndex: null })
  const [search, setSearch] = useState('')
  const [postSaveSuggest, setPostSaveSuggest] = useState<{ proxyName: string } | null>(null)

  const allGroupNames = useMemo(() => proxyGroups.map((g) => g.name), [proxyGroups])

  // 响应式计算：订阅 sources / manualProxies / proxyGroups，任一变化均重新计算
  const allProxyNames = useMemo(() => {
    const srcNames = sources.flatMap((s) => s.proxies.map((p) => p.name))
    const manNames = manualProxies.map((p) => p.name)
    const grpNames = proxyGroups.map((g) => g.name)
    return [...new Set([...srcNames, ...manNames, ...grpNames, 'DIRECT', 'REJECT'])]
  }, [sources, manualProxies, proxyGroups])

  const filtered = useMemo(() => {
    if (!search.trim()) return manualProxies.map((p, i) => ({ proxy: p, index: i }))
    const q = search.toLowerCase()
    return manualProxies
      .map((p, i) => ({ proxy: p, index: i }))
      .filter(({ proxy }) =>
        proxy.name.toLowerCase().includes(q) ||
        (proxy.server ?? '').toLowerCase().includes(q) ||
        proxy.type.toLowerCase().includes(q)
      )
  }, [manualProxies, search])

  const chainCount = useMemo(
    () => manualProxies.filter((p) => p['dialer-proxy']).length,
    [manualProxies]
  )

  function openAdd() { setModalState({ open: true, editIndex: null }) }
  function openEdit(index: number) { setModalState({ open: true, editIndex: index }) }
  function closeModal() { setModalState({ open: false, editIndex: null }) }

  function handleSave(proxy: Proxy) {
    const isNew = modalState.editIndex === null
    if (modalState.editIndex !== null) {
      updateManualProxy(modalState.editIndex, proxy)
    } else {
      addManualProxy(proxy)
    }
    // 新建链式代理节点后，提示用户为其创建专属代理组
    if (isNew && proxy['dialer-proxy']) {
      setPostSaveSuggest({ proxyName: proxy.name })
    } else {
      setPostSaveSuggest(null)
    }
    closeModal()
  }

  const editingInitial = modalState.editIndex !== null
    ? proxyToForm(manualProxies[modalState.editIndex])
    : null

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-6 space-y-4 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">手动节点管理</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {manualProxies.length} 个节点
              {chainCount > 0 && <span className="ml-2 text-indigo-500">{chainCount} 个链式代理</span>}
              <span className="ml-2">— 支持配置 dialer-proxy 实现静态原生 IP 链式出口</span>
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
          >
            <Plus size={15} />
            添加节点
          </button>
        </div>

        {/* 链式代理 → 创建代理组 提醒 */}
        {postSaveSuggest && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">建议为此链式代理创建专属代理组</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                节点 <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">{postSaveSuggest.proxyName}</code> 已设置链式出口。
                创建专属代理组后，可在「规则」标签页将 RULE-SET / 规则直接指向该出口。
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  const groupName = `${postSaveSuggest.proxyName}(出口)`
                  if (!proxyGroups.some((g) => g.name === groupName)) {
                    addProxyGroup({
                      name: groupName,
                      type: 'select',
                      proxies: [postSaveSuggest.proxyName],
                      url: 'http://www.gstatic.com/generate_204',
                      interval: 300,
                    })
                  }
                  setPostSaveSuggest(null)
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors whitespace-nowrap"
              >
                一键创建代理组
              </button>
              <button
                onClick={() => setPostSaveSuggest(null)}
                className="p-1.5 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Tip banner */}
        {manualProxies.length === 0 && (
          <div className="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-6 text-center">
            <Link2 size={28} className="mx-auto text-indigo-400 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">添加自定义节点</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              支持 socks5 / http / ss / vmess / vless / trojan 等协议，以及通过 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">dialer-proxy</code> 配置链式代理，实现前置日本节点访问美国静态原生 IP 等场景。
            </p>
          </div>
        )}

        {/* Search */}
        {manualProxies.length > 0 && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索节点名称、服务器、协议…"
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}

        {/* Node list */}
        {filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(({ proxy, index }) => (
              <NodeRow
                key={index}
                proxy={proxy}
                index={index}
                allGroupNames={allGroupNames}
                allProxyNames={allProxyNames}
                onEdit={() => openEdit(index)}
                onDelete={() => removeManualProxy(index)}
              />
            ))}
          </div>
        )}

        {search && filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">无匹配节点</p>
        )}
      </div>

      {/* Modal */}
      {modalState.open && (
        <NodeFormModal
          initial={editingInitial}
          allGroupNames={allGroupNames}
          allProxyNames={allProxyNames}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
