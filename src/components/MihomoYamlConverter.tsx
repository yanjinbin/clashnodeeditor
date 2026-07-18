import { useMemo, useRef, useState } from 'react'
import yaml from 'js-yaml'
import {
  ArrowLeftRight,
  CheckCircle2,
  Download,
  FileCode2,
  Monitor,
  Router,
  Trash2,
  Upload,
} from 'lucide-react'

type TargetEnv = 'router' | 'local'
type DetectedEnv = TargetEnv | 'unknown'
type YamlRecord = Record<string, unknown>

const ROUTER_TUN: YamlRecord = {
  enable: true,
  stack: 'mixed',
  device: 'nikki',
  'auto-route': false,
  'auto-redirect': false,
  'auto-detect-interface': false,
  'dns-hijack': ['any:53', 'tcp://any:53'],
}

const LOCAL_TUN: YamlRecord = {
  enable: true,
  stack: 'mixed',
  'auto-route': true,
  'auto-redirect': false,
  'strict-route': true,
  'auto-detect-interface': true,
  'dns-hijack': ['any:53', 'tcp://any:53'],
}

const ROUTER_SNIPPET = `find-process-mode: off

# TUN（Nikki 托管模式）
tun:
  enable: true
  stack: mixed
  device: nikki
  auto-route: false
  auto-redirect: false
  auto-detect-interface: false
  dns-hijack:
    - any:53
    - tcp://any:53`

const LOCAL_SNIPPET = `find-process-mode: strict

# TUN（本地客户端配置）
tun:
  enable: true
  stack: mixed
  auto-route: true
  auto-redirect: false
  strict-route: true
  auto-detect-interface: true
  dns-hijack:
    - any:53
    - tcp://any:53`

function isRecord(value: unknown): value is YamlRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseYamlObject(text: string): YamlRecord {
  const parsed = yaml.load(text)
  if (!isRecord(parsed)) throw new Error('YAML 顶层必须是对象。')
  return parsed
}

function detectEnvironmentFromConfig(config: YamlRecord): DetectedEnv {
  const tun = isRecord(config.tun) ? config.tun : {}
  if (config['find-process-mode'] === 'off' || tun.device === 'nikki') return 'router'
  if (
    config['find-process-mode'] === 'strict'
    || tun['auto-route'] === true
    || tun['strict-route'] === true
    || tun['auto-detect-interface'] === true
  ) return 'local'
  return 'unknown'
}

function convertConfig(config: YamlRecord, target: TargetEnv): YamlRecord {
  return {
    ...config,
    'find-process-mode': target === 'router' ? 'off' : 'strict',
    tun: target === 'router' ? { ...ROUTER_TUN } : { ...LOCAL_TUN },
  }
}

function dumpYaml(config: YamlRecord) {
  return yaml.dump(config, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
  })
}

function envLabel(env: DetectedEnv) {
  if (env === 'router') return '软路由 Nikki'
  if (env === 'local') return '本地客户端'
  return '未识别'
}

export default function MihomoYamlConverter() {
  const [sourceYaml, setSourceYaml] = useState('')
  const [resultYaml, setResultYaml] = useState('')
  const [message, setMessage] = useState('等待输入 YAML。')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const detected = useMemo<DetectedEnv>(() => {
    if (!sourceYaml.trim()) return 'unknown'
    try {
      return detectEnvironmentFromConfig(parseYamlObject(sourceYaml))
    } catch {
      return 'unknown'
    }
  }, [sourceYaml])

  const runConvert = (target: TargetEnv) => {
    setError('')
    try {
      const config = parseYamlObject(sourceYaml)
      const output = dumpYaml(convertConfig(config, target))
      setResultYaml(output)
      setMessage(`已转换为${target === 'router' ? '软路由 Nikki / OpenWrt' : '本地 Mihomo 客户端'}配置。`)
    } catch (err) {
      setError((err as Error).message)
      setMessage('转换失败。')
    }
  }

  const runAutoConvert = () => {
    setError('')
    try {
      const config = parseYamlObject(sourceYaml)
      const env = detectEnvironmentFromConfig(config)
      const target: TargetEnv = env === 'router' ? 'local' : 'router'
      const output = dumpYaml(convertConfig(config, target))
      setResultYaml(output)
      setMessage(env === 'unknown'
        ? '未识别来源环境，已默认转换为软路由 Nikki / OpenWrt 配置。'
        : `识别为${envLabel(env)}，已转换为${target === 'router' ? '软路由 Nikki / OpenWrt' : '本地 Mihomo 客户端'}配置。`)
    } catch (err) {
      setError((err as Error).message)
      setMessage('转换失败。')
    }
  }

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setSourceYaml(text)
    setResultYaml('')
    setError('')
    setMessage(`已载入 ${file.name}。`)
  }

  const downloadResult = () => {
    if (!resultYaml.trim()) return
    const blob = new Blob([resultYaml], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = detected === 'router' ? 'mihomo-local.yaml' : 'mihomo-nikki-openwrt.yaml'
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearAll = () => {
    setSourceYaml('')
    setResultYaml('')
    setError('')
    setMessage('等待输入 YAML。')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const putResultBack = () => {
    if (!resultYaml.trim()) return
    setSourceYaml(resultYaml)
    setResultYaml('')
    setError('')
    setMessage('结果已放回左侧，可继续反向转换。')
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-white dark:bg-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-5 space-y-6">
        <section className="border-b border-gray-200 dark:border-gray-800 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Clash Party</span>
            <span>·</span>
            <span>Clash Verge</span>
            <span>·</span>
            <span>Mihomo</span>
            <span>·</span>
            <span>OpenWrt Nikki</span>
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-normal text-gray-950 dark:text-gray-50">
            Mihomo YAML 本地客户端/软路由 配置差异转换
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            两类配置的大部分内容可以共用：代理节点、规则、DNS 分流、fake-ip-filter、sniffer 都应保留。真正需要切换的是运行环境相关项，尤其是 find-process-mode 与 tun。下面的工具支持上传 YAML、自动识别、互相转换和下载。
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-950 dark:text-gray-50">核心差异展示</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">只改运行环境，不动业务规则</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th className="w-28 px-4 py-3">项目</th>
                  <th className="px-4 py-3">软路由 Nikki / OpenWrt</th>
                  <th className="px-4 py-3">本地 Mihomo 客户端</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                <DiffRow label="典型客户端" router="OpenWrt LuCI Nikki 插件，Mihomo 由路由器托管。" local="Clash Party、Clash Verge、Mihomo Party、Clash Verge Rev 等本机客户端。" />
                <DiffRow label="进程识别" router="find-process-mode: off" local="find-process-mode: strict" mono />
                <DiffRow label="TUN 设备" router="device: nikki" local="不指定 device，由本地客户端/系统创建。" />
                <DiffRow label="路由接管" router={'auto-route: false\nauto-redirect: false\nauto-detect-interface: false'} local={'auto-route: true\nauto-redirect: false\nstrict-route: true\nauto-detect-interface: true'} mono />
                <DiffRow label="原因" router="Nikki 插件接管 OpenWrt 路由和 nftables 规则，Mihomo 只负责内核代理能力。" local="本地客户端需要自己接管系统路由、DNS 劫持和默认出口检测。" />
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-950 dark:text-gray-50">上传、互转、下载</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">浏览器本地处理，不上传到服务器</p>
            </div>
            <StatusBadge detected={detected} message={message} error={error} />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/60">
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml,text/yaml,text/plain"
              className="hidden"
              onChange={(event) => handleUpload(event.target.files?.[0])}
            />
            <ToolbarButton onClick={() => fileInputRef.current?.click()} icon={<Upload size={14} />} label="上传 YAML" />
            <ToolbarButton onClick={() => runConvert('router')} icon={<Router size={14} />} label="转为软路由 Nikki" />
            <ToolbarButton onClick={() => runConvert('local')} icon={<Monitor size={14} />} label="转为本地客户端" />
            <ToolbarButton onClick={runAutoConvert} icon={<ArrowLeftRight size={14} />} label="自动判断并转换" emphasis />
            <ToolbarButton onClick={putResultBack} icon={<FileCode2 size={14} />} label="结果放回左侧" disabled={!resultYaml.trim()} />
            <ToolbarButton onClick={downloadResult} icon={<Download size={14} />} label="下载结果" disabled={!resultYaml.trim()} />
            <ToolbarButton onClick={clearAll} icon={<Trash2 size={14} />} label="清空" danger />
          </div>

          <div className="grid min-h-[480px] grid-cols-1 gap-4 lg:grid-cols-2">
            <YamlPane
              label="源 YAML"
              badge={envLabel(detected)}
              value={sourceYaml}
              onChange={setSourceYaml}
              placeholder="上传 .yaml/.yml 文件，或把本地客户端 / 软路由 Nikki 的 config.yaml 粘贴到这里。"
            />
            <YamlPane
              label="转换结果"
              badge={resultYaml ? '已生成' : '尚未转换'}
              value={resultYaml}
              onChange={setResultYaml}
              placeholder="点击转换后生成结果。"
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoBlock title="保留内容" text="代理节点、proxy-groups、rules、rule-providers、DNS 策略、fake-ip-filter、sniffer 和外部控制配置默认原样保留。" />
          <InfoBlock title="修改内容" text="转换器会替换 tun 顶层块，并把 find-process-mode 改成目标环境需要的值。" />
          <InfoBlock title="使用建议" text="转换后先保存为新文件，不要覆盖原始 YAML。上传到 Nikki 后按页面提示选择、重载、启动，再去 Dashboard 看日志。" />
        </section>

        <section className="space-y-3 pb-8">
          <div>
            <h3 className="text-base font-bold text-gray-950 dark:text-gray-50">关键片段对照</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">转换器主要替换这两段</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SnippetBlock title="软路由 Nikki / OpenWrt" code={ROUTER_SNIPPET} />
            <SnippetBlock title="本地 Mihomo 客户端" code={LOCAL_SNIPPET} />
          </div>
        </section>
      </div>
    </div>
  )
}

function DiffRow({ label, router, local, mono = false }: { label: string; router: string; local: string; mono?: boolean }) {
  const valueClass = mono ? 'font-mono text-xs whitespace-pre-line' : 'text-sm leading-6'
  return (
    <tr className="align-top">
      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</th>
      <td className={`px-4 py-3 text-gray-800 dark:text-gray-200 ${valueClass}`}>{router}</td>
      <td className={`px-4 py-3 text-gray-800 dark:text-gray-200 ${valueClass}`}>{local}</td>
    </tr>
  )
}

function ToolbarButton({
  onClick,
  icon,
  label,
  disabled = false,
  emphasis = false,
  danger = false,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
  emphasis?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45',
        emphasis
          ? 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
          : danger
            ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  )
}

function YamlPane({
  label,
  badge,
  value,
  onChange,
  placeholder,
}: {
  label: string
  badge: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950">
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{label}</span>
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{badge}</span>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="min-h-[420px] flex-1 resize-y bg-gray-950 p-4 font-mono text-xs leading-6 text-green-300 outline-none placeholder:text-gray-600"
      />
    </div>
  )
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
      <div className="mb-2 flex items-center gap-2">
        <CheckCircle2 size={15} className="text-emerald-500" />
        <h4 className="text-sm font-bold text-gray-950 dark:text-gray-50">{title}</h4>
      </div>
      <p className="text-xs leading-6 text-gray-600 dark:text-gray-300">{text}</p>
    </div>
  )
}

function SnippetBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
        {title}
      </div>
      <pre className="overflow-x-auto bg-gray-950 p-4 text-xs leading-6 text-green-300"><code>{code}</code></pre>
    </div>
  )
}

function StatusBadge({ detected, message, error }: { detected: DetectedEnv; message: string; error: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full border border-gray-200 px-2.5 py-1 font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
        {envLabel(detected)}
      </span>
      <span className={error ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}>{error || message}</span>
    </div>
  )
}
