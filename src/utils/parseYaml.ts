import yaml from 'js-yaml'
import type { ClashConfig, Proxy, RuleProvider, ClashGlobalSettings, ImportedProxyGroup, SubscriptionInfo } from '../types/clash'
import { DEFAULT_GLOBAL_SETTINGS } from '../types/clash'

export function parseSubscriptionInfo(header: string): SubscriptionInfo | undefined {
  if (!header) return undefined
  const result: Partial<SubscriptionInfo> = {}
  for (const part of header.split(';')) {
    const [key, val] = part.trim().split('=')
    const num = Number(val)
    if (key === 'upload')   result.upload   = num
    if (key === 'download') result.download = num
    if (key === 'total')    result.total    = num
    if (key === 'expire')   result.expire   = num
  }
  if (result.upload === undefined || result.download === undefined || result.total === undefined) return undefined
  return result as SubscriptionInfo
}

export async function fetchAndParseYaml(url: string, userAgent?: string): Promise<{ proxies: Proxy[], groups: ImportedProxyGroup[], subscriptionInfo?: SubscriptionInfo }> {
  const ua = userAgent || 'clash-verge/v2.2.3'
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}&ua=${encodeURIComponent(ua)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  const subInfoHeader = response.headers.get('X-Subscription-Userinfo')
  const subscriptionInfo = subInfoHeader ? parseSubscriptionInfo(subInfoHeader) : undefined
  const parsed = parseYamlFull(await response.text())
  return { ...parsed, subscriptionInfo }
}

export function parseYamlFull(text: string): { proxies: Proxy[], groups: ImportedProxyGroup[] } {
  const config = yaml.load(text) as ClashConfig
  if (!config || typeof config !== 'object') throw new Error('Invalid YAML: not an object')
  const proxies: Proxy[] = Array.isArray(config.proxies) ? config.proxies : []
  const groups: ImportedProxyGroup[] = Array.isArray(config['proxy-groups'])
    ? config['proxy-groups'].map((g) => ({
        name: g.name,
        type: g.type,
        proxies: Array.isArray(g.proxies) ? g.proxies : [],
        ...(Array.isArray(g.use) && g.use.length > 0 ? { use: g.use } : {}),
        ...(g.timeout !== undefined ? { timeout: g.timeout } : {}),
        url: g.url,
        interval: g.interval,
        tolerance: g.tolerance,
        ...(g.lazy !== undefined ? { lazy: g.lazy } : {}),
        ...(g.hidden ? { hidden: g.hidden } : {}),
        ...(g.filter ? { filter: g.filter } : {}),
        ...(g['exclude-filter'] ? { 'exclude-filter': g['exclude-filter'] } : {}),
        ...(g.strategy ? { strategy: g.strategy } : {}),
      }))
    : []
  if (proxies.length === 0 && groups.length === 0)
    throw new Error('No proxies or proxy-groups found in YAML config')
  return { proxies, groups }
}

export function parseYamlText(text: string): Proxy[] {
  return parseYamlFull(text).proxies
}

/**
 * Convert GitHub UI URLs to a CDN-friendly raw URL.
 * e.g. https://github.com/blackmatrix7/ios_rule_script/tree/master/rule/Clash/OpenAI.yaml
 *   → https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/OpenAI.yaml
 */
export function normalizeRuleUrl(url: string): string {
  // github.com/owner/repo/blob|tree/branch/...
  const githubMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|tree)\/([^/]+)\/(.+)$/
  )
  if (githubMatch) {
    const [, repo, branch, path] = githubMatch
    return `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${path}`
  }
  // raw.githubusercontent.com/owner/repo/branch/...
  const rawMatch = url.match(
    /^https?:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/([^/]+)\/(.+)$/
  )
  if (rawMatch) {
    const [, repo, branch, path] = rawMatch
    return `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${path}`
  }
  return url
}

/**
 * Infer a provider name from a URL (filename without extension, lowercased).
 */
export function inferProviderName(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').pop() ?? 'ruleset'
    return filename.replace(/\.(yaml|yml|txt)$/i, '').toLowerCase()
  } catch {
    return 'ruleset'
  }
}

/**
 * Infer behavior from URL path: paths containing "cidr" → ipcidr, else domain.
 */
export function inferBehavior(url: string): RuleProvider['behavior'] {
  const lower = url.toLowerCase()
  if (lower.includes('cidr')) return 'ipcidr'
  if (lower.includes('classical') || lower.includes('application')) return 'classical'
  return 'domain'
}

export function generateClashConfig(
  proxies: Proxy[],
  proxyGroups: Array<{
    name: string
    type: string
    proxies: string[]
    timeout?: number
    url?: string
    interval?: number
    tolerance?: number
    lazy?: boolean
    hidden?: boolean
  }>,
  /** All rule providers — RULE-SET rules generated from enabled ones */
  ruleProviders: RuleProvider[],
  /** Non-RULE-SET rules (DOMAIN, GEOIP, MATCH …) */
  rules: Array<{
    type: string
    payload: string
    target: string
    noResolve?: boolean
  }>,
  settings: ClashGlobalSettings = DEFAULT_GLOBAL_SETTINGS,
  flowArrays = false
): string {
  const normalizedSettings: ClashGlobalSettings = {
    ...DEFAULT_GLOBAL_SETTINGS,
    ...settings,
    'external-controller-cors': settings['external-controller-cors']
      ? {
          ...DEFAULT_GLOBAL_SETTINGS['external-controller-cors'],
          ...settings['external-controller-cors'],
          'allow-origins': settings['external-controller-cors']['allow-origins']
            ?? DEFAULT_GLOBAL_SETTINGS['external-controller-cors']?.['allow-origins']
            ?? ['*'],
        }
      : DEFAULT_GLOBAL_SETTINGS['external-controller-cors'],
    'geox-url': settings['geox-url']
      ? { ...DEFAULT_GLOBAL_SETTINGS['geox-url'], ...settings['geox-url'] }
      : DEFAULT_GLOBAL_SETTINGS['geox-url'],
    profile: settings.profile
      ? { ...DEFAULT_GLOBAL_SETTINGS.profile, ...settings.profile }
      : DEFAULT_GLOBAL_SETTINGS.profile,
    tun: settings.tun
      ? { ...DEFAULT_GLOBAL_SETTINGS.tun, ...settings.tun }
      : DEFAULT_GLOBAL_SETTINGS.tun,
    sniffer: settings.sniffer
      ? {
          ...DEFAULT_GLOBAL_SETTINGS.sniffer,
          ...settings.sniffer,
          sniff: settings.sniffer.sniff
            ? {
                ...DEFAULT_GLOBAL_SETTINGS.sniffer!.sniff,
                ...settings.sniffer.sniff,
              }
            : DEFAULT_GLOBAL_SETTINGS.sniffer!.sniff,
        }
      : DEFAULT_GLOBAL_SETTINGS.sniffer,
    dns: {
      ...DEFAULT_GLOBAL_SETTINGS.dns,
      ...settings.dns,
      'fallback-filter': settings.dns?.['fallback-filter']
        ? {
            ...DEFAULT_GLOBAL_SETTINGS.dns['fallback-filter'],
            ...settings.dns['fallback-filter'],
          }
        : DEFAULT_GLOBAL_SETTINGS.dns['fallback-filter'],
      'nameserver-policy': (() => {
        const merged = settings.dns?.['nameserver-policy']
          ? {
              ...DEFAULT_GLOBAL_SETTINGS.dns['nameserver-policy'],
              ...settings.dns['nameserver-policy'],
            }
          : { ...DEFAULT_GLOBAL_SETTINGS.dns['nameserver-policy'] }
        delete merged['geosite:geolocation-!cn']
        return merged
      })(),
    },
  }

  const config: ClashConfig = {
    'mixed-port': normalizedSettings['mixed-port'],
    ...('redir-port' in normalizedSettings && normalizedSettings['redir-port'] !== undefined ? { 'redir-port': normalizedSettings['redir-port'] } : {}),
    'allow-lan': normalizedSettings['allow-lan'],
    'bind-address': normalizedSettings['bind-address'],
    mode: normalizedSettings.mode,
    'log-level': normalizedSettings['log-level'],
    'external-controller': normalizedSettings['external-controller'],
    ...(normalizedSettings['external-controller-cors'] ? { 'external-controller-cors': normalizedSettings['external-controller-cors'] } : {}),
    ...(normalizedSettings.secret !== undefined ? { secret: normalizedSettings.secret } : {}),
    ...(normalizedSettings['external-ui'] !== undefined ? { 'external-ui': normalizedSettings['external-ui'] } : {}),
    ...(normalizedSettings['external-ui-name'] !== undefined ? { 'external-ui-name': normalizedSettings['external-ui-name'] } : {}),
    ...(normalizedSettings['external-ui-url'] !== undefined ? { 'external-ui-url': normalizedSettings['external-ui-url'] } : {}),
    'find-process-mode': normalizedSettings['find-process-mode'],
    'geodata-mode': normalizedSettings['geodata-mode'],
    ...(normalizedSettings['geo-auto-update'] !== undefined ? { 'geo-auto-update': normalizedSettings['geo-auto-update'] } : {}),
    ...(normalizedSettings['geo-update-interval'] !== undefined ? { 'geo-update-interval': normalizedSettings['geo-update-interval'] } : {}),
    'geox-url': normalizedSettings['geox-url'],
    'global-client-fingerprint': normalizedSettings['global-client-fingerprint'],
    'tcp-concurrent': normalizedSettings['tcp-concurrent'],
    'unified-delay': normalizedSettings['unified-delay'],
    ...(normalizedSettings['udp-timeout'] !== undefined ? { 'udp-timeout': normalizedSettings['udp-timeout'] } : {}),
    ...(normalizedSettings['keep-alive-interval'] !== undefined ? { 'keep-alive-interval': normalizedSettings['keep-alive-interval'] } : {}),
    ...(normalizedSettings.ipv6 !== undefined ? { ipv6: normalizedSettings.ipv6 } : {}),
    ...(normalizedSettings.udp !== undefined ? { udp: normalizedSettings.udp } : {}),
    ...('prefer-h3' in normalizedSettings && normalizedSettings['prefer-h3'] !== undefined ? { 'prefer-h3': normalizedSettings['prefer-h3'] } : {}),
    ...(normalizedSettings.profile ? { profile: normalizedSettings.profile } : {}),
    // TUN 虚拟网卡：仅当 enable=true 或用户明确配置时才输出，避免所有人被强制开启
    ...(normalizedSettings.tun?.enable ? { tun: normalizedSettings.tun } : {}),
    ...(normalizedSettings.hosts && Object.keys(normalizedSettings.hosts).length > 0 ? { hosts: normalizedSettings.hosts } : {}),
    dns: normalizedSettings.dns,
    sniffer: normalizedSettings.sniffer,
    ...('routing-mark' in normalizedSettings && normalizedSettings['routing-mark'] !== undefined ? { 'routing-mark': normalizedSettings['routing-mark'] } : {}),
    proxies: normalizedSettings['ip-version']
      ? proxies.map((p) => (p['ip-version'] ? p : { ...p, 'ip-version': normalizedSettings['ip-version'] }))
      : proxies,
    'proxy-groups': proxyGroups,
  }

  const enabledProviders = ruleProviders.filter((p) => p.enabled)

  if (enabledProviders.length > 0) {
    config['rule-providers'] = {}
    for (const rp of enabledProviders) {
      config['rule-providers'][rp.name] = {
        type: rp.type,
        behavior: rp.behavior,
        url: rp.url,
        path: rp.path ?? `./ruleset/${rp.name}.yaml`,
        interval: rp.interval ?? 86400,
      }
    }
  }

  const enabledProviderMap = new Map(enabledProviders.map((p) => [p.name, p]))

  const renderRule = (r: { type: string; payload: string; target: string; noResolve?: boolean }) => {
    if (r.type === 'MATCH') return `MATCH,${r.target}`
    if (r.type === 'RULE-SET') {
      return r.noResolve
        ? `RULE-SET,${r.payload},${r.target},no-resolve`
        : `RULE-SET,${r.payload},${r.target}`
    }
    if (r.noResolve) return `${r.type},${r.payload},${r.target},no-resolve`
    return `${r.type},${r.payload},${r.target}`
  }

  // Process all rules in order; RULE-SET entries are emitted inline when provider is enabled
  const allRuleLines: string[] = []
  let matchRule: { type: string; payload: string; target: string; noResolve?: boolean } | undefined
  const handledProviders = new Set<string>()

  for (const rule of rules) {
    if (rule.type === 'MATCH') {
      matchRule = rule
      continue
    }
    if (rule.type === 'RULE-SET') {
      handledProviders.add(rule.payload)
      if (!enabledProviderMap.has(rule.payload)) continue  // skip if provider disabled/missing
      allRuleLines.push(renderRule(rule))
    } else {
      // For compound rules (AND/OR/NOT), extract any embedded RULE-SET references
      // so those providers aren't auto-appended as standalone RULE-SET rules later.
      if (rule.type === 'AND' || rule.type === 'OR' || rule.type === 'NOT') {
        for (const m of rule.payload.matchAll(/RULE-SET,([^,)]+)/g)) {
          handledProviders.add(m[1])
        }
      }
      allRuleLines.push(renderRule(rule))
    }
  }

  // Append any enabled providers not yet referenced in the rules array
  for (const rp of enabledProviders) {
    if (handledProviders.has(rp.name)) continue
    const noResolve = rp.noResolve || rp.behavior === 'ipcidr'
    allRuleLines.push(
      noResolve ? `RULE-SET,${rp.name},${rp.target},no-resolve` : `RULE-SET,${rp.name},${rp.target}`
    )
  }

  config.rules = [
    ...allRuleLines,
    ...(matchRule ? [renderRule(matchRule)] : []),
  ]

  return yaml.dump(config, {
    // Full block format: avoids flow-mode quoting bugs when proxy fields
    // contain special chars (commas, braces, colons) that break mihomo's parser
    lineWidth: -1,
    noRefs: true,
    // flowArrays: depth >= 2 uses flow (inline) style, compressing array items to one line each
    ...(flowArrays ? { flowLevel: 2 } : {}),
  })
}
