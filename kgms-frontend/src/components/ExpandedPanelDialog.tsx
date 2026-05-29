import { X } from 'lucide-react'
import { ReactNode, useEffect, useId } from 'react'

interface ExpandedPanelDialogProps {
  children: ReactNode
  onClose: () => void
  title: string
}

export function ExpandedPanelDialog({ children, onClose, title }: ExpandedPanelDialogProps) {
  const titleId = useId()

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 p-4 backdrop-blur-sm">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="mx-auto flex h-full max-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <h2 id={titleId} className="text-lg font-semibold text-slate-950">
            {title}
          </h2>
          <button
            aria-label="关闭弹窗"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">{children}</div>
      </section>
    </div>
  )
}
