import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { SourceConfig, ProxyGroup, RuleProvider, Rule, Proxy, ClashGlobalSettings, DnsConfig, DnsFallbackFilter } from '../types/clash'
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
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export const useAppStore = create<AppState>()(
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

    // Non-RULE-SET rules; RULE-SET lines are auto-generated from enabled ruleProviders
    rules: [
      { id: generateId(), type: 'DOMAIN',        payload: 'clash.razord.top',  target: 'DIRECT' },
      { id: generateId(), type: 'DOMAIN',        payload: 'yacd.haishan.me',   target: 'DIRECT' },
      { id: generateId(), type: 'DOMAIN-SUFFIX', payload: 'local',             target: 'DIRECT' },
      { id: generateId(), type: 'IP-CIDR',       payload: '127.0.0.0/8',       target: 'DIRECT' },
      { id: generateId(), type: 'IP-CIDR',       payload: '172.16.0.0/12',     target: 'DIRECT' },
      { id: generateId(), type: 'IP-CIDR',       payload: '192.168.0.0/16',    target: 'DIRECT' },
      { id: generateId(), type: 'IP-CIDR',       payload: '10.0.0.0/8',        target: 'DIRECT' },
      { id: generateId(), type: 'GEOIP',         payload: 'LAN', target: 'DIRECT', noResolve: true },
      { id: generateId(), type: 'GEOIP',         payload: 'CN',  target: 'DIRECT', noResolve: true },
      { id: generateId(), type: 'MATCH',         payload: '',    target: '♻️ 自动选择' },
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

    // ── Rule Providers (CRUD) ─────────────────────────────────────────────────

    addRuleProvider: (provider) => {
      set((state) => {
        state.ruleProviders.push({ ...provider, id: generateId() })
      })
    },

    updateRuleProvider: (id, updates) => {
      set((state) => {
        const idx = state.ruleProviders.findIndex((p) => p.id === id)
        if (idx !== -1) Object.assign(state.ruleProviders[idx], updates)
      })
    },

    removeRuleProvider: (id) => {
      set((state) => {
        state.ruleProviders = state.ruleProviders.filter((p) => p.id !== id)
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
  }))
)
