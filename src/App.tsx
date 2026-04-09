import { useAppStore } from './store/useAppStore'
import SourceManager from './components/SourceManager'
import ProxyGroupEditor from './components/ProxyGroupEditor'
import RuleSetManager from './components/RuleSetManager'
import ConfigPreview from './components/ConfigPreview'
import { Globe, Users, Shield, FileText } from 'lucide-react'

const TABS = [
  { id: 'sources' as const, label: '订阅源', icon: Globe },
  { id: 'groups' as const, label: '代理组', icon: Users },
  { id: 'rules' as const, label: '规则', icon: Shield },
  { id: 'preview' as const, label: '预览导出', icon: FileText },
]

export default function App() {
  const { activeTab, setActiveTab } = useAppStore()

  return (
    // 根容器：flex 列，占满视口，overflow-hidden 只在最外层防止 body 滚动
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">

      {/* Header：shrink-0 固定高度，不参与 flex 伸缩 */}
      <header className="shrink-0 flex items-center gap-3 px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none select-none">🚀🌍</span>
          <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Clash Node Editor</h1>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
            {new Date(__BUILD_TIME__).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}
          </span>
        </div>
        <div className="ml-4 flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </header>

      {/*
        main：flex-1 min-h-0
        - flex-1 → 吃掉 header 剩余的所有高度
        - min-h-0 → 关键！覆盖 flex 子项默认的 min-height:auto，
                    否则内容撑高后此层不会收缩，溢出根容器
        - flex flex-col → 继续传递 flex 上下文给子层
      */}
      <main className="flex-1 min-h-0 flex flex-col">
        {/*
          居中容器：flex-1 min-h-0 继续传递，
          max-w-5xl 限制宽度，w-full 保证窄屏不缩
        */}
        <div className="flex-1 min-h-0 flex flex-col w-full max-w-5xl mx-auto bg-white dark:bg-gray-900">
          {activeTab === 'sources' && <SourceManager />}
          {activeTab === 'groups' && <ProxyGroupEditor />}
          {activeTab === 'rules' && <RuleSetManager />}
          {activeTab === 'preview' && <ConfigPreview />}
        </div>
      </main>
    </div>
  )
}
