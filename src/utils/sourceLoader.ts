import type { SourceConfig } from '../types/clash'
import { fetchAndParseYaml } from './parseYaml'

export type SourceUpdater = (id: string, updates: Partial<SourceConfig>) => void

export async function loadRemoteSource(source: Pick<SourceConfig, 'id' | 'url' | 'userAgent'>, updateSource: SourceUpdater) {
  updateSource(source.id, { status: 'loading', error: undefined })
  try {
    const { proxies, groups, subscriptionInfo } = await fetchAndParseYaml(source.url, source.userAgent)
    updateSource(source.id, { status: 'success', proxies, importedGroups: groups, subscriptionInfo })
  } catch (err) {
    updateSource(source.id, { status: 'error', error: (err as Error).message, proxies: [] })
  }
}
