import { apiRequest } from './client'
import type {
  DeleteDocumentResponse,
  DocumentListResponse,
  DocumentRead,
  DocumentStatusSyncResponse,
  IndexTarget,
  UploadResponse,
} from '../types/api'

export function listDocuments(): Promise<DocumentListResponse> {
  return apiRequest<DocumentListResponse>('/api/documents')
}

export function uploadDocument(file: File, indexTarget: IndexTarget): Promise<UploadResponse> {
  const body = new FormData()
  body.append('file', file)
  body.append('index_target', indexTarget)
  return apiRequest<UploadResponse>('/api/documents/upload', {
    method: 'POST',
    body,
  })
}

export function syncDocumentStatuses(limit = 50): Promise<DocumentStatusSyncResponse> {
  return apiRequest<DocumentStatusSyncResponse>(`/api/documents/sync-status?limit=${limit}`, {
    method: 'POST',
  })
}

export function syncLightRAGDocument(documentId: number): Promise<DocumentRead> {
  return apiRequest<DocumentRead>(`/api/documents/${documentId}/lightrag/sync`, {
    method: 'POST',
  })
}

export function syncPageIndexDocument(documentId: number): Promise<DocumentRead> {
  return apiRequest<DocumentRead>(`/api/documents/${documentId}/pageindex/sync`, {
    method: 'POST',
  })
}

export function deleteDocument(documentId: number): Promise<DeleteDocumentResponse> {
  return apiRequest<DeleteDocumentResponse>(`/api/documents/${documentId}`, {
    method: 'DELETE',
  })
}
