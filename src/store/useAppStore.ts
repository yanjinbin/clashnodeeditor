import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SourceConfig, ProxyGroup, RuleProvider, Rule, Proxy, ClashConfig, ClashGlobalSettings, DnsConfig, DnsFallbackFilter } from '../types/clash'
import { PRESET_RULE_PROVIDERS, BLACKMATRIX7_RULE_PROVIDERS, DEFAULT_GLOBAL_SETTINGS } from '../types/clash'

interface AppState {
  sources: SourceConfig[]
  proxyGroups: ProxyGroup[]
  /** All rule providers: preset + user-added, ordered, each with enabled/target */
  ruleProviders: RuleProvider[]
  /** Non-RULE-SET routing rules (DOMAIN, GEOIP, MATCH, etc.) */
  rules: Rule[]
  activeTab: 'sources' | 'groups' | 'rules' | 'preview'
  globalSettings: ClashGlobalSettings

  // Source actions
  addSource: (source: Omit<SourceConfig, 'id' | 'status' | 'proxies'>) => string
  updateSource: (id: string, updates: Partial<SourceConfig>) => void
  removeSource: (id: string) => void

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
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export const useAppStore = create<AppState>()(
  persist(
    immer((set, get) => ({
    sources: [],
    globalSettings: JSON.parse(JSON.stringify(DEFAULT_GLOBAL_SETTINGS)) as ClashGlobalSettings,

    proxyGroups: [
      {
        id: generateId(),
        name: 'PROXY',
        type: 'select',
        proxies: [],
        url: 'http://www.gstatic.com/generate_204',
        interval: 300,
      },
      {
        id: generateId(),
        name: '♻️ 自动选择',
        type: 'url-test',
        proxies: [],
        url: 'http://www.gstatic.com/generate_204',
        interval: 300,
        tolerance: 50,
        autoAllNodes: true,
      },
    ],

    // Loyalsoldier presets first, then blackmatrix7 presets
    ruleProviders: [
      ...PRESET_RULE_PROVIDERS.map((p) => ({ ...p })),
      ...BLACKMATRIX7_RULE_PROVIDERS.map((p) => ({ ...p })),
    ],

    // Unified ordered rule list — includes both manual rules and inline RULE-SET references.
    // RULE-SET entries are only emitted when their provider is enabled.
    rules: [
      // 1) 本地 / 局域网 / 保留地址
      { id: generateId(), type: 'DOMAIN-SUFFIX', payload: 'local',          target: 'DIRECT' },
      { id: generateId(), type: 'IP-CIDR',       payload: '127.0.0.0/8',    target: 'DIRECT' },
      { id: generateId(), type: 'IP-CIDR',       payload: '10.0.0.0/8',     target: 'DIRECT' },
      { id: generateId(), type: 'IP-CIDR',       payload: '172.16.0.0/12',  target: 'DIRECT' },
      { id: generateId(), type: 'IP-CIDR',       payload: '192.168.0.0/16', target: 'DIRECT' },
      { id: generateId(), type: 'GEOIP',         payload: 'LAN',            target: 'DIRECT', noResolve: true },
      { id: generateId(), type: 'RULE-SET',      payload: 'private',        target: 'DIRECT' },
      { id: generateId(), type: 'RULE-SET',      payload: 'lancidr',        target: 'DIRECT', noResolve: true },
      // 2) 明确拦截
      { id: generateId(), type: 'RULE-SET',      payload: 'reject',         target: 'REJECT' },
      // 4) AI / 开发 / 特定服务
      { id: generateId(), type: 'RULE-SET',      payload: 'openai',         target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'claude',         target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'copilot',        target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'gemini',         target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'docker',         target: 'PROXY' },
      // 5) 社交 / 媒体
      { id: generateId(), type: 'RULE-SET',      payload: 'youtube-music',  target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'youtube',        target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'google',         target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'telegram',       target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'twitter',        target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'tiktok',         target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'linkedin',       target: 'PROXY' },
      { id: generateId(), type: 'RULE-SET',      payload: 'GoogleFCM',      target: 'PROXY' },
      // 6) 通用规则
      { id: generateId(), type: 'RULE-SET',      payload: 'direct',         target: 'DIRECT' },
      { id: generateId(), type: 'RULE-SET',      payload: 'gfw',            target: 'PROXY' },
      // 7) IP 类规则
      { id: generateId(), type: 'RULE-SET',      payload: 'telegramcidr',   target: 'PROXY',  noResolve: true },
      { id: generateId(), type: 'RULE-SET',      payload: 'cncidr',         target: 'DIRECT', noResolve: true },
      // 8) 国内兜底
      { id: generateId(), type: 'RULE-SET',      payload: 'cn',             target: 'DIRECT' },
      { id: generateId(), type: 'GEOIP',         payload: 'CN',             target: 'DIRECT', noResolve: true },
      // 9) 最终兜底
      { id: generateId(), type: 'MATCH',         payload: '',               target: '♻️ 自动选择' },
    ],

    activeTab: 'sources',

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
          url: group.url,
          interval: group.interval,
          tolerance: group.tolerance,
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
      set((state) => { Object.assign(state.globalSettings.dns['fallback-filter'], updates) })
    },

    getAllProxies: () => get().sources.flatMap((s) => s.proxies),

    getAllProxyNames: () => {
      const proxies = get().sources.flatMap((s) => s.proxies.map((p) => p.name))
      const groupNames = get().proxyGroups.map((g) => g.name)
      return [...new Set([...proxies, ...groupNames, 'DIRECT', 'REJECT'])]
    },

    importFullConfig: (config) => {
      set((state) => {
        // 1. Proxies → new source
        if (Array.isArray(config.proxies) && config.proxies.length > 0) {
          state.sources.push({
            id: generateId(),
            name: '导入的配置',
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
            url: g.url,
            interval: g.interval,
            tolerance: g.tolerance,
            lazy: g.lazy,
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
              rules.push({
                id: generateId(),
                type,
                payload: parts[1] || '',
                target: noResolve ? parts[2] || 'DIRECT' : parts[parts.length - 1] || 'DIRECT',
                ...(noResolve ? { noResolve: true } : {}),
              })
            }
          }
          state.rules = rules
        }

        // 5. Global settings — only override fields present in the config
        if (config['mixed-port'] !== undefined) state.globalSettings['mixed-port'] = config['mixed-port']
        if (config['allow-lan'] !== undefined) state.globalSettings['allow-lan'] = config['allow-lan']
        if (config['bind-address']) state.globalSettings['bind-address'] = config['bind-address']
        if (config.mode) state.globalSettings.mode = config.mode
        if (config['log-level']) state.globalSettings['log-level'] = config['log-level']
        if (config['external-controller']) state.globalSettings['external-controller'] = config['external-controller']
        if (config['tcp-concurrent'] !== undefined) state.globalSettings['tcp-concurrent'] = config['tcp-concurrent']
        if (config['unified-delay'] !== undefined) state.globalSettings['unified-delay'] = config['unified-delay']
        if (config['find-process-mode']) state.globalSettings['find-process-mode'] = config['find-process-mode']
        if (config['geodata-mode'] !== undefined) state.globalSettings['geodata-mode'] = config['geodata-mode']
        if (config['geox-url']) state.globalSettings['geox-url'] = config['geox-url']
        if (config['global-client-fingerprint']) state.globalSettings['global-client-fingerprint'] = config['global-client-fingerprint']
        if (config.sniffer) state.globalSettings.sniffer = config.sniffer
        if (config.dns) Object.assign(state.globalSettings.dns, config.dns)
      })
    },
  })),
  {
    name: 'clash-node-editor-v1',
    storage: createJSONStorage(() => localStorage),
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
      proxyGroups:    state.proxyGroups,
      ruleProviders:  state.ruleProviders,
      rules:          state.rules,
      globalSettings: state.globalSettings,
      activeTab:      state.activeTab,
    }),
  }
)
)
