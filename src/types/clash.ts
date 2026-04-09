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

export interface SourceConfig {
  id: string
  name: string
  url: string
  userAgent?: string
  status: 'idle' | 'loading' | 'success' | 'error'
  error?: string
  proxies: Proxy[]
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
  'default-nameserver': string[]
  'enhanced-mode': string
  'fake-ip-range': string
  'use-hosts': boolean
  'respect-rules': boolean
  'proxy-server-nameserver': string[]
  nameserver: string[]
  fallback: string[]
  'fallback-filter': DnsFallbackFilter
}

export interface ClashGlobalSettings {
  'mixed-port': number
  'allow-lan': boolean
  'bind-address': string
  mode: string
  'log-level': string
  'external-controller': string
  dns: DnsConfig
}

export const DEFAULT_GLOBAL_SETTINGS: ClashGlobalSettings = {
  'mixed-port': 7890,
  'allow-lan': true,
  'bind-address': '*',
  mode: 'rule',
  'log-level': 'info',
  'external-controller': '127.0.0.1:9090',
  dns: {
    enable: true,
    ipv6: false,
    'default-nameserver': ['223.5.5.5', '119.29.29.29', '114.114.114.114'],
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'use-hosts': true,
    'respect-rules': true,
    'proxy-server-nameserver': ['223.5.5.5', '119.29.29.29', '114.114.114.114'],
    nameserver: ['223.5.5.5', '119.29.29.29', '114.114.114.114'],
    fallback: ['1.1.1.1', '8.8.8.8'],
    'fallback-filter': {
      geoip: true,
      'geoip-code': 'CN',
      geosite: ['gfw'],
      ipcidr: ['240.0.0.0/4'],
      domain: ['+.google.com', '+.facebook.com', '+.youtube.com'],
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
  preset('reject',       'domain',    'REJECT', true),
  preset('private',      'domain',    'DIRECT', true),
  preset('applications', 'classical', 'DIRECT', false),
  preset('icloud',       'domain',    'DIRECT', false),
  preset('apple',        'domain',    'DIRECT', false),
  preset('google',       'domain',    'PROXY',  false),
  preset('proxy',        'domain',    'PROXY',  true),
  preset('direct',       'domain',    'DIRECT', true),
  preset('gfw',          'domain',    'PROXY',  false),
  preset('tld-not-cn',   'domain',    'PROXY',  false),
  preset('telegramcidr', 'ipcidr',    'PROXY',  false, true),
  preset('cncidr',       'ipcidr',    'DIRECT', true,  true),
  preset('lancidr',      'ipcidr',    'DIRECT', true,  true),
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
  bm7('cn',           'China/China.yaml',             'DIRECT', true),
  bm7('openai',       'OpenAI/OpenAI.yaml',            'PROXY',  true),
  bm7('claude',       'Claude/Claude.yaml',            'PROXY',  true),
  bm7('gemini',       'Gemini/Gemini.yaml',            'PROXY',  true),
  bm7('copilot',      'Copilot/Copilot.yaml',          'PROXY',  false),
  bm7('youtube',      'YouTube/YouTube.yaml',          'PROXY',  false),
  bm7('telegram',     'Telegram/Telegram.yaml',        'PROXY',  false, 1209600),
  bm7('twitter',      'Twitter/Twitter.yaml',          'PROXY',  false, 1209600),
  bm7('tiktok',       'TikTok/TikTok.yaml',            'PROXY',  false, 1209600),
  bm7('linkedin',     'LinkedIn/LinkedIn.yaml',        'PROXY',  false, 1209600),
  bm7('docker',       'Docker/Docker.yaml',            'PROXY',  false, 1209600),
  bm7('youtube-music','YouTubeMusic/YouTubeMusic.yaml','PROXY',  false, 1209600),
  bm7('GoogleFCM',    'GoogleFCM/GoogleFCM.yaml',      'DIRECT', false, 1209600),
]

export const BUILT_IN_PROXIES = ['DIRECT', 'REJECT']
