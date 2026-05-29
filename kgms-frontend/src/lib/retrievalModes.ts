import type { RetrievalMode } from '../types/api'

export const RETRIEVAL_MODE_OPTIONS: Array<{ value: RetrievalMode; label: string }> = [
  { value: 'smart', label: '智能检索' },
  { value: 'hybrid', label: '混合检索' },
  { value: 'lightrag', label: '图谱检索' },
  { value: 'pageindex', label: '文档检索' },
  { value: 'native', label: '向量检索' },
]

export function retrievalModeLabel(mode: RetrievalMode): string {
  return RETRIEVAL_MODE_OPTIONS.find((option) => option.value === mode)?.label || mode
}
