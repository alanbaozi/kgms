import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it.each([
    ['completed', '完成', 'bg-emerald-50'],
    ['synced', '完成', 'bg-blue-50'],
    ['parsing', '解析中', 'bg-amber-50'],
    ['analyzing', '分析中', 'bg-amber-50'],
    ['processing', '进行中', 'bg-amber-50'],
    ['preprocessed', '待抽取', 'bg-amber-50'],
    ['uploaded', '等待中', 'bg-slate-50'],
    ['pending', '等待中', 'bg-slate-50'],
    ['failed', '失败', 'bg-red-50'],
    ['skipped', '未启用', 'bg-slate-100'],
  ])('renders %s with a stable color class', (status, label, colorClass) => {
    render(<StatusBadge status={status} />)

    const badge = screen.getByText(label)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain(colorClass)
  })
})
