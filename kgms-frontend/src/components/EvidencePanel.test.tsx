import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EvidencePanel } from './EvidencePanel'
import type { PageIndexHitRead } from '../types/api'

describe('EvidencePanel', () => {
  it('renders PageIndex relevant content as markdown', () => {
    render(
      <EvidencePanel
        hits={[
          {
            id: 1,
            document_id: 1,
            query: '09III型核潜艇',
            node_id: 'node-1',
            title: 'PageIndex 片段',
            page_index: 4,
            relevant_content: [
              '### PageIndex 摘要',
              '',
              '该片段提到 **核动力** 与 `鱼雷`。',
              '',
              '- 航速：30节',
              '- 最大潜深：300米',
            ].join('\n'),
            created_at: '2026-05-26T00:00:00Z',
          },
        ]}
      />,
    )

    expect(screen.getByText('文档检索原文证据')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'PageIndex 摘要' })).toBeInTheDocument()
    expect(screen.getByText('核动力').tagName).toBe('STRONG')
    expect(screen.getByText('鱼雷').tagName).toBe('CODE')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText(/^###/)).not.toBeInTheDocument()
  })
})
