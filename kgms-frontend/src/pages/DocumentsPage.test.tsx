import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DocumentsPage } from './DocumentsPage'
import {
  deleteDocument,
  listDocuments,
  syncLightRAGDocument,
  syncPageIndexDocument,
  syncDocumentStatuses,
  uploadDocument,
} from '../api/documents'
import type { DocumentRead } from '../types/api'

vi.mock('../api/documents', () => ({
  deleteDocument: vi.fn(),
  listDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  syncDocumentStatuses: vi.fn(),
  syncLightRAGDocument: vi.fn(),
  syncPageIndexDocument: vi.fn(),
}))

const documentRow: DocumentRead = {
  id: 1,
  original_filename: '09III型核潜艇.pdf',
  content_type: 'application/pdf',
  sha256: 'a'.repeat(64),
  size_bytes: 1073103,
  storage_path: 'data/kgms/uploads/09III型核潜艇.pdf',
  lightrag_track_id: 'upload_1',
  lightrag_doc_id: 'doc-e0675',
  lightrag_status: 'completed',
  lightrag_error: null,
  pageindex_doc_id: 'pi-cmpj',
  pageindex_status: 'synced',
  pageindex_error: null,
  created_at: '2026-05-24T15:08:19.462071',
  updated_at: '2026-05-24T15:46:42.857083Z',
}

describe('DocumentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listDocuments).mockResolvedValue({ items: [documentRow], total: 7 })
    vi.mocked(syncDocumentStatuses).mockResolvedValue({
      items: [],
      total: 0,
      lightrag_checked: 0,
      pageindex_checked: 0,
      errors: [],
    })
    vi.mocked(uploadDocument).mockResolvedValue({
      document: documentRow,
      index_target: 'both',
    })
    vi.mocked(syncLightRAGDocument).mockResolvedValue(documentRow)
    vi.mocked(syncPageIndexDocument).mockResolvedValue(documentRow)
    vi.mocked(deleteDocument).mockResolvedValue({
      document_id: documentRow.id,
      deleted: true,
      lightrag_delete_status: 'deletion_started',
      message: '文档已删除',
    })
  })

  it('renders document rows, statuses, upload button and sync button', async () => {
    render(<DocumentsPage />)

    expect(await screen.findByText('09III型核潜艇.pdf')).toBeInTheDocument()
    expect(screen.getByTestId('summary-total')).toHaveTextContent('7')
    expect(screen.getByText(/pi-cmpj/)).toBeInTheDocument()
    expect(screen.getAllByText('完成')).toHaveLength(2)
    expect(screen.getByText('混合构建')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '图谱构建' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '索引构建' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上传文档' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '同步状态' })).toBeInTheDocument()
  })

  it('syncs document statuses and refreshes the list', async () => {
    const user = userEvent.setup()
    render(<DocumentsPage />)
    await screen.findByText('09III型核潜艇.pdf')

    await user.click(screen.getByRole('button', { name: '同步状态' }))

    await waitFor(() => expect(syncDocumentStatuses).toHaveBeenCalled())
    expect(listDocuments).toHaveBeenCalledTimes(2)
  })

  it('keeps sync errors visible after refreshing the document list', async () => {
    const user = userEvent.setup()
    vi.mocked(syncDocumentStatuses).mockResolvedValueOnce({
      items: [],
      total: 0,
      lightrag_checked: 0,
      pageindex_checked: 0,
      errors: ['LightRAG timeout'],
    })
    render(<DocumentsPage />)
    await screen.findByText('09III型核潜艇.pdf')

    await user.click(screen.getByRole('button', { name: '同步状态' }))

    expect(await screen.findByText('LightRAG timeout')).toBeInTheDocument()
  })

  it('shows single document sync failures', async () => {
    const user = userEvent.setup()
    vi.mocked(syncPageIndexDocument).mockRejectedValueOnce(new Error('PageIndex sync failed'))
    render(<DocumentsPage />)
    await screen.findByText('09III型核潜艇.pdf')

    await user.click(screen.getByRole('button', { name: '索引构建' }))

    expect(await screen.findByText('PageIndex sync failed')).toBeInTheDocument()
  })

  it('refreshes the document list without syncing remote statuses', async () => {
    const user = userEvent.setup()
    render(<DocumentsPage />)
    await screen.findByText('09III型核潜艇.pdf')

    await user.click(screen.getByRole('button', { name: '刷新' }))

    await waitFor(() => expect(listDocuments).toHaveBeenCalledTimes(2))
    expect(syncDocumentStatuses).not.toHaveBeenCalled()
  })

  it('keeps the selected file visible when upload fails', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadDocument).mockRejectedValueOnce(new Error('PageIndex 401'))
    render(<DocumentsPage />)
    await screen.findByText('09III型核潜艇.pdf')

    await user.click(screen.getByRole('button', { name: '上传文档' }))
    const dialog = within(screen.getByRole('dialog', { name: '上传文档' }))
    expect(dialog.getByRole('button', { name: '关闭上传窗口' })).toBeInTheDocument()
    expect(dialog.getByText('构建目标')).toBeInTheDocument()
    expect(dialog.queryByText('索引目标')).not.toBeInTheDocument()
    const targetRadios = dialog.getAllByRole('radio')
    expect(targetRadios).toHaveLength(3)
    expect(targetRadios[0]).toBeChecked()
    expect(dialog.getByText('混合构建')).toBeInTheDocument()
    expect(dialog.getByText('图谱构建')).toBeInTheDocument()
    expect(dialog.getByText('索引构建')).toBeInTheDocument()
    expect(dialog.queryByRole('combobox')).not.toBeInTheDocument()
    const file = new File(['pdf'], '039A型潜艇.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('选择 PDF、Office 或图片文件'), file)
    await user.click(screen.getByRole('button', { name: '开始上传' }))

    expect(await screen.findByText('PageIndex 401')).toBeInTheDocument()
    expect(screen.getByText('039A型潜艇.pdf')).toBeInTheDocument()
  })

  it('deletes a document after confirmation and refreshes the list', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<DocumentsPage />)
    await screen.findByText('09III型核潜艇.pdf')

    await user.click(screen.getByRole('button', { name: '删除文档 09III型核潜艇.pdf' }))

    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith(documentRow.id))
    expect(listDocuments).toHaveBeenCalledTimes(2)
  })
})
