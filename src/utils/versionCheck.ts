export type VersionCheckResult = 'updated' | 'current' | 'skipped' | 'error'

export interface VersionPayload {
  buildTime?: string
}

export interface CheckAppVersionOptions {
  currentBuildTime: string
  fetchVersion: () => Promise<VersionPayload>
  skip?: boolean
}

export async function checkAppVersion({
  currentBuildTime,
  fetchVersion,
  skip = false,
}: CheckAppVersionOptions): Promise<VersionCheckResult> {
  if (skip) return 'skipped'

  try {
    const data = await fetchVersion()
    if (!data.buildTime) return 'error'
    return data.buildTime !== currentBuildTime ? 'updated' : 'current'
  } catch {
    return 'error'
  }
}
