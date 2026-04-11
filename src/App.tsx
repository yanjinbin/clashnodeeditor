import { useAppStore } from './store/useAppStore'
import SourceManager from './components/SourceManager'
import NodeManager from './components/NodeManager'
import ProxyGroupEditor from './components/ProxyGroupEditor'
import RuleSetManager from './components/RuleSetManager'
import ConfigPreview from './components/ConfigPreview'
import NovproxyBanner from './components/NovproxyBanner'
import { Globe, Server, Users, Shield, FileText } from 'lucide-react'

const TABS = [
  { id: 'sources' as const, label: '订阅源', icon: Globe },
  { id: 'nodes'   as const, label: '手动节点', icon: Server },
  { id: 'groups'  as const, label: '代理组', icon: Users },
  { id: 'rules'   as const, label: '规则', icon: Shield },
  { id: 'preview' as const, label: '预览导出', icon: FileText },
]

// 左右 banner 列宽 — xl:144px，与 max-w-5xl(1024px) 合计 1312px ≤ 1280px 时自动隐藏
const AD_COL = 'w-36' // 144px

export default function App() {
  const { activeTab, setActiveTab } = useAppStore()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">

      {/* ── Header：三列对齐，spacer 宽度与广告列一致 ─────────────────── */}
      <header className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex h-full">
          {/* 左 spacer（对齐广告列） */}
          <div className={`hidden xl:block ${AD_COL} shrink-0`} />

          {/* 品牌 + Tab，与内容区等宽对齐 */}
          <div className="flex-1 min-w-0 flex justify-center">
            <div className="w-full max-w-5xl">
              <div className="flex items-center gap-3 px-6 pt-3 pb-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 shrink-0">
                  <span className="text-base leading-none select-none">✈️</span>
                </div>
                <div>
                  <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
                    多源机场节点配置编辑器 — Clash 订阅合并 & 代理组管理工具
                  </h1>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono leading-tight">
                    {new Date(__BUILD_TIME__).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}
                  </p>
                </div>
              </div>

              <nav className="flex gap-0.5 px-5 pt-2" role="tablist">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const active = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.id)}
                      className={[
                        'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all select-none',
                        active
                          ? 'text-indigo-600 dark:text-indigo-400 bg-gray-50 dark:bg-gray-950'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50/60 dark:hover:bg-gray-800/60',
                      ].join(' ')}
                    >
                      <Icon size={15} />
                      <span>{tab.label}</span>
                      {active && (
                        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-t-full" />
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* 右 spacer */}
          <div className={`hidden xl:block ${AD_COL} shrink-0`} />
        </div>
      </header>

      {/* ── Main：三列布局 ────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden flex">

        {/* 左侧广告列 — xl(≥1280px) 起显示 */}
        <aside className={`hidden xl:flex flex-col ${AD_COL} shrink-0 overflow-y-auto pt-3 px-2 gap-4 bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800`}>
          <NovproxyBanner />
        </aside>

        {/* 主内容区 */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex justify-center">
          <div className="w-full max-w-5xl min-h-0 flex flex-col bg-white dark:bg-gray-900 border-x border-gray-200 dark:border-gray-800">
            {activeTab === 'sources' && <SourceManager />}
            {activeTab === 'nodes'   && <NodeManager />}
            {activeTab === 'groups'  && <ProxyGroupEditor />}
            {activeTab === 'rules'   && <RuleSetManager />}
            {activeTab === 'preview' && <ConfigPreview />}
          </div>
        </div>

        {/* 右侧广告列 */}
        <aside className={`hidden xl:flex flex-col ${AD_COL} shrink-0 overflow-y-auto pt-3 px-2 gap-4 bg-gray-50 dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800`}>
          <NovproxyBanner />
        </aside>

      </main>
    </div>
  )
}
