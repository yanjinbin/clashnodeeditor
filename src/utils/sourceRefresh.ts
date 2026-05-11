export interface RefreshableSource {
  id: string
  url: string
  userAgent?: string
}

export interface RefreshProgress {
  done: number
  total: number
}

export interface RefreshRemoteSourcesOptions<TSource extends RefreshableSource> {
  sources: TSource[]
  loadSource: (source: TSource) => Promise<void>
  onProgress?: (progress: RefreshProgress) => void
}

export function getRefreshableSources<TSource extends RefreshableSource>(sources: TSource[]) {
  return sources.filter((source) => source.url && !source.url.startsWith('file://'))
}

export async function refreshRemoteSources<TSource extends RefreshableSource>({
  sources,
  loadSource,
  onProgress,
}: RefreshRemoteSourcesOptions<TSource>): Promise<RefreshProgress> {
  const activeSources = getRefreshableSources(sources)
  let done = 0
  const total = activeSources.length
  onProgress?.({ done, total })

  await Promise.allSettled(
    activeSources.map(async (source) => {
      await loadSource(source)
      done += 1
      onProgress?.({ done, total })
    })
  )

  return { done, total }
}
