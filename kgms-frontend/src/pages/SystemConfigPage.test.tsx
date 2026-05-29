import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SystemConfigPage } from './SystemConfigPage'
import { getSystemConfig, restartLightRAG, updateSystemConfig } from '../api/configuration'
import type { SystemConfigRead } from '../types/api'

vi.mock('../api/configuration', () => ({
  getSystemConfig: vi.fn(),
  restartLightRAG: vi.fn(),
  updateSystemConfig: vi.fn(),
}))

const systemConfig: SystemConfigRead = {
  kgms: {
    lightrag_base_url: 'http://lightrag.example:9621',
    lightrag_api_key: { masked: '', is_set: false },
    pageindex_base_url: 'https://api.pageindex.ai',
    pageindex_api_key: { masked: 'pi-t****-key', is_set: true },
    pageindex_profile: 'official',
    pageindex_timeout_seconds: 180,
    default_top_k: 10,
  },
  lightrag: {
    host: '0.0.0.0',
    port: 9621,
    llm_binding_host: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    llm_binding_api_key: { masked: 'sk-te****cret', is_set: true },
    llm_model: 'qwen3.6-plus',
    query_llm_model: 'qwen3.6-plus',
    keyword_llm_model: 'deepseek-v4-flash',
    embedding_binding_host: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    embedding_binding_api_key: { masked: 'sk-te****cret', is_set: true },
    embedding_model: 'text-embedding-v3',
    embedding_dim: 1024,
    rerank_binding_host: 'https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank',
    rerank_binding_api_key: { masked: 'sk-te****cret', is_set: true },
    rerank_model: 'qwen3-rerank',
    mineru_api_token: { masked: 'mine****cret', is_set: true },
    vlm_llm_binding_host: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    vlm_llm_binding_api_key: { masked: 'sk-te****cret', is_set: true },
    vlm_llm_model: 'qwen3.6-plus',
  },
  deployment: {
    managed_root: '/mock/lightrag-server',
    kgms_env_path: '/kgms/.env',
    lightrag_env_path: '/mock/lightrag-server/.env',
    entity_prompt_path: '/mock/lightrag-server/prompts/entity_type/military.yml',
    qa_prompt_path: '/mock/lightrag-server/prompts/query/military_qa.md',
    restart_enabled: false,
    restart_strategy: 'compose',
    lightrag_container_name: 'kgms-lightrag',
  },
  requires_kgms_restart: false,
  requires_lightrag_restart: false,
}

describe('SystemConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSystemConfig).mockResolvedValue(systemConfig)
    vi.mocked(updateSystemConfig).mockResolvedValue({
      ...systemConfig,
      requires_lightrag_restart: true,
    })
    vi.mocked(restartLightRAG).mockResolvedValue({
      status: 'recreated',
      output: 'kgms-lightrag recreated',
    })
  })

  it('keeps settings read-only until edit is enabled and then saves changes', async () => {
    const user = userEvent.setup()
    render(<SystemConfigPage />)

    expect(await screen.findByDisplayValue('http://lightrag.example:9621')).toBeInTheDocument()
    expect(screen.getByLabelText('LLM 模型')).toBeDisabled()
    expect(screen.getAllByText('sk-te****cret').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('LLM API Key')).not.toBeInTheDocument()
    expect(screen.getByText('/mock/lightrag-server')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存系统配置' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '编辑系统配置' }))

    await user.clear(screen.getByLabelText('LLM 模型'))
    await user.type(screen.getByLabelText('LLM 模型'), 'qwen-test')
    expect(screen.getByLabelText('LLM API Key')).toBeInTheDocument()
    await user.type(screen.getByLabelText('LLM API Key'), 'sk-new-secret')
    await user.click(screen.getByRole('button', { name: '保存系统配置' }))

    await waitFor(() => expect(updateSystemConfig).toHaveBeenCalled())
    expect(updateSystemConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        lightrag: expect.objectContaining({
          llm_model: 'qwen-test',
          llm_binding_api_key: 'sk-new-secret',
        }),
      }),
    )
    expect(await screen.findByText(/LightRAG 需要重启/)).toBeInTheDocument()
  })

  it('can apply graph service configuration by recreating the container', async () => {
    const user = userEvent.setup()
    vi.mocked(getSystemConfig).mockResolvedValue({
      ...systemConfig,
      deployment: {
        ...systemConfig.deployment,
        restart_enabled: true,
        restart_strategy: 'docker_socket',
      },
    })
    render(<SystemConfigPage />)

    expect(await screen.findByText('docker_socket')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '应用配置并重建图谱服务' }))

    await waitFor(() => expect(restartLightRAG).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/图谱服务已重建/)).toBeInTheDocument()
  })
})
