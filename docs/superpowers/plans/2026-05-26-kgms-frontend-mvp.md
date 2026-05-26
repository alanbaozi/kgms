# KGMS Frontend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first KGMS frontend workbench with document upload/status management, retrieval mode selection, adaptive answer/evidence/graph display, and real KGMS Backend API integration.

**Architecture:** Create a new `kgms-frontend/` Vite React TypeScript app. Keep API calls in `src/api`, shared API shapes in `src/types`, layout primitives in `src/components`, and route-level screens in `src/pages`. The frontend only calls KGMS Backend and renders graph data returned by `/api/retrieval/query`.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, ECharts, Vitest, React Testing Library.

---

## File Structure

- Create `kgms-frontend/package.json`: frontend scripts and dependencies.
- Create `kgms-frontend/index.html`, `kgms-frontend/vite.config.ts`, `kgms-frontend/tsconfig*.json`, `kgms-frontend/tailwind.config.js`, `kgms-frontend/postcss.config.js`: Vite, TypeScript and Tailwind setup.
- Create `kgms-frontend/src/types/api.ts`: KGMS API response/request types and retrieval mode helpers.
- Create `kgms-frontend/src/api/client.ts`: shared fetch wrapper with JSON and multipart handling.
- Create `kgms-frontend/src/api/documents.ts`: document list/upload/sync APIs.
- Create `kgms-frontend/src/api/retrieval.ts`: retrieval query API.
- Create `kgms-frontend/src/lib/format.ts`: formatting helpers for dates, bytes, IDs and status summaries.
- Create `kgms-frontend/src/lib/retrievalLayout.ts`: pure adaptive layout selection logic for retrieval results.
- Create `kgms-frontend/src/components/*.tsx`: App shell, badges, document table, upload dialog, retrieval composer, answer/evidence/graph/diagnostics panels and empty state.
- Create `kgms-frontend/src/pages/DocumentsPage.tsx`, `RetrievalPage.tsx`, `DomainConfigPage.tsx`: route-level screens.
- Create `kgms-frontend/src/App.tsx`, `main.tsx`, `index.css`: app composition and styling.
- Create `kgms-frontend/src/**/*.test.ts(x)`: focused tests for layout logic, API client and core rendering behavior.

## Task 1: Scaffold Frontend Project

**Files:**
- Create: `kgms-frontend/package.json`
- Create: `kgms-frontend/index.html`
- Create: `kgms-frontend/vite.config.ts`
- Create: `kgms-frontend/tsconfig.json`
- Create: `kgms-frontend/tsconfig.node.json`
- Create: `kgms-frontend/tailwind.config.js`
- Create: `kgms-frontend/postcss.config.js`
- Create: `kgms-frontend/src/main.tsx`
- Create: `kgms-frontend/src/App.tsx`
- Create: `kgms-frontend/src/index.css`

- [ ] **Step 1: Create package and build configuration**

Create a Vite React TypeScript project in `kgms-frontend` with scripts:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm install
```

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 3: Verify scaffold builds**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm run build
```

Expected: TypeScript and Vite build pass.

## Task 2: Define API Types and Client

**Files:**
- Create: `kgms-frontend/src/types/api.ts`
- Create: `kgms-frontend/src/api/client.ts`
- Create: `kgms-frontend/src/api/documents.ts`
- Create: `kgms-frontend/src/api/retrieval.ts`
- Test: `kgms-frontend/src/api/client.test.ts`

- [ ] **Step 1: Write API client tests**

Create tests that mock `fetch` and verify:

```ts
await apiRequest('/api/documents')
```

calls the configured backend URL and parses JSON; failed HTTP responses throw `ApiError`.

- [ ] **Step 2: Implement API client**

Implement:

```ts
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T>
```

Use `VITE_KGMS_API_BASE_URL`, defaulting to `http://127.0.0.1:8000`.

- [ ] **Step 3: Implement document and retrieval APIs**

Expose:

```ts
listDocuments()
uploadDocument(file, indexTarget)
syncDocumentStatuses()
queryRetrieval(request)
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm test -- src/api/client.test.ts
```

Expected: tests pass.

## Task 3: Build Shared UI Foundation

**Files:**
- Create: `kgms-frontend/src/components/AppShell.tsx`
- Create: `kgms-frontend/src/components/StatusBadge.tsx`
- Create: `kgms-frontend/src/components/EmptyState.tsx`
- Create: `kgms-frontend/src/lib/format.ts`
- Test: `kgms-frontend/src/components/StatusBadge.test.tsx`

- [ ] **Step 1: Write status badge tests**

Verify `completed`, `synced`, `processing`, `failed` and `skipped` render stable labels and color classes.

- [ ] **Step 2: Implement shell and shared components**

Implement left navigation with pages:

```ts
type AppPage = 'documents' | 'retrieval' | 'domain'
```

Use lucide icons for navigation and action buttons.

- [ ] **Step 3: Run component tests**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm test -- src/components/StatusBadge.test.tsx
```

Expected: tests pass.

## Task 4: Implement Document Management Page

**Files:**
- Create: `kgms-frontend/src/components/DocumentTable.tsx`
- Create: `kgms-frontend/src/components/UploadDialog.tsx`
- Create: `kgms-frontend/src/pages/DocumentsPage.tsx`
- Test: `kgms-frontend/src/pages/DocumentsPage.test.tsx`

- [ ] **Step 1: Write document page tests**

Mock `listDocuments`, `uploadDocument` and `syncDocumentStatuses`. Verify the page renders a document row, status badges, upload button and sync button.

- [ ] **Step 2: Implement document table and upload dialog**

Use the current backend fields:

```ts
original_filename
size_bytes
lightrag_doc_id
lightrag_track_id
lightrag_status
pageindex_doc_id
pageindex_status
updated_at
```

- [ ] **Step 3: Implement document page data flow**

On mount:

1. Call `listDocuments()`.
2. Call `syncDocumentStatuses()` every 30 seconds.
3. Refresh list after upload or manual sync.

- [ ] **Step 4: Run document page tests**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm test -- src/pages/DocumentsPage.test.tsx
```

Expected: tests pass.

## Task 5: Implement Retrieval Layout Logic and Panels

**Files:**
- Create: `kgms-frontend/src/lib/retrievalLayout.ts`
- Create: `kgms-frontend/src/components/AnswerPanel.tsx`
- Create: `kgms-frontend/src/components/EvidencePanel.tsx`
- Create: `kgms-frontend/src/components/DiagnosticsBar.tsx`
- Test: `kgms-frontend/src/lib/retrievalLayout.test.ts`

- [ ] **Step 1: Write layout selection tests**

Verify:

- `native` shows answer only.
- `lightrag` shows answer and graph.
- `pageindex` shows answer and evidence.
- `hybrid` shows all panels.
- `smart` follows the returned response mode and available data.

- [ ] **Step 2: Implement layout selection**

Return:

```ts
{
  showGraph: boolean
  showEvidence: boolean
  variant: 'answer-only' | 'answer-graph' | 'answer-evidence' | 'full'
}
```

- [ ] **Step 3: Implement answer, evidence and diagnostics panels**

Answer panel renders markdown-like plain text safely as text blocks for the first version. Evidence panel shows first three PageIndex hits and supports expanding all hits.

- [ ] **Step 4: Run layout tests**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm test -- src/lib/retrievalLayout.test.ts
```

Expected: tests pass.

## Task 6: Implement Graph Panel

**Files:**
- Create: `kgms-frontend/src/components/GraphPanel.tsx`
- Create: `kgms-frontend/src/lib/entityColors.ts`
- Test: `kgms-frontend/src/lib/entityColors.test.ts`

- [ ] **Step 1: Write entity color tests**

Verify `equipment`, `country`, `event`, `action`, `force_unit` and unknown values return stable colors.

- [ ] **Step 2: Implement color fallback map**

Use the colors from `docs/superpowers/specs/2026-05-26-kgms-frontend-design.md`.

- [ ] **Step 3: Implement ECharts graph panel**

Map:

```ts
GraphNode -> echarts node
GraphEdge -> echarts link
```

Use `node.color || fallbackColor(node.entity_type)`.

- [ ] **Step 4: Run graph tests**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm test -- src/lib/entityColors.test.ts
```

Expected: tests pass.

## Task 7: Implement Retrieval Page

**Files:**
- Create: `kgms-frontend/src/components/RetrievalComposer.tsx`
- Create: `kgms-frontend/src/pages/RetrievalPage.tsx`
- Test: `kgms-frontend/src/pages/RetrievalPage.test.tsx`

- [ ] **Step 1: Write retrieval page tests**

Mock `queryRetrieval`. Verify selecting `pageindex` hides graph, selecting `lightrag` shows graph when returned, and `hybrid` renders answer, evidence and graph.

- [ ] **Step 2: Implement bottom input composer**

Mode selector options:

```ts
native, lightrag, pageindex, hybrid, smart
```

Default mode: `smart`.

- [ ] **Step 3: Implement retrieval page adaptive grid**

Use CSS classes based on `variant`:

- `answer-only`
- `answer-graph`
- `answer-evidence`
- `full`

- [ ] **Step 4: Run retrieval page tests**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm test -- src/pages/RetrievalPage.test.tsx
```

Expected: tests pass.

## Task 8: App Integration and Verification

**Files:**
- Modify: `kgms-frontend/src/App.tsx`
- Modify: `kgms-frontend/src/index.css`
- Create: `kgms-frontend/.env.example`

- [ ] **Step 1: Wire pages into AppShell**

App state controls the active page and renders `DocumentsPage`, `RetrievalPage` or `DomainConfigPage`.

- [ ] **Step 2: Add `.env.example`**

```env
VITE_KGMS_API_BASE_URL=http://127.0.0.1:8000
```

- [ ] **Step 3: Run full frontend tests and build**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm test
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 4: Start frontend dev server**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm run dev -- --port 5173
```

Expected: frontend available at `http://127.0.0.1:5173`.

## Task 9: Real Backend Smoke Test

**Files:**
- No planned source changes unless smoke test reveals a bug.

- [ ] **Step 1: Start KGMS Backend**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-backend
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- [ ] **Step 2: Use browser to verify**

Check:

- Document list loads existing `09III型核潜艇.pdf`.
- Sync status button returns without global failure.
- Retrieval page can query `09III型核潜艇的武器系统有哪些？`.
- `pageindex` mode shows evidence and hides graph.
- `lightrag` mode shows graph and hides evidence.
- `hybrid` mode shows answer, graph and evidence.

- [ ] **Step 3: Final verification**

Run:

```bash
cd /Users/mac/Documents/kgms/kgms-frontend
npm test
npm run build
```

Expected: all tests and build pass after smoke-test fixes.

