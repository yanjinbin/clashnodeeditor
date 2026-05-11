import test from 'node:test'
import assert from 'node:assert/strict'
import { refreshRemoteSources } from '../src/utils/sourceRefresh.ts'

test('refreshRemoteSources refreshes only remote sources and reports progress', async () => {
  const refreshed: string[] = []
  const progress: Array<{ done: number; total: number }> = []
  const sources = [
    { id: 'remote-a', url: 'https://example.com/a.yaml', userAgent: 'ua-a' },
    { id: 'local-file', url: 'file://local.yaml' },
    { id: 'empty-url', url: '' },
    { id: 'remote-b', url: 'https://example.com/b.yaml' },
  ]

  const result = await refreshRemoteSources({
    sources,
    loadSource: async (source) => {
      refreshed.push(source.id)
    },
    onProgress: (next) => progress.push(next),
  })

  assert.deepEqual(refreshed.sort(), ['remote-a', 'remote-b'])
  assert.deepEqual(progress, [
    { done: 0, total: 2 },
    { done: 1, total: 2 },
    { done: 2, total: 2 },
  ])
  assert.deepEqual(result, { done: 2, total: 2 })
})
