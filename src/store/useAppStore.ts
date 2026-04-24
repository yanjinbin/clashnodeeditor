import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SourceConfig, ProxyGroup, RuleProvider, Rule, Proxy, ClashConfig, ClashGlobalSettings, DnsConfig, DnsFallbackFilter } from '../types/clash'
import { PRESET_RULE_PROVIDERS, BLACKMATRIX7_RULE_PROVIDERS, DEFAULT_GLOBAL_SETTINGS } from '../types/clash'
import { getInitialLanguage, type Language } from '../i18n/language'

interface AppState {
  sources: SourceConfig[]
  /** Manually added proxy nodes (persist fully, unlike subscription sources) */
  manualProxies: Proxy[]
  proxyGroups: ProxyGroup[]
  /** All rule providers: preset + user-added, ordered, each with enabled/target */
  ruleProviders: RuleProvider[]
  /** Non-RULE-SET routing rules (DOMAIN, GEOIP, MATCH, etc.) */
  rules: Rule[]
  activeTab: 'sources' | 'nodes' | 'groups' | 'rules' | 'preview'
  globalSettings: ClashGlobalSettings

  // Source actions
  addSource: (source: Omit<SourceConfig, 'id' | 'status' | 'proxies'>) => string
  updateSource: (id: string, updates: Partial<SourceConfig>) => void
  removeSource: (id: string) => void

  // Manual proxy node actions
  addManualProxy: (proxy: Proxy) => void
  updateManualProxy: (index: number, updates: Partial<Proxy>) => void
  removeManualProxy: (index: number) => void
  reorderManualProxies: (oldIndex: number, newIndex: number) => void

  // ProxyGroup actions
  addProxyGroup: (group: Omit<ProxyGroup, 'id'>) => string
  updateProxyGroup: (id: string, updates: Partial<ProxyGroup>) => void
  removeProxyGroup: (id: string) => void
  addProxyToGroup: (groupId: string, proxyName: string) => void
  removeProxyFromGroup: (groupId: string, proxyName: string) => void
  reorderProxiesInGroup: (groupId: string, oldIndex: number, newIndex: number) => void
  reorderProxyGroups: (oldIndex: number, newIndex: number) => void

  // Rule provider CRUD
  addRuleProvider: (provider: Omit<RuleProvider, 'id'>) => void
  updateRuleProvider: (id: string, updates: Partial<Omit<RuleProvider, 'id'>>) => void
  removeRuleProvider: (id: string) => void
  reorderRuleProviders: (oldIndex: number, newIndex: number) => void

  // Rule actions
  addRule: (rule: Omit<Rule, 'id'>) => void
  removeRule: (id: string) => void
  reorderRules: (oldIndex: number, newIndex: number) => void

  setActiveTab: (tab: AppState['activeTab']) => void
  showChainExample: boolean
  setShowChainExample: (v: boolean) => void

  // Proxy node editing
  updateProxy: (sourceId: string, proxyIndex: number, updates: Partial<Proxy>) => void
  applyPrefixToSource: (sourceId: string, prefix: string) => void
  importSourceGroup: (sourceId: string, groupName: string) => void

  // Global settings actions
  updateGlobalSettings: (updates: Partial<Omit<ClashGlobalSettings, 'dns'>>) => void
  updateDnsSettings: (updates: Partial<Omit<DnsConfig, 'fallback-filter'>>) => void
  updateDnsFallbackFilter: (updates: Partial<DnsFallbackFilter>) => void

  getAllProxies: () => Proxy[]
  getAllProxyNames: () => string[]

  importFullConfig: (config: ClashConfig) => void

  // Reset actions
  resetSources: () => void
  resetManualProxies: () => void
  resetProxyGroups: () => void
  resetRules: () => void
  syncPresetLanguage: (language: Language) => void
}

// ── Expiring localStorage storage (TTL = 12 h) ───────────────────────────────

const TTL_MS = 12 * 60 * 60 * 1000

/** StateStorage adapter — wraps localStorage with a 12-hour expiry envelope. */
const expiringLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      const raw = localStorage.getItem(name)
      if (!raw) return null
      const { data, expiry } = JSON.parse(raw) as { data: unknown; expiry: number }
      if (Date.now() > expiry) {
        localStorage.removeItem(name)
        return null           // expired → rehydrate from defaults
      }
      return JSON.stringify(data)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, JSON.stringify({
        data:   JSON.parse(value),
        expiry: Date.now() + TTL_MS,
      }))
    } catch { /* storage quota exceeded — silently skip */ }
  },
  removeItem: (name: string): void => { localStorage.removeItem(name) },
}

// ─────────────────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

const PRESET_GROUP_LABELS = {
  us:       { zh: '🗽 美国出口',    en: '🗽 US Exit' },
  jp:       { zh: '🗼 日本出口',    en: '🗼 Japan Exit' },
  auto:     { zh: '♻️ 自动选择',    en: '♻️ Auto Select' },
  fallback: { zh: '🛡️ 故障转移',    en: '🛡️ Fallback' },
  youtube:  { zh: '📺 油管',        en: '📺 YouTube' },
  social:   { zh: '📡 社交媒体',    en: '📡 Social Media' },
  claude:   { zh: '🪬 Claude专用',  en: '🪬 Claude Dedicated' },
  select:   { zh: '🌐 节点选择',    en: '🌐 Node Select' },
} as const

const IMPORTED_CONFIG_NAME: Record<Language, string> = {
  zh: '导入的配置',
  en: 'Imported Config',
}

type PresetGroupKey = keyof typeof PRESET_GROUP_LABELS

function presetGroupName(key: PresetGroupKey, language: Language) {
  return PRESET_GROUP_LABELS[key][language]
}

function presetNameMap(language: Language) {
  const map = new Map<string, string>()
  for (const labels of Object.values(PRESET_GROUP_LABELS)) {
    map.set(labels.zh, labels[language])
    map.set(labels.en, labels[language])
  }
  return map
}

function syncPresetReferences(
  proxyGroups: ProxyGroup[],
  rules: Rule[],
  ruleProviders: RuleProvider[],
  language: Language
) {
  const map = presetNameMap(language)
  for (const group of proxyGroups) {
    group.name = map.get(group.name) ?? group.name
    group.proxies = group.proxies.map((name) => map.get(name) ?? name)
  }
  for (const rule of rules) {
    rule.target = map.get(rule.target) ?? rule.target
  }
  for (const provider of ruleProviders) {
    provider.target = map.get(provider.target) ?? provider.target
  }
}

function createDefaultProxyGroups(language: Language = getInitialLanguage()): ProxyGroup[] {
  return [
    // ── 出口─────────────────────────────────────────────────────────────────────
    {
      id: generateId(),
      name: presetGroupName('us', language),
      type: 'select',
      proxies: [],
      url: 'https://cp.cloudflare.com/generate_204',
      interval: 120,
    },
    {
      id: generateId(),
      name: presetGroupName('jp', language),
      type: 'select',
      proxies: [],
      url: 'https://cp.cloudflare.com/generate_204',
      interval: 120,
    },
    // ── 总自动选择──────────────────────────────────────────────────────────────
    {
      id: generateId(),
      name: presetGroupName('auto', language),
      type: 'url-test',
      proxies: [],
      timeout: 3000,
      tolerance: 200,
      url: 'https://cp.cloudflare.com/generate_204',
      interval: 120,
      lazy: true,
      autoAllNodes: true,
    },
    // ── 故障转移（MATCH 兜底）───────────────────────────────────────────────────
    {
      id: generateId(),
      name: presetGroupName('fallback', language),
      type: 'fallback',
      proxies: [presetGroupName('auto', language)],
      timeout: 3000,
      url: 'https://cp.cloudflare.com/generate_204',
      interval: 120,
      lazy: true,
    },
    // ── 专项流量────────────────────────────────────────────────────────────────
    {
      id: generateId(),
      name: presetGroupName('youtube', language),
      type: 'url-test',
      proxies: [presetGroupName('auto', language)],
      timeout: 2000,
      tolerance: 100,
      url: 'https://cp.cloudflare.com/generate_204',
      interval: 120,
      lazy: true,
    },
    {
      id: generateId(),
      name: presetGroupName('social', language),
      type: 'url-test',
      proxies: [presetGroupName('auto', language)],
      timeout: 3000,
      tolerance: 100,
      url: 'https://cp.cloudflare.com/generate_204',
      interval: 120,
      lazy: true,
    },
    {
      id: generateId(),
      name: presetGroupName('claude', language),
      type: 'select',
      proxies: [presetGroupName('jp', language)],
      url: 'https://cp.cloudflare.com/generate_204',
      interval: 120,
    },
    // ── 手动节点选择──────────────────────────────────────────────────────────────
    {
      id: generateId(),
      name: presetGroupName('select', language),
      type: 'select',
      proxies: [
        presetGroupName('auto', language),
        presetGroupName('fallback', language),
        presetGroupName('us', language),
        presetGroupName('jp', language),
      ],
      url: 'https://cp.cloudflare.com/generate_204',
      interval: 120,
    },
  ]
}

function createDefaultRules(language: Language = getInitialLanguage()): Rule[] {
  return [
    // ── 1) 本地/局域网（最高优先级）──────────────────────────────────────────────
    { id: generateId(), type: 'IP-CIDR',       payload: '0.0.0.0/32',       target: 'REJECT-DROP', noResolve: true },
    { id: generateId(), type: 'IP-CIDR',       payload: '127.0.0.0/8',      target: 'DIRECT', noResolve: true },
    { id: generateId(), type: 'DOMAIN',        payload: 'localhost',         target: 'DIRECT' },
    { id: generateId(), type: 'DOMAIN-SUFFIX', payload: 'local',             target: 'DIRECT' },
    { id: generateId(), type: 'IP-CIDR',       payload: '10.0.0.0/8',        target: 'DIRECT', noResolve: true },
    { id: generateId(), type: 'IP-CIDR',       payload: '172.16.0.0/12',     target: 'DIRECT', noResolve: true },
    { id: generateId(), type: 'IP-CIDR',       payload: '192.168.0.0/16',    target: 'DIRECT', noResolve: true },
    { id: generateId(), type: 'RULE-SET',      payload: 'private',           target: 'DIRECT' },
    { id: generateId(), type: 'GEOIP',         payload: 'LAN',               target: 'DIRECT', noResolve: true },
    // ── 2) UDP 精细控制──────────────────────────────────────────────────────────
    { id: generateId(), type: 'AND', payload: '((RULE-SET,youtube),(DST-PORT,443),(NETWORK,UDP))',       target: presetGroupName('youtube', language) },
    { id: generateId(), type: 'AND', payload: '((RULE-SET,youtube-music),(DST-PORT,443),(NETWORK,UDP))', target: presetGroupName('youtube', language) },
    { id: generateId(), type: 'AND', payload: '((RULE-SET,gemini),(NETWORK,UDP))',                       target: 'REJECT' },
    { id: generateId(), type: 'AND', payload: '((RULE-SET,google),(NETWORK,UDP))',                       target: 'REJECT' },
    { id: generateId(), type: 'AND', payload: '((RULE-SET,tencent),(NETWORK,UDP))',                      target: 'DIRECT' },
    { id: generateId(), type: 'AND', payload: '((GEOIP,CN),(NETWORK,UDP))',                              target: 'DIRECT' },
    { id: generateId(), type: 'AND', payload: '((NETWORK,UDP))',                                         target: 'REJECT' },
    // ── 3) AI 服务───────────────────────────────────────────────────────────────
    { id: generateId(), type: 'RULE-SET',      payload: 'gemini',           target: presetGroupName('us', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'openai',           target: presetGroupName('us', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'claude',           target: presetGroupName('claude', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'copilot',          target: presetGroupName('us', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'google',           target: presetGroupName('us', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'github',           target: presetGroupName('claude', language) },
    // ── 4) IP 检测工具───────────────────────────────────────────────────────────
    { id: generateId(), type: 'DOMAIN-SUFFIX', payload: 'ipleak.net',       target: presetGroupName('us', language) },
    { id: generateId(), type: 'DOMAIN-SUFFIX', payload: 'dnsleaktest.com',  target: presetGroupName('us', language) },
    { id: generateId(), type: 'DOMAIN-SUFFIX', payload: 'ipapi.co',         target: presetGroupName('us', language) },
    { id: generateId(), type: 'DOMAIN',        payload: 'www.ugtop.com',    target: presetGroupName('jp', language) },
    // ── 5) 视频/社交──────────────────────────────────────────────────────────────
    { id: generateId(), type: 'RULE-SET',      payload: 'twitter',          target: presetGroupName('social', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'youtube-music',    target: presetGroupName('youtube', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'youtube',          target: presetGroupName('youtube', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'microsoft',        target: presetGroupName('youtube', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'telegram',         target: presetGroupName('youtube', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'tiktok',           target: presetGroupName('youtube', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'linkedin',         target: presetGroupName('social', language) },
    { id: generateId(), type: 'RULE-SET',      payload: 'docker',           target: presetGroupName('auto', language) },
    // ── 6) 国内直连──────────────────────────────────────────────────────────────
    { id: generateId(), type: 'GEOIP',         payload: 'CN',               target: 'DIRECT', noResolve: true },
    // ── 7) 默认兜底──────────────────────────────────────────────────────────────
    { id: generateId(), type: 'MATCH',         payload: '',                 target: presetGroupName('fallback', language) },
  ]
}

function createDefaultGlobalSettings(): ClashGlobalSettings {
  return JSON.parse(JSON.stringify(DEFAULT_GLOBAL_SETTINGS)) as ClashGlobalSettings
}

function mergeGlobalSettings(persisted?: Partial<ClashGlobalSettings>): ClashGlobalSettings {
  const defaults = createDefaultGlobalSettings()
  if (!persisted) return defaults

  return {
    ...defaults,
    ...persisted,
    'external-controller-cors': persisted['external-controller-cors']
      ? {
          ...defaults['external-controller-cors'],
          ...persisted['external-controller-cors'],
          'allow-origins': persisted['external-controller-cors']['allow-origins']
            ?? defaults['external-controller-cors']?.['allow-origins']
            ?? ['*'],
        }
      : defaults['external-controller-cors'],
    'geox-url': persisted['geox-url']
      ? { ...defaults['geox-url'], ...persisted['geox-url'] }
      : defaults['geox-url'],
    profile: persisted.profile
      ? { ...defaults.profile, ...persisted.profile }
      : defaults.profile,
    tun: persisted.tun
      ? { ...defaults.tun, ...persisted.tun }
      : defaults.tun,
    sniffer: persisted.sniffer
      ? {
          ...defaults.sniffer,
          ...persisted.sniffer,
          sniff: persisted.sniffer.sniff
            ? {
                ...defaults.sniffer!.sniff,
                ...persisted.sniffer.sniff,
              }
            : defaults.sniffer!.sniff,
        }
      : defaults.sniffer,
    dns: persisted.dns
      ? {
          ...defaults.dns,
          ...persisted.dns,
          'fallback-filter': persisted.dns['fallback-filter']
            ? {
                ...defaults.dns['fallback-filter'],
                ...persisted.dns['fallback-filter'],
              }
            : defaults.dns['fallback-filter'],
          'nameserver-policy': persisted.dns['nameserver-policy']
            ? {
                ...defaults.dns['nameserver-policy'],
                ...persisted.dns['nameserver-policy'],
              }
            : defaults.dns['nameserver-policy'],
        }
      : defaults.dns,
  }
}

export const useAppStore = create<AppState>()(
  persist(
    immer((set, get) => ({
    sources: [],
    manualProxies: [],
    globalSettings: createDefaultGlobalSettings(),

    proxyGroups: createDefaultProxyGroups(),

    // Loyalsoldier presets first, then blackmatrix7 presets
    ruleProviders: [
      ...PRESET_RULE_PROVIDERS.map((p) => ({ ...p })),
      ...BLACKMATRIX7_RULE_PROVIDERS.map((p) => ({ ...p })),
    ],

    // Unified ordered rule list — includes both manual rules and inline RULE-SET references.
    // RULE-SET entries are only emitted when their provider is enabled.
    rules: createDefaultRules(),

    activeTab: 'sources',
    showChainExample: false,

    // ── Sources ──────────────────────────────────────────────────────────────

    addSource: (source) => {
      const id = generateId()
      set((state) => {
        state.sources.push({ ...source, id, status: 'idle', proxies: [] })
      })
      return id
    },

    updateSource: (id, updates) => {
      set((state) => {
        const idx = state.sources.findIndex((s) => s.id === id)
        if (idx !== -1) Object.assign(state.sources[idx], updates)
      })
    },

    removeSource: (id) => {
      set((state) => { state.sources = state.sources.filter((s) => s.id !== id) })
    },

    // ── Manual Proxies ────────────────────────────────────────────────────────

    addManualProxy: (proxy) => {
      set((state) => { state.manualProxies.unshift(proxy) })
    },

    updateManualProxy: (index, updates) => {
      set((state) => {
        if (!state.manualProxies[index]) return
        const oldName = state.manualProxies[index].name
        Object.assign(state.manualProxies[index], updates)
        const newName = state.manualProxies[index].name
        if (updates.name && oldName !== newName) {
          for (const g of state.proxyGroups) {
            g.proxies = g.proxies.map((p) => (p === oldName ? newName : p))
          }
        }
      })
    },

    removeManualProxy: (index) => {
      set((state) => { state.manualProxies.splice(index, 1) })
    },

    reorderManualProxies: (oldIndex, newIndex) => {
      set((state) => {
        const [item] = state.manualProxies.splice(oldIndex, 1)
        state.manualProxies.splice(newIndex, 0, item)
      })
    },

    // ── ProxyGroups ───────────────────────────────────────────────────────────

    addProxyGroup: (group) => {
      const id = generateId()
      set((state) => { state.proxyGroups.push({ ...group, id }) })
      return id
    },

    updateProxyGroup: (id, updates) => {
      set((state) => {
        const idx = state.proxyGroups.findIndex((g) => g.id === id)
        if (idx === -1) return
        const oldName = state.proxyGroups[idx].name
        Object.assign(state.proxyGroups[idx], updates)
        const newName = state.proxyGroups[idx].name
        // 名称变更时级联更新所有引用
        if (updates.name && oldName !== newName) {
          for (const g of state.proxyGroups) {
            g.proxies = g.proxies.map((p) => (p === oldName ? newName : p))
          }
          for (const r of state.rules) {
            if (r.target === oldName) r.target = newName
          }
          for (const rp of state.ruleProviders) {
            if (rp.target === oldName) rp.target = newName
          }
        }
      })
    },

    removeProxyGroup: (id) => {
      set((state) => {
        const removed = state.proxyGroups.find((g) => g.id === id)
        state.proxyGroups = state.proxyGroups.filter((g) => g.id !== id)
        if (removed) {
          // 从其他代理组的成员列表中删除
          for (const g of state.proxyGroups) {
            g.proxies = g.proxies.filter((p) => p !== removed.name)
          }
          // 规则和规则集中若目标指向此组，重置为 DIRECT
          for (const r of state.rules) {
            if (r.target === removed.name) r.target = 'DIRECT'
          }
          for (const rp of state.ruleProviders) {
            if (rp.target === removed.name) rp.target = 'DIRECT'
          }
        }
      })
    },

    addProxyToGroup: (groupId, proxyName) => {
      set((state) => {
        const group = state.proxyGroups.find((g) => g.id === groupId)
        if (group && !group.proxies.includes(proxyName)) group.proxies.push(proxyName)
      })
    },

    removeProxyFromGroup: (groupId, proxyName) => {
      set((state) => {
        const group = state.proxyGroups.find((g) => g.id === groupId)
        if (group) group.proxies = group.proxies.filter((p) => p !== proxyName)
      })
    },

    reorderProxiesInGroup: (groupId, oldIndex, newIndex) => {
      set((state) => {
        const group = state.proxyGroups.find((g) => g.id === groupId)
        if (group) {
          const [item] = group.proxies.splice(oldIndex, 1)
          group.proxies.splice(newIndex, 0, item)
        }
      })
    },

    reorderProxyGroups: (oldIndex, newIndex) => {
      set((state) => {
        const [item] = state.proxyGroups.splice(oldIndex, 1)
        state.proxyGroups.splice(newIndex, 0, item)
      })
    },

    // ── Rule Providers (CRUD) ─────────────────────────────────────────────────

    addRuleProvider: (provider) => {
      set((state) => {
        state.ruleProviders.push({ ...provider, id: generateId() })
        // Insert a RULE-SET rule before the final MATCH rule
        const noResolve = provider.noResolve || provider.behavior === 'ipcidr'
        const ruleSetEntry = {
          id: generateId(),
          type: 'RULE-SET' as const,
          payload: provider.name,
          target: provider.target,
          noResolve,
        }
        const matchIdx = state.rules.findIndex((r) => r.type === 'MATCH')
        if (matchIdx !== -1) {
          state.rules.splice(matchIdx, 0, ruleSetEntry)
        } else {
          state.rules.push(ruleSetEntry)
        }
      })
    },

    updateRuleProvider: (id, updates) => {
      set((state) => {
        const idx = state.ruleProviders.findIndex((p) => p.id === id)
        if (idx === -1) return
        const providerName = state.ruleProviders[idx].name
        Object.assign(state.ruleProviders[idx], updates)
        // Sync target / noResolve changes to corresponding RULE-SET rules in the rules array
        for (const rule of state.rules) {
          if (rule.type === 'RULE-SET' && rule.payload === providerName) {
            if (updates.target !== undefined) rule.target = updates.target
            if (updates.noResolve !== undefined) rule.noResolve = updates.noResolve
          }
        }
      })
    },

    removeRuleProvider: (id) => {
      set((state) => {
        const removed = state.ruleProviders.find((p) => p.id === id)
        state.ruleProviders = state.ruleProviders.filter((p) => p.id !== id)
        if (removed) {
          state.rules = state.rules.filter(
            (r) => !(r.type === 'RULE-SET' && r.payload === removed.name)
          )
        }
      })
    },

    reorderRuleProviders: (oldIndex, newIndex) => {
      set((state) => {
        const [item] = state.ruleProviders.splice(oldIndex, 1)
        state.ruleProviders.splice(newIndex, 0, item)
      })
    },

    // ── Rules ────────────────────────────────────────────────────────────────

    addRule: (rule) => {
      set((state) => { state.rules.push({ ...rule, id: generateId() }) })
    },

    removeRule: (id) => {
      set((state) => { state.rules = state.rules.filter((r) => r.id !== id) })
    },

    reorderRules: (oldIndex, newIndex) => {
      set((state) => {
        const [item] = state.rules.splice(oldIndex, 1)
        state.rules.splice(newIndex, 0, item)
      })
    },

    setActiveTab: (tab) => {
      set((state) => { state.activeTab = tab })
    },

    setShowChainExample: (v) => {
      set((state) => { state.showChainExample = v })
    },

    updateProxy: (sourceId, proxyIndex, updates) => {
      set((state) => {
        const src = state.sources.find((s) => s.id === sourceId)
        if (!src || !src.proxies[proxyIndex]) return
        const oldName = src.proxies[proxyIndex].name
        Object.assign(src.proxies[proxyIndex], updates)
        const newName = src.proxies[proxyIndex].name
        if (updates.name && oldName !== newName) {
          // Sync to source's imported groups
          for (const g of src.importedGroups ?? []) {
            g.proxies = g.proxies.map((p) => (p === oldName ? newName : p))
          }
          // Sync to store proxy groups
          for (const g of state.proxyGroups) {
            g.proxies = g.proxies.map((p) => (p === oldName ? newName : p))
          }
        }
      })
    },

    applyPrefixToSource: (sourceId, prefix) => {
      set((state) => {
        const src = state.sources.find((s) => s.id === sourceId)
        if (!src || !prefix) return

        // ── 1. Node rename map ────────────────────────────────────────────────
        const nodeRename = new Map<string, string>()
        for (const proxy of src.proxies) {
          if (!proxy.name.startsWith(prefix))
            nodeRename.set(proxy.name, `${prefix}${proxy.name}`)
        }
        // Apply to source proxies
        for (const proxy of src.proxies) {
          const next = nodeRename.get(proxy.name)
          if (next) proxy.name = next
        }

        // ── 2. Group rename map (importedGroups of this source) ───────────────
        const groupRename = new Map<string, string>()
        for (const g of src.importedGroups ?? []) {
          if (!g.name.startsWith(prefix))
            groupRename.set(g.name, `${prefix}${g.name}`)
        }
        // Apply name rename to importedGroups themselves
        for (const g of src.importedGroups ?? []) {
          const next = groupRename.get(g.name)
          if (next) g.name = next
          // Also update member node references
          g.proxies = g.proxies.map((p) => nodeRename.get(p) ?? p)
        }

        // ── 3. Sync node renames into store proxyGroups ───────────────────────
        for (const g of state.proxyGroups) {
          // Rename member node references
          g.proxies = g.proxies.map((p) => nodeRename.get(p) ?? p)
          // Rename the group itself if it was imported from this source
          const nextName = groupRename.get(g.name)
          if (nextName) g.name = nextName
          // Also update any inter-group references (groups referencing other groups by name)
          g.proxies = g.proxies.map((p) => groupRename.get(p) ?? p)
        }
      })
    },

    importSourceGroup: (sourceId, groupName) => {
      set((state) => {
        const src = state.sources.find((s) => s.id === sourceId)
        const group = src?.importedGroups?.find((g) => g.name === groupName)
        if (!group) return
        // Skip if name already exists in store
        if (state.proxyGroups.some((g) => g.name === group.name)) return
        state.proxyGroups.push({
          id: generateId(),
          name: group.name,
          type: (group.type as ProxyGroup['type']) || 'select',
          proxies: [...group.proxies],
          ...(group.use && group.use.length > 0 ? { use: group.use } : {}),
          ...(group.timeout !== undefined ? { timeout: group.timeout } : {}),
          url: group.url,
          interval: group.interval,
          tolerance: group.tolerance,
          ...(group.lazy !== undefined ? { lazy: group.lazy } : {}),
          ...(group.hidden ? { hidden: group.hidden } : {}),
          ...(group.filter ? { filter: group.filter } : {}),
          ...(group['exclude-filter'] ? { 'exclude-filter': group['exclude-filter'] } : {}),
          ...(group.strategy ? { strategy: group.strategy } : {}),
        })
      })
    },

    updateGlobalSettings: (updates) => {
      set((state) => { Object.assign(state.globalSettings, updates) })
    },

    updateDnsSettings: (updates) => {
      set((state) => { Object.assign(state.globalSettings.dns, updates) })
    },

    updateDnsFallbackFilter: (updates) => {
      set((state) => {
        if (!state.globalSettings.dns['fallback-filter']) {
          state.globalSettings.dns['fallback-filter'] = {} as DnsFallbackFilter
        }
        Object.assign(state.globalSettings.dns['fallback-filter']!, updates)
      })
    },

    getAllProxies: () => [
      ...get().sources.flatMap((s) => s.proxies),
      ...get().manualProxies,
    ],

    getAllProxyNames: () => {
      const proxies = get().sources.flatMap((s) => s.proxies.map((p) => p.name))
      const manualNames = get().manualProxies.map((p) => p.name)
      const groupNames = get().proxyGroups.map((g) => g.name)
      return [...new Set([...proxies, ...manualNames, ...groupNames, 'DIRECT', 'REJECT'])]
    },

    importFullConfig: (config) => {
      set((state) => {
        // 1. Proxies → new source
        if (Array.isArray(config.proxies) && config.proxies.length > 0) {
          state.sources.push({
            id: generateId(),
            name: IMPORTED_CONFIG_NAME[getInitialLanguage()],
            url: '',
            status: 'success',
            proxies: config.proxies,
          })
        }

        // 2. Proxy groups
        if (Array.isArray(config['proxy-groups'])) {
          state.proxyGroups = config['proxy-groups'].map((g) => ({
            id: generateId(),
            name: g.name,
            type: (g.type as ProxyGroup['type']) || 'select',
            proxies: Array.isArray(g.proxies) ? g.proxies : [],
            ...(Array.isArray(g.use) && g.use.length > 0 ? { use: g.use } : {}),
            ...(g.timeout !== undefined ? { timeout: g.timeout } : {}),
            url: g.url,
            interval: g.interval,
            tolerance: g.tolerance,
            lazy: g.lazy,
            hidden: (g as { hidden?: boolean }).hidden,
            ...(g.filter ? { filter: g.filter } : {}),
            ...((g as { 'exclude-filter'?: string })['exclude-filter'] ? { 'exclude-filter': (g as { 'exclude-filter'?: string })['exclude-filter'] } : {}),
            ...(g.strategy ? { strategy: g.strategy } : {}),
          }))
        }

        // 3. Rule providers
        if (config['rule-providers'] && typeof config['rule-providers'] === 'object') {
          state.ruleProviders = Object.entries(config['rule-providers']).map(([name, rp]: [string, { type: string; behavior: string; url?: string; path?: string; interval?: number }]) => ({
            id: generateId(),
            name,
            type: (rp.type as RuleProvider['type']) || 'http',
            behavior: (rp.behavior as RuleProvider['behavior']) || 'domain',
            url: rp.url,
            path: rp.path ?? `./ruleset/${name}.yaml`,
            interval: rp.interval ?? 86400,
            target: 'DIRECT',
            enabled: true,
          }))
        }

        // 4. Rules — process in order; RULE-SET entries update provider targets AND are stored
        //    as inline RULE-SET rules to preserve their position in the output.
        if (Array.isArray(config.rules)) {
          const rules: Rule[] = []
          for (const ruleStr of config.rules) {
            const parts = (ruleStr as string).split(',').map((s) => s.trim())
            const type = parts[0]
            if (type === 'RULE-SET') {
              const providerName = parts[1]
              const target = parts[2] || 'DIRECT'
              const noResolve = parts[3] === 'no-resolve'
              const rp = state.ruleProviders.find((p) => p.name === providerName)
              if (rp) {
                rp.target = target
                if (noResolve) rp.noResolve = true
              }
              rules.push({ id: generateId(), type: 'RULE-SET', payload: providerName, target, noResolve })
            } else if (type === 'MATCH') {
              rules.push({ id: generateId(), type: 'MATCH', payload: '', target: parts[1] || 'DIRECT' })
            } else {
              const noResolve = parts[parts.length - 1] === 'no-resolve'
              const targetIndex = noResolve ? parts.length - 2 : parts.length - 1
              rules.push({
                id: generateId(),
                type,
                payload: parts.slice(1, targetIndex).join(','),
                target: parts[targetIndex] || 'DIRECT',
                ...(noResolve ? { noResolve: true } : {}),
              })
            }
          }
          state.rules = rules
        }

        // 5. Global settings — only override fields present in the config
        if (config['mixed-port'] !== undefined) state.globalSettings['mixed-port'] = config['mixed-port']
        if (config['redir-port'] !== undefined) state.globalSettings['redir-port'] = config['redir-port']
        if (config['allow-lan'] !== undefined) state.globalSettings['allow-lan'] = config['allow-lan']
        if (config['bind-address']) state.globalSettings['bind-address'] = config['bind-address']
        if (config.mode) state.globalSettings.mode = config.mode
        if (config['log-level']) state.globalSettings['log-level'] = config['log-level']
        if (config['external-controller']) state.globalSettings['external-controller'] = config['external-controller']
        if (config['external-controller-cors']) state.globalSettings['external-controller-cors'] = config['external-controller-cors']
        if (config.secret !== undefined) state.globalSettings.secret = config.secret
        if (config['external-ui'] !== undefined) state.globalSettings['external-ui'] = config['external-ui']
        if (config['external-ui-name'] !== undefined) state.globalSettings['external-ui-name'] = config['external-ui-name']
        if (config['external-ui-url'] !== undefined) state.globalSettings['external-ui-url'] = config['external-ui-url']
        if (config['tcp-concurrent'] !== undefined) state.globalSettings['tcp-concurrent'] = config['tcp-concurrent']
        if (config['unified-delay'] !== undefined) state.globalSettings['unified-delay'] = config['unified-delay']
        if (config['udp-timeout'] !== undefined) state.globalSettings['udp-timeout'] = config['udp-timeout']
        // handle both new field name and legacy tcp-keep-alive-interval
        if (config['keep-alive-interval'] !== undefined) state.globalSettings['keep-alive-interval'] = config['keep-alive-interval']
        else if (config['tcp-keep-alive-interval'] !== undefined) state.globalSettings['keep-alive-interval'] = config['tcp-keep-alive-interval']
        if (config.ipv6 !== undefined) state.globalSettings.ipv6 = config.ipv6
        if (config.udp !== undefined) state.globalSettings.udp = config.udp
        if (config['find-process-mode']) state.globalSettings['find-process-mode'] = config['find-process-mode']
        if (config['geodata-mode'] !== undefined) state.globalSettings['geodata-mode'] = config['geodata-mode']
        if (config['geo-auto-update'] !== undefined) state.globalSettings['geo-auto-update'] = config['geo-auto-update']
        if (config['geo-update-interval'] !== undefined) state.globalSettings['geo-update-interval'] = config['geo-update-interval']
        if (config['geox-url']) state.globalSettings['geox-url'] = config['geox-url']
        if (config['global-client-fingerprint']) state.globalSettings['global-client-fingerprint'] = config['global-client-fingerprint']
        if (config.profile) state.globalSettings.profile = config.profile
        if (config['prefer-h3'] !== undefined) state.globalSettings['prefer-h3'] = config['prefer-h3']
        if (config.tun) state.globalSettings.tun = config.tun
        if (config.hosts) state.globalSettings.hosts = config.hosts
        if (config.sniffer) state.globalSettings.sniffer = config.sniffer
        if (config.dns) Object.assign(state.globalSettings.dns, config.dns)
        if (config['routing-mark'] !== undefined) state.globalSettings['routing-mark'] = config['routing-mark']
      })
    },

    resetSources: () => set((state) => { state.sources = [] }),

    resetManualProxies: () => set((state) => { state.manualProxies = [] }),

    resetProxyGroups: () => set((state) => {
      state.proxyGroups = createDefaultProxyGroups()
    }),

    resetRules: () => set((state) => {
      state.rules = createDefaultRules()
    }),

    syncPresetLanguage: (language) => set((state) => {
      syncPresetReferences(state.proxyGroups, state.rules, state.ruleProviders, language)
    }),
  })),
  {
    name: 'clash-node-editor-v1',
    storage: createJSONStorage(() => expiringLocalStorage),
    merge: (persistedState, currentState) => {
      const persisted = persistedState as Partial<AppState> | undefined
      if (!persisted) return currentState

      return {
        ...currentState,
        ...persisted,
        globalSettings: mergeGlobalSettings(persisted.globalSettings),
      }
    },
    // Only persist metadata, not the fetched proxy data (can be large).
    // Sources are restored with status='idle' so users know to refresh.
    partialize: (state) => ({
      sources: state.sources.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        userAgent: s.userAgent,
        status: 'idle' as const,
        proxies: [],
        importedGroups: [],
      })),
      manualProxies:  state.manualProxies,
      proxyGroups:    state.proxyGroups,
      ruleProviders:  state.ruleProviders,
      rules:          state.rules,
      globalSettings: state.globalSettings,
      activeTab:      state.activeTab,
    }),
  }
)
)
