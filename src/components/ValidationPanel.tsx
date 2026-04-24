import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface ValidationIssue {
  level: 'error' | 'warning'
  message: string
  detail?: string
}

function useValidationResults(): ValidationIssue[] {
  const { sources, proxyGroups, rules, ruleProviders } = useAppStore()
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const issues: ValidationIssue[] = []

    // All node names across all sources
    const allNodeNames = new Set(sources.flatMap((s) => s.proxies.map((p) => p.name)))
    // All proxy group names
    const allGroupNames = new Set(proxyGroups.map((g) => g.name))
    // All valid targets (nodes + groups + built-ins)
    const allValidTargets = new Set([...allNodeNames, ...allGroupNames, 'DIRECT', 'REJECT'])

    // ── 1. Orphan nodes in proxy groups ──────────────────────────────────────
    const orphanNodes = new Set<string>()
    for (const g of proxyGroups) {
      if (g.autoAllNodes) continue
      for (const p of g.proxies) {
        // A referenced name that is neither a node name nor a group name → orphan
        if (!allNodeNames.has(p) && !allGroupNames.has(p)) {
          orphanNodes.add(p)
        }
      }
    }
    if (orphanNodes.size > 0) {
      const shown = [...orphanNodes].slice(0, 5)
      const more = orphanNodes.size > 5 ? t('validation.orphanMore', { count: orphanNodes.size - 5 }) : ''
      issues.push({
        level: 'warning',
        message: t('validation.orphanNodes', { count: orphanNodes.size }),
        detail: t('validation.orphanNodesDetail', { names: shown.join(i18n.language === 'zh' ? '、' : ', '), more }),
      })
    }

    // ── 2. Empty proxy groups ─────────────────────────────────────────────────
    const emptyGroups = proxyGroups.filter((g) => !g.autoAllNodes && g.proxies.length === 0)
    if (emptyGroups.length > 0) {
      issues.push({
        level: 'warning',
        message: t('validation.emptyGroups', { count: emptyGroups.length }),
        detail: t('validation.emptyGroupsDetail', { names: emptyGroups.map((g) => g.name).join(i18n.language === 'zh' ? '、' : ', ') }),
      })
    }

    // ── 3. Circular references (DFS) ─────────────────────────────────────────
    const groupByName = new Map(proxyGroups.map((g) => [g.name, g]))
    const cycleGroups = new Set<string>()

    function hasCycle(name: string, visited: Set<string>, stack: Set<string>): boolean {
      if (stack.has(name)) return true
      if (visited.has(name)) return false
      visited.add(name)
      stack.add(name)
      const g = groupByName.get(name)
      if (g) {
        for (const member of g.proxies) {
          if (groupByName.has(member) && hasCycle(member, visited, stack)) {
            cycleGroups.add(name)
            return true
          }
        }
      }
      stack.delete(name)
      return false
    }

    const visited = new Set<string>()
    for (const g of proxyGroups) {
      hasCycle(g.name, visited, new Set())
    }
    if (cycleGroups.size > 0) {
      issues.push({
        level: 'error',
        message: t('validation.cycleGroups', { count: cycleGroups.size }),
        detail: t('validation.cycleGroupsDetail', { names: [...cycleGroups].join(i18n.language === 'zh' ? '、' : ', ') }),
      })
    }

    // ── 4. No MATCH rule ─────────────────────────────────────────────────────
    const hasMatch = rules.some((r) => r.type === 'MATCH')
    if (!hasMatch) {
      issues.push({
        level: 'warning',
        message: t('validation.noMatch'),
        detail: t('validation.noMatchDetail'),
      })
    }

    // ── 5. Invalid targets in rules ───────────────────────────────────────────
    const invalidTargets = new Set<string>()
    for (const r of rules) {
      if (r.type !== 'MATCH' && r.target && !allValidTargets.has(r.target)) {
        invalidTargets.add(r.target)
      }
    }
    for (const rp of ruleProviders) {
      if (rp.enabled && rp.target && !allValidTargets.has(rp.target)) {
        invalidTargets.add(rp.target)
      }
    }
    if (invalidTargets.size > 0) {
      issues.push({
        level: 'error',
        message: t('validation.invalidTargets', { count: invalidTargets.size }),
        detail: t('validation.invalidTargetsDetail', { names: [...invalidTargets].join(i18n.language === 'zh' ? '、' : ', ') }),
      })
    }

    // ── 6. No sources loaded ─────────────────────────────────────────────────
    const successSources = sources.filter((s) => s.status === 'success' && s.proxies.length > 0)
    if (sources.length > 0 && successSources.length === 0) {
      issues.push({
        level: 'warning',
        message: t('validation.noSources'),
        detail: t('validation.noSourcesDetail'),
      })
    }

    return issues
  }, [sources, proxyGroups, rules, ruleProviders, t, i18n.language])
}

export default function ValidationPanel() {
  const { t } = useTranslation()
  const issues = useValidationResults()
  const errorCount = issues.filter((i) => i.level === 'error').length
  const warnCount = issues.filter((i) => i.level === 'warning').length

  const allOk = issues.length === 0

  return (
    <div className="space-y-2">
      {/* Summary badge */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
        allOk
          ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400'
          : errorCount > 0
            ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-400'
            : 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400'
      }`}>
        {allOk
          ? <><CheckCircle size={13} /> {t('validation.allOk')}</>
          : <><ShieldCheck size={13} />
              {errorCount > 0 && <span>{t('validation.errors', { count: errorCount })}</span>}
              {errorCount > 0 && warnCount > 0 && <span className="mx-1">·</span>}
              {warnCount > 0 && <span>{t('validation.warnings', { count: warnCount })}</span>}
            </>
        }
      </div>

      {/* Issue list */}
      {issues.map((issue, i) => (
        <div
          key={i}
          className={`rounded-xl border px-3 py-2.5 space-y-1 ${
            issue.level === 'error'
              ? 'bg-red-50/60 dark:bg-red-900/10 border-red-200 dark:border-red-800/50'
              : 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {issue.level === 'error'
              ? <XCircle size={12} className="text-red-500 shrink-0" />
              : <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
            <span className={`text-xs font-semibold ${
              issue.level === 'error' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
            }`}>{issue.message}</span>
          </div>
          {issue.detail && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed pl-4">{issue.detail}</p>
          )}
        </div>
      ))}
    </div>
  )
}
