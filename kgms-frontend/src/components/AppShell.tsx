import {
  Database,
  FileText,
  GitFork,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SlidersHorizontal,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'

export type AppPage = 'documents' | 'retrieval' | 'knowledgeGraph' | 'system' | 'domain'

interface AppShellProps {
  activePage: AppPage
  onNavigate: (page: AppPage) => void
  children: ReactNode
}

const NAV_ITEMS = [
  { id: 'documents' as const, label: '文档管理', icon: FileText },
  { id: 'retrieval' as const, label: '知识检索', icon: Network },
  { id: 'knowledgeGraph' as const, label: '知识图谱', icon: GitFork },
  { id: 'system' as const, label: '系统配置', icon: SlidersHorizontal },
  { id: 'domain' as const, label: '领域配置', icon: Settings },
]

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const ToggleIcon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <div className="flex min-h-screen bg-kgms-canvas text-slate-900">
      <aside
        className={`flex shrink-0 flex-col bg-kgms-navy px-4 py-5 text-slate-200 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[4.75rem]' : 'w-60'
        }`}
      >
        <div
          className={`flex items-center pb-6 ${
            sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-2'
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            K
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">KGMS</div>
              <div className="truncate text-xs text-slate-400">Knowledge Graph</div>
            </div>
          )}
          {!sidebarCollapsed && (
            <button
              type="button"
              aria-label="收起侧边栏"
              onClick={() => setSidebarCollapsed(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 hover:text-white"
              title="收起侧边栏"
            >
              <ToggleIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <button
            type="button"
            aria-label="展开侧边栏"
            onClick={() => setSidebarCollapsed(false)}
            className="mb-4 flex h-9 w-full items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 hover:text-white"
            title="展开侧边栏"
          >
            <ToggleIcon className="h-4 w-4" />
          </button>
        )}

        <nav className="space-y-1" aria-label="主导航">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = item.id === activePage
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                onClick={() => onNavigate(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex w-full items-center rounded-lg py-2.5 text-sm transition ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                } ${sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3 text-left'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div
          className={`mt-auto border-t border-slate-700 pt-4 text-xs leading-5 text-slate-400 ${
            sidebarCollapsed ? 'px-0' : 'px-2'
          }`}
        >
          <div
            className={`flex items-center text-slate-300 ${
              sidebarCollapsed ? 'justify-center' : 'gap-2'
            }`}
            title="KGMS Backend"
          >
            <Database className="h-3.5 w-3.5" />
            {!sidebarCollapsed && 'KGMS Backend'}
          </div>
          {!sidebarCollapsed && <div className="mt-1 truncate">VITE_KGMS_API_BASE_URL</div>}
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
