import { useState, useRef, useMemo } from 'react'
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Loader, Globe, Upload, AlertTriangle, ChevronDown, ShieldCheck } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { fetchAndParseYaml, parseYamlText } from '../utils/parseYaml'
import EmojiPicker from './EmojiPicker'
import { PRESET_USER_AGENTS, DEFAULT_USER_AGENT } from '../types/clash'

export default function SourceManager() {
  const { sources, addSource, updateSource, removeSource } = useAppStore()
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newUa, setNewUa] = useState(DEFAULT_USER_AGENT)
  const [customUa, setCustomUa] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const duplicates = useMemo(() => {
    const nameMap = new Map<string, string[]>()
    for (const source of sources) {
      for (const proxy of source.proxies) {
        const existing = nameMap.get(proxy.name) ?? []
        nameMap.set(proxy.name, [...existing, source.name])
      }
    }
    return Array.from(nameMap.entries())
      .filter(([, srcs]) => srcs.length > 1)
      .map(([name, srcs]) => ({ name, sources: [...new Set(srcs)] }))
  }, [sources])

  const resolvedUa = newUa === '__custom__' ? customUa : newUa

  const handleAddSource = () => {
    if (!newUrl.trim()) return
    let name = newName.trim()
    try { name = name || new URL(newUrl).hostname } catch { name = name || newUrl }
    const id = addSource({ name, url: newUrl.trim(), userAgent: resolvedUa || DEFAULT_USER_AGENT })
    setNewUrl('')
    setNewName('')
    loadSource(id, newUrl.trim(), resolvedUa || DEFAULT_USER_AGENT)
  }

  const loadSource = async (id: string, url: string, ua?: string) => {
    updateSource(id, { status: 'loading', error: undefined })
    try {
      const proxies = await fetchAndParseYaml(url, ua)
      updateSource(id, { status: 'success', proxies })
    } catch (err) {
      updateSource(id, { status: 'error', error: (err as Error).message, proxies: [] })
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const name = file.name.replace(/\.(yaml|yml)$/, '')
      const id = addSource({ name, url: `file://${file.name}` })
      try {
        const proxies = parseYamlText(text)
        updateSource(id, { status: 'success', proxies })
      } catch (err) {
        updateSource(id, { status: 'error', error: (err as Error).message, proxies: [] })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
          机场订阅源
        </h2>
        <div className="flex items-start gap-2 mb-3 px-2.5 py-2 rounded-lg bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-800">
          <ShieldCheck size={13} className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
            订阅请求通过部署在你自己 Vercel 账号下的 Edge Function 转发，不经过任何第三方服务。
            代码完全开源可审计：
            <a
              href="https://github.com/yanjinbin/clashnodeeditor/blob/main/api/proxy.ts"
              target="_blank"
              rel="noopener noreferrer"
              className="underline ml-1"
            >
              api/proxy.ts
            </a>
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              ref={nameInputRef}
              type="text"
              placeholder="订阅名称（可选）"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <EmojiPicker
              inputRef={nameInputRef}
              value={newName}
              onChange={setNewName}
              onSelect={(e) => setNewName((n) => n + e)}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="订阅 URL"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddSource}
              disabled={!newUrl.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* User-Agent selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0">User-Agent</span>
            <div className="relative flex-1">
              <select
                value={newUa}
                onChange={(e) => setNewUa(e.target.value)}
                className="w-full text-xs pl-2.5 pr-7 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
              >
                {PRESET_USER_AGENTS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
          </div>
          {newUa === '__custom__' ? (
            <input
              type="text"
              placeholder="如：clash-verge/v2.3.0 或 mihomo/1.20.0"
              value={customUa}
              onChange={(e) => setCustomUa(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          ) : (
            <p className="text-xs text-gray-400">
              机场通过 UA 识别客户端并返回对应节点。预设版本号随客户端发版更新，也可选「自定义」手动填写最新版本。
              <a
                href="https://github.com/clash-verge-rev/clash-verge-rev/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-blue-400 hover:underline"
              >
                查看最新版本 →
              </a>
            </p>
          )}

          <label className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-gray-500 dark:text-gray-400">
            <Upload size={14} />
            <span>上传本地 YAML 文件</span>
            <input type="file" accept=".yaml,.yml" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {duplicates.length > 0 && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  检测到 {duplicates.length} 个重复节点名
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  导出时后加载的节点会覆盖同名节点，建议清理：
                </p>
                <ul className="mt-1 space-y-0.5">
                  {duplicates.slice(0, 5).map(({ name, sources: srcs }) => (
                    <li key={name} className="text-xs text-amber-600 dark:text-amber-500 truncate">
                      <span className="font-mono font-medium">{name}</span>
                      <span className="text-amber-400"> — 出现于: {srcs.join(', ')}</span>
                    </li>
                  ))}
                  {duplicates.length > 5 && (
                    <li className="text-xs text-amber-500">…还有 {duplicates.length - 5} 个</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {sources.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Globe size={32} className="mx-auto mb-2 opacity-30" />
            <p>添加机场订阅源开始使用</p>
          </div>
        )}

        {sources.map((source) => (
          <div
            key={source.id}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <StatusIcon status={source.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {source.name}
                </p>
                <p className="text-xs text-gray-400 truncate">{source.url}</p>
                {source.userAgent && (
                  <p className="text-xs text-blue-400 truncate font-mono">UA: {source.userAgent}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {source.status === 'success' && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                    {source.proxies.length} 个节点
                  </span>
                )}
                <button
                  onClick={() => loadSource(source.id, source.url, source.userAgent)}
                  disabled={source.status === 'loading'}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <RefreshCw size={13} className={source.status === 'loading' ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => removeSource(source.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {source.error && (
              <div className="px-3 pb-2 text-xs text-red-500">{source.error}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'loading':
      return <Loader size={14} className="text-blue-500 animate-spin" />
    case 'success':
      return <CheckCircle size={14} className="text-green-500" />
    case 'error':
      return <XCircle size={14} className="text-red-500" />
    default:
      return <div className="w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-600" />
  }
}
