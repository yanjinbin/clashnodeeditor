import yaml from 'js-yaml'
import type { ClashConfig, Proxy, RuleProvider, ClashGlobalSettings } from '../types/clash'
import { DEFAULT_GLOBAL_SETTINGS } from '../types/clash'

export async function fetchAndParseYaml(url: string, userAgent?: string): Promise<Proxy[]> {
  const ua = userAgent || 'mihomo/1.19.0'
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}&ua=${encodeURIComponent(ua)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  return parseYamlText(await response.text())
}

export function parseYamlText(text: string): Proxy[] {
  const config = yaml.load(text) as ClashConfig
  if (!config || typeof config !== 'object') throw new Error('Invalid YAML: not an object')
  if (!config.proxies || !Array.isArray(config.proxies))
    throw new Error('No proxies found in YAML config')
  return config.proxies
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
    url?: string
    interval?: number
    tolerance?: number
    lazy?: boolean
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
  settings: ClashGlobalSettings = DEFAULT_GLOBAL_SETTINGS
): string {
  const config: ClashConfig = {
    'mixed-port': settings['mixed-port'],
    'allow-lan': settings['allow-lan'],
    'bind-address': settings['bind-address'],
    mode: settings.mode,
    'log-level': settings['log-level'],
    'external-controller': settings['external-controller'],
    dns: settings.dns,
    proxies,
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

  // Manual rules except MATCH
  const nonMatchRules = rules.filter((r) => r.type !== 'MATCH')
  const matchRule = rules.find((r) => r.type === 'MATCH')

  // Auto-generate RULE-SET rules from enabled providers (in provider list order)
  const ruleSetLines = enabledProviders.map((rp) => {
    const noResolve = rp.noResolve || rp.behavior === 'ipcidr'
    return noResolve
      ? `RULE-SET,${rp.name},${rp.target},no-resolve`
      : `RULE-SET,${rp.name},${rp.target}`
  })

  const renderRule = (r: { type: string; payload: string; target: string; noResolve?: boolean }) => {
    if (r.type === 'MATCH') return `MATCH,${r.target}`
    if (r.noResolve) return `${r.type},${r.payload},${r.target},no-resolve`
    return `${r.type},${r.payload},${r.target}`
  }

  config.rules = [
    ...nonMatchRules.map(renderRule),
    ...ruleSetLines,
    ...(matchRule ? [renderRule(matchRule)] : []),
  ]

  return yaml.dump(config, {
    // flowLevel: 2 → proxies/proxy-groups items and rule-providers values
    // become single-line flow mappings: { name: ..., type: ..., ... }
    flowLevel: 2,
    // Disable line wrapping so each proxy stays on one line regardless of length
    lineWidth: -1,
    noRefs: true,
  })
}
