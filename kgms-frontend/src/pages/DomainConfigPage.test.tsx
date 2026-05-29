import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DomainConfigPage } from './DomainConfigPage'
import { getDomainConfig, updateDomainConfig } from '../api/configuration'
import type { DomainConfigRead } from '../types/api'

vi.mock('../api/configuration', () => ({
  getDomainConfig: vi.fn(),
  updateDomainConfig: vi.fn(),
}))

const domainConfig: DomainConfigRead = {
  entity_types: [
    { key: 'equipment', display_name: '装备', color: '#0891b2' },
    { key: 'event', display_name: '事件', color: '#ea580c' },
  ],
  relation_keywords: ['设计单位', '搭载武器', '属于事件'],
  entity_prompt_yaml: 'entity_types_guidance: |\n  军事实体抽取说明',
  qa_prompt_markdown: '你是面向军事资料的领域问答助手。',
}

describe('DomainConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDomainConfig).mockResolvedValue(domainConfig)
    vi.mocked(updateDomainConfig).mockResolvedValue({
      ...domainConfig,
      qa_prompt_markdown: '新的问答 Prompt',
    })
  })

  it('keeps prompts read-only until edit is enabled and then saves changes', async () => {
    const user = userEvent.setup()
    render(<DomainConfigPage />)

    expect(await screen.findByText('装备')).toBeInTheDocument()
    expect(screen.getByText('设计单位')).toBeInTheDocument()
    expect(screen.getByLabelText('抽取 Prompt')).toHaveValue(domainConfig.entity_prompt_yaml)
    expect(screen.getByLabelText('问答 Prompt')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: '保存领域配置' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '编辑领域配置' }))

    await user.clear(screen.getByLabelText('问答 Prompt'))
    await user.type(screen.getByLabelText('问答 Prompt'), '新的问答 Prompt')
    await user.click(screen.getByRole('button', { name: '保存领域配置' }))

    await waitFor(() => expect(updateDomainConfig).toHaveBeenCalled())
    expect(updateDomainConfig).toHaveBeenCalledWith({
      entity_prompt_yaml: domainConfig.entity_prompt_yaml,
      qa_prompt_markdown: '新的问答 Prompt',
    })
    expect(await screen.findByText('领域配置已保存')).toBeInTheDocument()
  })
})
