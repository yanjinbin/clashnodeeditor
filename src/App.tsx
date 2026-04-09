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
        <a
          href="https://github.com/yanjinbin/clashnodeeditor"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          title="GitHub"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        </a>
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
