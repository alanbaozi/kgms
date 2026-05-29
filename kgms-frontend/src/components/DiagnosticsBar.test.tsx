import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DiagnosticsBar } from './DiagnosticsBar'

describe('DiagnosticsBar', () => {
  it('uses product-facing Chinese names for retrieval backend statuses', () => {
    render(
      <DiagnosticsBar
        diagnostics={{
          route_reason: '自动选择混合检索',
          lightrag_status: 'ok',
          pageindex_status: 'ok',
          timings_ms: {},
          errors: [],
        }}
      />,
    )

    expect(screen.getByText('图谱检索：ok')).toBeInTheDocument()
    expect(screen.getByText('文档检索：ok')).toBeInTheDocument()
    expect(screen.queryByText(/LightRAG/)).not.toBeInTheDocument()
    expect(screen.queryByText(/PageIndex/)).not.toBeInTheDocument()
  })
})
