import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AnswerPanel } from './AnswerPanel'

describe('AnswerPanel', () => {
  it('renders markdown answer content as structured markup', () => {
    render(
      <AnswerPanel
        answer={[
          '### 09III型核潜艇概述',
          '',
          '09III型核潜艇是**核动力**潜艇，来自 `LightRAG` 检索。',
          '',
          '- 航速：30节',
          '- 最大潜深：300米',
        ].join('\n')}
      />,
    )

    expect(
      screen.getByRole('heading', { level: 3, name: '09III型核潜艇概述' }),
    ).toBeInTheDocument()
    expect(screen.getByText('核动力').tagName).toBe('STRONG')
    expect(screen.getByText('LightRAG').tagName).toBe('CODE')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText(/^###/)).not.toBeInTheDocument()
  })

  it('renders markdown tables in answer content', () => {
    render(
      <AnswerPanel
        answer={[
          '| 指标 | 数值 |',
          '| --- | --- |',
          '| 航速 | **30节** |',
          '| 最大潜深 | 300米 |',
        ].join('\n')}
      />,
    )

    expect(screen.getByRole('columnheader', { name: '指标' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '数值' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '航速' })).toBeInTheDocument()
    expect(screen.getByText('30节').tagName).toBe('STRONG')
  })
})
