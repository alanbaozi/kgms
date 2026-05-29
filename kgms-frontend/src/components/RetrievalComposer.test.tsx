import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RetrievalComposer } from './RetrievalComposer'

describe('RetrievalComposer', () => {
  it('renders mode selector, query input and send action as one connected input group', () => {
    render(
      <RetrievalComposer
        mode="smart"
        onModeChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByTestId('retrieval-composer')).toHaveClass('rounded-xl')
    expect(screen.getByTestId('mode-control')).toHaveClass('md:border-r')
    expect(screen.getByTestId('query-control')).toHaveClass('min-w-0')
    expect(screen.getByRole('button', { name: '发送' })).toHaveClass('rounded-lg')
  })

  it('submits the trimmed query with the selected mode unchanged', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <RetrievalComposer
        mode="hybrid"
        onModeChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    await user.type(screen.getByLabelText('检索问题'), '  09III型核潜艇武器系统  ')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(onSubmit).toHaveBeenCalledWith('09III型核潜艇武器系统')
  })

  it('shows Chinese retrieval mode names while preserving API mode values', async () => {
    const user = userEvent.setup()
    const onModeChange = vi.fn()
    render(
      <RetrievalComposer
        mode="hybrid"
        onModeChange={onModeChange}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByRole('option', { name: '智能检索' })).toHaveValue('smart')
    expect(screen.getByRole('option', { name: '混合检索' })).toHaveValue('hybrid')
    expect(screen.getByRole('option', { name: '图谱检索' })).toHaveValue('lightrag')
    expect(screen.getByRole('option', { name: '文档检索' })).toHaveValue('pageindex')
    expect(screen.getByRole('option', { name: '向量检索' })).toHaveValue('native')

    await user.selectOptions(screen.getByLabelText('检索模式'), 'lightrag')

    expect(onModeChange).toHaveBeenCalledWith('lightrag')
  })
})
