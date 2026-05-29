import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('collapses and expands the desktop sidebar while keeping navigation available', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(
      <AppShell activePage="retrieval" onNavigate={onNavigate}>
        <main>页面内容</main>
      </AppShell>,
    )

    expect(screen.getByText('KGMS')).toBeInTheDocument()
    expect(screen.getByText('Knowledge Graph')).toBeInTheDocument()
    expect(screen.getByText('知识检索')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '收起侧边栏' }))

    expect(screen.queryByText('Knowledge Graph')).not.toBeInTheDocument()
    expect(screen.queryByText('知识检索')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '知识检索' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '文档管理' }))

    expect(onNavigate).toHaveBeenCalledWith('documents')

    await user.click(screen.getByRole('button', { name: '展开侧边栏' }))

    expect(screen.getByText('Knowledge Graph')).toBeInTheDocument()
    expect(screen.getByText('知识检索')).toBeInTheDocument()
  })
})
