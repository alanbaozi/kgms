import { apiRequest } from './client'
import type { RetrievalRequest, RetrievalResponse } from '../types/api'

export function queryRetrieval(request: RetrievalRequest): Promise<RetrievalResponse> {
  return apiRequest<RetrievalResponse>('/api/retrieval/query', {
    method: 'POST',
    body: JSON.stringify({
      filters: {},
      include_graph: true,
      include_pageindex_snippets: true,
      ...request,
    }),
  })
}
