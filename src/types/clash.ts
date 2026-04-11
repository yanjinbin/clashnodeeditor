export interface Proxy {
  name: string
  type: string
  server?: string
  port?: number
  cipher?: string
  password?: string
  uuid?: string
  alterId?: number
  network?: string
  tls?: boolean
  [key: string]: unknown
}

export type ProxyGroupType = 'select' | 'url-test' | 'fallback' | 'load-balance' | 'relay'

export interface ProxyGroup {
  id: string
  name: string
  type: ProxyGroupType
  proxies: string[]
  url?: string
  interval?: number
  tolerance?: number
  lazy?: boolean
  /** 生成配置时自动填入所有订阅节点（不含代理组） */
  autoAllNodes?: boolean
}

export interface RuleProvider {
  id: string
  name: string
  type: 'http' | 'file'
  behavior: 'domain' | 'ipcidr' | 'classical'
  url?: string
  path?: string
  interval?: number
  // target proxy group for the auto-generated RULE-SET rule
  target: string
  // whether this provider is active (included in output)
  enabled: boolean
  // preset providers ship with the app; custom ones are user-added
  isPreset?: boolean
  // ipcidr providers typically need no-resolve
  noResolve?: boolean
}

export interface Rule {
  id: string
  type: string
  payload: string
  target: string
  noResolve?: boolean
}

export interface ImportedProxyGroup {
  name: string
  type: string
  proxies: string[]
  url?: string
  interval?: number
  tolerance?: number
}

export interface SubscriptionInfo {
  upload: number    // bytes
  download: number  // bytes
  total: number     // bytes
  expire?: number   // unix timestamp (seconds)
}

export interface SourceConfig {
  id: string
  name: string
  url: string
  userAgent?: string
  status: 'idle' | 'loading' | 'success' | 'error'
  error?: string
  proxies: Proxy[]
  importedGroups?: ImportedProxyGroup[]
  subscriptionInfo?: SubscriptionInfo
}

export const DEFAULT_USER_AGENT = 'clash-verge/v2.2.3'

export const PRESET_USER_AGENTS = [
  { label: 'Clash Verge Rev（默认）', value: 'clash-verge/v2.2.3' },
  { label: 'mihomo', value: 'mihomo/1.19.0' },
  { label: 'Clash.Meta', value: 'clash.meta/1.18.3' },
  { label: 'Clash for Android', value: 'ClashForAndroid/2.5.12' },
  { label: 'Clash Premium', value: 'clash/1.18.0' },
  { label: 'Stash (iOS)', value: 'Stash/2.4.1 Clash/1.18.0' },
  { label: 'Shadowrocket (iOS)', value: 'Shadowrocket/2.2.35' },
  { label: '自定义', value: '__custom__' },
] as const

export interface DnsFallbackFilter {
  geoip: boolean
  'geoip-code': string
  geosite: string[]
  ipcidr: string[]
  domain: string[]
}

export interface DnsConfig {
  enable: boolean
  ipv6: boolean
  'default-nameserver'?: string[]
  'enhanced-mode': string
  'fake-ip-range': string
  'fake-ip-filter'?: string[]
  'use-hosts'?: boolean
  'respect-rules': boolean
  'proxy-server-nameserver': string[]
  nameserver: string[]
  'nameserver-policy'?: Record<string, string[]>
  fallback?: string[]
  'fallback-filter'?: DnsFallbackFilter
}

export interface SnifferConfig {
  enable: boolean
  'parse-pure-ip'?: boolean
  sniff: Record<string, { ports: (number | string)[] }>
  'force-domain'?: string[]
  'skip-domain'?: string[]
}

export interface TunConfig {
  enable: boolean
  stack?: 'system' | 'gvisor' | 'mixed'
  'auto-route'?: boolean
  'auto-detect-interface'?: boolean
}

export interface GeoxUrl {
  geoip?: string
  geosite?: string
  mmdb?: string
}

export interface ClashGlobalSettings {
  'mixed-port': number
  'allow-lan': boolean
  'bind-address': string
  mode: string
  'log-level': string
  'external-controller': string
  'tcp-concurrent'?: boolean
  'unified-delay'?: boolean
  'udp-timeout'?: number
  'tcp-keep-alive-interval'?: number
  /** 全局禁用 UDP，链式代理 / Google / Gemini 场景推荐设 false */
  udp?: boolean
  'find-process-mode'?: string
  'geodata-mode'?: boolean
  'geox-url'?: GeoxUrl
  'global-client-fingerprint'?: string
  profile?: { 'store-selected'?: boolean; 'store-fake-ip'?: boolean }
  /** TUN 虚拟网卡，接管全流量 */
  tun?: TunConfig
  sniffer?: SnifferConfig
  dns: DnsConfig
}

export const DEFAULT_GLOBAL_SETTINGS: ClashGlobalSettings = {
  'mixed-port': 7890,
  'allow-lan': true,
  'bind-address': '*',
  mode: 'rule',
  'log-level': 'info',
  'external-controller': '127.0.0.1:9090',
  'find-process-mode': 'off',
  'geodata-mode': true,
  'geox-url': {
    geoip:    'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat',
    geosite:  'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat',
    mmdb:     'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb',
  },
  'global-client-fingerprint': 'chrome',
  'tcp-concurrent': true,
  'unified-delay': true,
  // udp-timeout: UDP 连接超时秒数（非节点容差）
  'udp-timeout': 300,
  'tcp-keep-alive-interval': 30,
  // 全局禁 UDP：链式代理 / 原生 IP / Gemini 场景更稳定，避免 QUIC 绕过代理导致 IP 不一致
  udp: false,
  // TUN 虚拟网卡 — 默认关闭；需要接管全流量时改为 enable: true
  tun: {
    enable: false,
    stack: 'system',
    'auto-route': true,
    'auto-detect-interface': true,
  },
  profile: {
    'store-selected': true,
    'store-fake-ip': true,
  },
  sniffer: {
    enable: true,
    'parse-pure-ip': true,
    sniff: {
      HTTP: { ports: [80, '8080-8880'] },
      TLS:  { ports: [443, 8443] },
      QUIC: { ports: [443, 8443] },
    },
    'skip-domain': [
      'Mijia Cloud',
      '+.apple.com',
      'msftconnecttest.com',
      'msftncsi.com',
      'time.*.com',
      'ntp*.*.com',
      '+.local',
    ],
  },
  dns: {
    enable: true,
    ipv6: false,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'fake-ip-filter': [
      '*.lan',
      '*.local',
      'time*.*.com',
      '+.stun.*.*',
      'ntp*.*.com',
      'localhost.ptlogin2.qq.com',
      'time.*.gov',
      'time.*.edu.cn',
    ],
    'use-hosts': true,
    'respect-rules': true,
    // 仅用于解析上游 DNS 域名（dns.google、cloudflare-dns.com 等）
    'default-nameserver': ['223.5.5.5', '119.29.29.29', '114.114.114.114'],
    // 专门解析代理节点服务器域名，国内 DNS 稳定直连
    'proxy-server-nameserver': ['223.5.5.5', '119.29.29.29', '114.114.114.114'],
    nameserver: ['223.5.5.5', '119.29.29.29', '114.114.114.114'],
    'nameserver-policy': {
      // 国内域名走国内 DNS
      'geosite:cn':  ['223.5.5.5', '119.29.29.29', '114.114.114.114'],
      // 非国内域名走境外加密 DNS，防污染
      'geosite:geolocation-!cn': [
        'https://cloudflare-dns.com/dns-query',
        'https://dns.google/dns-query',
        '1.1.1.1',
        '8.8.8.8',
      ],
    },
  },
}

export interface ClashConfig {
  'mixed-port'?: number
  'allow-lan'?: boolean
  'bind-address'?: string
  mode?: string
  'log-level'?: string
  'external-controller'?: string
  'tcp-concurrent'?: boolean
  'unified-delay'?: boolean
  'udp-timeout'?: number
  'tcp-keep-alive-interval'?: number
  udp?: boolean
  'find-process-mode'?: string
  'geodata-mode'?: boolean
  'geox-url'?: GeoxUrl
  'global-client-fingerprint'?: string
  profile?: { 'store-selected'?: boolean; 'store-fake-ip'?: boolean }
  tun?: TunConfig
  sniffer?: SnifferConfig
  dns?: DnsConfig
  proxies?: Proxy[]
  'proxy-groups'?: Array<{
    name: string
    type: string
    proxies: string[]
    url?: string
    interval?: number
    tolerance?: number
    lazy?: boolean
  }>
  'rule-providers'?: Record<string, {
    type: string
    behavior: string
    url?: string
    path?: string
    interval?: number
  }>
  rules?: string[]
}

function preset(
  id: string,
  behavior: RuleProvider['behavior'],
  target: string,
  enabled = false,
  noResolve = false
): RuleProvider {
  const ext = behavior === 'domain' ? 'txt' : 'txt'
  return {
    id,
    name: id,
    type: 'http',
    behavior,
    url: `https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/${id}.${ext}`,
    path: `./ruleset/${id}.yaml`,
    interval: 86400,
    target,
    enabled,
    noResolve,
    isPreset: true,
  }
}

export const PRESET_RULE_PROVIDERS: RuleProvider[] = [
  preset('reject',       'domain',    'REJECT',       true),
  preset('private',      'domain',    'DIRECT',       true),
  preset('google',       'domain',    '♻️ 自动选择', true),
  preset('direct',       'domain',    'DIRECT',       true),
  preset('gfw',          'domain',    'PROXY',        false),
  preset('telegramcidr', 'ipcidr',    'PROXY',        false, true),
  preset('cncidr',       'ipcidr',    'DIRECT',       true,  true),
  preset('lancidr',      'ipcidr',    'DIRECT',       true,  true),
]

function bm7(
  id: string,
  filePath: string,
  target: string,
  enabled = false,
  interval = 86400
): RuleProvider {
  return {
    id: `bm7-${id}`,
    name: id,
    type: 'http',
    behavior: 'classical',
    url: `https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/${filePath}`,
    path: `./ruleset/${id}.yaml`,
    interval,
    target,
    enabled,
    isPreset: true,
  }
}

export const BLACKMATRIX7_RULE_PROVIDERS: RuleProvider[] = [
  bm7('openai',       'OpenAI/OpenAI.yaml',             '♻️ 自动选择', true),
  bm7('claude',       'Claude/Claude.yaml',             '♻️ 自动选择', true),
  bm7('gemini',       'Gemini/Gemini.yaml',             '♻️ 自动选择', true),
  bm7('copilot',      'Copilot/Copilot.yaml',           '♻️ 自动选择', true),
  bm7('youtube-music','YouTubeMusic/YouTubeMusic.yaml', '♻️ 自动选择', true,  1209600),
  bm7('youtube',      'YouTube/YouTube.yaml',           '♻️ 自动选择', true),
  bm7('telegram',     'Telegram/Telegram.yaml',         '♻️ 自动选择', true,  1209600),
  bm7('twitter',      'Twitter/Twitter.yaml',           '♻️ 自动选择', true,  1209600),
  bm7('tiktok',       'TikTok/TikTok.yaml',             '♻️ 自动选择', true,  1209600),
  bm7('linkedin',     'LinkedIn/LinkedIn.yaml',         '♻️ 自动选择', true,  1209600),
  bm7('docker',       'Docker/Docker.yaml',             '♻️ 自动选择', true,  1209600),
  bm7('GoogleFCM',    'GoogleFCM/GoogleFCM.yaml',       'DIRECT',      false, 1209600),
  bm7('cn',           'China/China.yaml',               'DIRECT',      true),
]

export const BUILT_IN_PROXIES: string[] = []
