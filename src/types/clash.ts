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
  /** proxy-providers to include (use field in Mihomo) */
  use?: string[]
  timeout?: number
  url?: string
  interval?: number
  tolerance?: number
  /** 延迟测试时跳过未活跃节点，减少不必要的测速请求 */
  lazy?: boolean
  /** 在 Dashboard 中隐藏此代理组（仍参与路由），适合中间跳等内部组 */
  hidden?: boolean
  /** regex filter for selecting proxies by name */
  filter?: string
  /** regex to exclude proxies by name */
  'exclude-filter'?: string
  /** load-balance strategy */
  strategy?: string
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
  use?: string[]
  timeout?: number
  url?: string
  interval?: number
  tolerance?: number
  lazy?: boolean
  hidden?: boolean
  filter?: string
  'exclude-filter'?: string
  strategy?: string
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
  /** 强制将 IP 连接 DNS 映射回域名再匹配规则 */
  'force-dns-mapping'?: boolean
  /** 嗅探结果覆盖原始目标地址（影响路由匹配） */
  'override-destination'?: boolean
  sniff: Record<string, { ports: (number | string)[] }>
  'force-domain'?: string[]
  'skip-domain'?: string[]
}

export interface TunConfig {
  enable: boolean
  stack?: 'system' | 'gvisor' | 'mixed'
  'dns-hijack'?: string[]
  'auto-route'?: boolean
  'auto-redirect'?: boolean
  'auto-detect-interface'?: boolean
  'inet6-address'?: string[]
}

export interface GeoxUrl {
  geoip?: string
  geosite?: string
  mmdb?: string
}

export interface ExternalControllerCorsConfig {
  'allow-origins': string[]
  'allow-private-network'?: boolean
}

export interface ClashGlobalSettings {
  'mixed-port': number
  'allow-lan': boolean
  'bind-address': string
  mode: string
  'log-level': string
  'external-controller': string
  'external-controller-cors'?: ExternalControllerCorsConfig
  secret?: string
  'external-ui'?: string
  'external-ui-name'?: string
  'external-ui-url'?: string
  'tcp-concurrent'?: boolean
  'unified-delay'?: boolean
  'udp-timeout'?: number
  /** TCP/UDP 保活探测间隔（秒），Mihomo 字段名为 keep-alive-interval */
  'keep-alive-interval'?: number
  /** 全局 IPv6 开关，关闭后 Mihomo 不处理 IPv6 流量 */
  ipv6?: boolean
  /** 全局禁用 UDP，链式代理 / Google / Gemini 场景推荐设 false */
  udp?: boolean
  'find-process-mode'?: string
  'geodata-mode'?: boolean
  /** 自动更新 GeoData 文件 */
  'geo-auto-update'?: boolean
  /** GeoData 自动更新间隔（小时） */
  'geo-update-interval'?: number
  'geox-url'?: GeoxUrl
  'global-client-fingerprint'?: string
  profile?: { 'store-selected'?: boolean; 'store-fake-ip'?: boolean }
  /** HTTP/3 优先（QUIC），建议配合 udp:true 才有意义 */
  'prefer-h3'?: boolean
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
  // warning 减少无意义日志输出；调试时可改为 debug
  'log-level': 'warning',
  'external-controller': '127.0.0.1:9090',
  'external-controller-cors': {
    'allow-origins': ['*'],
    'allow-private-network': true,
  },
  secret: '',
  'external-ui': './ui',
  'external-ui-name': 'zashboard',
  'external-ui-url': 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip',
  'find-process-mode': 'strict',
  'geodata-mode': true,
  // 开启后 Mihomo 启动时自动拉取最新 GeoData 文件
  'geo-auto-update': true,
  // GeoData 自动更新间隔（小时）；72h = 每 3 天更新一次
  'geo-update-interval': 72,
  'geox-url': {
    geoip:    'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat',
    geosite:  'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat',
    mmdb:     'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb',
  },
  'global-client-fingerprint': 'chrome',
  // 同时向多个 IP 发起连接取最快（Happy Eyeballs 变体），减少握手等待
  'tcp-concurrent': true,
  // 延迟测试显示端到端总延迟（本地→中转→落地），而非只测本地到代理的一跳
  'unified-delay': true,
  ipv6: false,
  udp: false,
  'prefer-h3': false,
  // UDP 会话静默超时（秒），超时后释放 NAT 映射；300 适合游戏/视频场景
  'udp-timeout': 300,
  // TCP/UDP 保活探测间隔（秒），防止中间 NAT/路由器静默关闭长连接
  'keep-alive-interval': 15,
  // TUN 虚拟网卡：创建内核级网卡接管全部系统流量，让分流规则对所有进程生效
  tun: {
    enable: true,
    // mixed 同时处理 TCP 和 UDP，避免 UDP 流量漏出 TUN
    stack: 'mixed',
    // 劫持全部 DNS 查询（含 UDP/TCP 53），防止 DNS 泄露真实 IP
    'dns-hijack': ['any:53', 'tcp://any:53'],
    // 向系统路由表注入规则，将流量引导进 TUN 网卡
    'auto-route': true,
    // 自动识别默认出口网卡并绑定，避免路由回环
    'auto-detect-interface': true,
    // IPv6 TUN 地址段；开启后 TUN 网卡同时监听 IPv6，避免 IPv6 流量绕过
    'inet6-address': [],
  },
  profile: {
    'store-selected': true,
    'store-fake-ip': true,
  },
  sniffer: {
    enable: true,
    // 将裸 IP 连接通过 DNS 映射反查为域名，再匹配基于域名的分流规则
    'parse-pure-ip': true,
    // 强制把 IP 连接的 DNS 反向映射结果用于规则匹配（parse-pure-ip 的增强版）
    'force-dns-mapping': true,
    // 将嗅探到的域名覆盖原始目标地址，让下游规则能用域名而非 IP 匹配
    'override-destination': true,
    sniff: {
      TLS:  { ports: [443, 8443] },
      HTTP: { ports: [80, 8080] },
    },
    // 强制对这些域名嗅探，即使它们已有 DNS 映射
    'force-domain': ['+.v2ex.com'],
    'skip-domain': [
      'Mijia Cloud',
      '+.push.apple.com',
      '+.apple.com',
      '+.mi.com',
      '+.xiaomi.com',
      '+.local',
      'msftconnecttest.com',
      'time.*.com',
      '+.ntp.org',
      '+.weixin.qq.com',
      '+.wx.qq.com',
      '+.wechat.com',
      '+.mmobject.com',
      '+.mmfile.com',
      '+.qpic.cn',
      '+.qlogo.cn',
      '+.qq.com',
      '+.tencent.com',
      '+.tencent.cn',
    ],
  },
  dns: {
    enable: true,
    ipv6: false,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    // 这些域名绕过 fake-ip，返回真实 IP（时间同步、NTP、IoT 设备、游戏主机等）
    'fake-ip-filter': [
      // 内网 / 本地
      '*.lan',
      '*.local',
      '*.localdomain',
      '*.internal',
      // 时间同步 & NTP
      'time.*.com',
      'time.*.gov',
      'ntp.*.com',
      '*.ntp.org',
      'time1.cloud.tencent.com',
      'ntp*.aliyun.com',
      'pool.ntp.org',
      // WebRTC STUN（语音/视频）
      '+.stun.*.*',
      '+.stun.*.*.*',
      'stun.*.*',
      // Apple 设备
      '+.push.apple.com',
      '+.apple.com',
      '+.icloud.com',
      '+.mzstatic.com',
      'swscan.apple.com',
      'mesu.apple.com',
      'captive.apple.com',
      // 小米 / 米家 IoT
      '+.mi.com',
      '+.xiaomi.com',
      '+.miui.com',
      '+.mijia.com',
      '+.io.mi.com',
      'home.miot-spec.com',
      // 智能家居第三方
      '+.tuya.com',
      '+.tuyacn.com',
      'aqara.com',
      '+.aqara.com',
      '+.yeelight.com',
      '+.hikvision.com',
      // 微软网络检测
      'connectivitycheck.gstatic.com',
      'www.msftconnecttest.com',
      'www.msftncsi.com',
      'msftconnecttest.com',
      // 游戏主机
      '+.xboxlive.com',
      '+.nintendo.net',
      '+.playstation.net',
      '+.playstation.com',
    ],
    // 解析时优先查询 /etc/hosts，适合内网自定义域名场景
    'use-hosts': true,
    'respect-rules': true,
    // 仅用于引导阶段：解析 nameserver 中 DoH/DoT 服务器的域名（如 dns.google）
    // 必须填国内可直连的纯 IP DNS，否则 DoH 地址无法解析导致启动失败
    'default-nameserver': ['223.5.5.5', '119.29.29.29', '114.114.114.114'],
    // 专用于解析代理节点服务器域名（机场域名）
    // 必须走国内可直连 DNS，防止节点域名被污染解析到错误 IP
    'proxy-server-nameserver': ['223.5.5.5', '119.29.29.29'],
    // 默认 DNS：处理未被 nameserver-policy 命中的所有域名查询
    nameserver: ['223.5.5.5', '119.29.29.29', '114.114.114.114'],
    'nameserver-policy': {
      'geosite:cn,private': ['223.5.5.5', '119.29.29.29'],
      'geosite:geolocation-!cn': [
        'https://1.1.1.1/dns-query#♻️ 自动选择',
        'https://8.8.8.8/dns-query#♻️ 自动选择',
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
  'external-controller-cors'?: ExternalControllerCorsConfig
  secret?: string
  'external-ui'?: string
  'external-ui-name'?: string
  'external-ui-url'?: string
  'tcp-concurrent'?: boolean
  'unified-delay'?: boolean
  'udp-timeout'?: number
  'keep-alive-interval'?: number
  /** backward compat: some configs still use the old field name */
  'tcp-keep-alive-interval'?: number
  ipv6?: boolean
  udp?: boolean
  'find-process-mode'?: string
  'geodata-mode'?: boolean
  'geo-auto-update'?: boolean
  'geo-update-interval'?: number
  'geox-url'?: GeoxUrl
  'global-client-fingerprint'?: string
  profile?: { 'store-selected'?: boolean; 'store-fake-ip'?: boolean }
  'prefer-h3'?: boolean
  tun?: TunConfig
  sniffer?: SnifferConfig
  dns?: DnsConfig
  proxies?: Proxy[]
  'proxy-groups'?: Array<{
    name: string
    type: string
    proxies: string[]
    use?: string[]
    timeout?: number
    url?: string
    interval?: number
    tolerance?: number
    lazy?: boolean
    hidden?: boolean
    filter?: string
    'exclude-filter'?: string
    strategy?: string
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
    interval: 43200,
    target,
    enabled,
    noResolve,
    isPreset: true,
  }
}

export const PRESET_RULE_PROVIDERS: RuleProvider[] = [
  preset('reject',       'domain',    'REJECT',       false),
  preset('private',      'domain',    'DIRECT',       true),
  preset('google',       'domain',    '🗽 美国出口', true),
  preset('direct',       'domain',    'DIRECT',       false),
  preset('gfw',          'domain',    '♻️ 自动选择', false),
  preset('telegramcidr', 'ipcidr',    '♻️ 自动选择', false, true),
  preset('cncidr',       'ipcidr',    'DIRECT',       false, true),
  preset('lancidr',      'ipcidr',    'DIRECT',       false, true),
]

function bm7(
  id: string,
  filePath: string,
  target: string,
  enabled = false,
  interval = 43200
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
  bm7('openai',       'OpenAI/OpenAI.yaml',             '🗽 美国出口', true),
  bm7('claude',       'Claude/Claude.yaml',             '🪬 Claude专用', true),
  bm7('gemini',       'Gemini/Gemini.yaml',             '🗽 美国出口', true),
  bm7('copilot',      'Copilot/Copilot.yaml',           '🗽 美国出口', true),
  bm7('github',       'GitHub/GitHub.yaml',             '🪬 Claude专用', true),
  bm7('youtube-music','YouTubeMusic/YouTubeMusic.yaml', '📺 油管', true),
  bm7('youtube',      'YouTube/YouTube.yaml',           '📺 油管', true),
  bm7('telegram',     'Telegram/Telegram.yaml',         '📺 油管', true),
  bm7('twitter',      'Twitter/Twitter.yaml',           '📡 社交媒体', true),
  bm7('tiktok',       'TikTok/TikTok.yaml',             '📺 油管', true),
  bm7('linkedin',     'LinkedIn/LinkedIn.yaml',         '📡 社交媒体', true),
  bm7('microsoft',    'Microsoft/Microsoft.yaml',       '📺 油管', true),
  bm7('tencent',      'Tencent/Tencent.yaml',           'DIRECT',      true),
  bm7('docker',       'Docker/Docker.yaml',             '♻️ 自动选择', true),
  bm7('GoogleFCM',    'GoogleFCM/GoogleFCM.yaml',       'DIRECT',      false),
  bm7('cn',           'China/China.yaml',               'DIRECT',      false),
  {
    id: 'twitter-video',
    name: 'twitter-video',
    type: 'http',
    behavior: 'classical',
    url: 'https://cdn.jsdelivr.net/gh/yanjinbin/dotfiles@master/twitter-video.yaml',
    path: './ruleset/twitter-video.yaml',
    interval: 2592000,
    target: '📺 油管',
    enabled: true,
    isPreset: true,
  },
]

export const BUILT_IN_PROXIES: string[] = []
