import test from 'node:test'
import assert from 'node:assert/strict'
import { checkAppVersion } from '../src/utils/versionCheck.ts'

test('checkAppVersion reports updated when build time differs', async () => {
  const result = await checkAppVersion({
    currentBuildTime: '2026-05-07T00:00:00.000Z',
    fetchVersion: async () => ({ buildTime: '2026-05-07T00:01:00.000Z' }),
  })

  assert.equal(result, 'updated')
})

test('checkAppVersion reports current when build time matches', async () => {
  const result = await checkAppVersion({
    currentBuildTime: '2026-05-07T00:00:00.000Z',
    fetchVersion: async () => ({ buildTime: '2026-05-07T00:00:00.000Z' }),
  })

  assert.equal(result, 'current')
})

test('checkAppVersion reports error when version fetch fails', async () => {
  const result = await checkAppVersion({
    currentBuildTime: '2026-05-07T00:00:00.000Z',
    fetchVersion: async () => {
      throw new Error('offline')
    },
  })

  assert.equal(result, 'error')
})
