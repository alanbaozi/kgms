import type { RetrievalMode, RetrievalResponse } from '../types/api'

export type RetrievalLayoutVariant =
  | 'answer-only'
  | 'answer-graph'
  | 'answer-evidence'
  | 'full'

export interface RetrievalLayout {
  variant: RetrievalLayoutVariant
  showGraph: boolean
  showEvidence: boolean
}

export function selectRetrievalLayout(
  response: RetrievalResponse | null,
  requestedMode?: RetrievalMode,
): RetrievalLayout {
  if (!response) {
    return { variant: 'answer-only', showGraph: false, showEvidence: false }
  }

  const mode = requestedMode === 'smart' ? response.mode : response.mode

  if (mode === 'native') {
    return { variant: 'answer-only', showGraph: false, showEvidence: false }
  }
  if (mode === 'lightrag') {
    return { variant: 'answer-graph', showGraph: true, showEvidence: false }
  }
  if (mode === 'pageindex') {
    return {
      variant: 'answer-evidence',
      showGraph: false,
      showEvidence: true,
    }
  }
  if (mode === 'hybrid') {
    return { variant: 'full', showGraph: true, showEvidence: true }
  }
  return { variant: 'answer-only', showGraph: false, showEvidence: false }
}
