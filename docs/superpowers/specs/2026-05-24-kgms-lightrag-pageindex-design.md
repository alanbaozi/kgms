# KGMS LightRAG + PageIndex PoC Design

Date: 2026-05-24

## Purpose

Build a proof-of-concept knowledge graph retrieval system that combines:

- LightRAG for multimodal document parsing, knowledge graph extraction, graph retrieval, and native vector retrieval.
- PageIndex for document-structure/content retrieval over parsed document content.
- KGMS as an orchestration layer with its own API, metadata store, PageIndex jobs, retrieval routing, and frontend.

The PoC must support PDF and Office documents, including text, images, and tables. It should expose a document management interface, a retrieval interface, evidence display, PageIndex snippets, and a small graph visualization when graph data is available.

## Confirmed Scope

The first implementation target is a PoC, not a production deployment.

In scope:

- FastAPI backend, React frontend, Docker Compose deployment.
- LightRAG as a separate service accessed by REST API.
- PageIndex managed inside KGMS backend.
- Upload-time index target selection: `lightrag`, `pageindex`, or `both`; default is `both`.
- Query modes: `native`, `lightrag`, `pageindex`, `hybrid`, and `smart`.
- Two frontend pages: document management and retrieval.
- Small graph visualization based on LightRAG graph/query APIs.
- Lightweight military-domain extraction via LightRAG prompt YAML.
- Minimal KGMS-side normalization for display, filtering, and relation labels.

Out of scope for the first PoC:

- Forking LightRAG or changing LightRAG storage schema.
- Strong first-class `relation_type` support inside LightRAG.
- Full military ontology, full alias management, automatic entity merge, event-chain reasoning, or high-precision extraction evaluation.
- Direct KGMS dependency on Neo4j/Cypher for graph queries.
- Production-grade auth, tenancy, audit trails, and HA deployment.

Follow-up item for implementation planning: the military ontology and normalization layer need a separate focused discussion before deeper implementation. The PoC starts with a lightweight version only.

## External References

- LightRAG API Server: https://github.com/HKUDS/LightRAG/blob/main/docs/LightRAG-API-Server.md
- LightRAG Core and storage backends: https://github.com/HKUDS/LightRAG/blob/main/docs/ProgramingWithCore.md
- LightRAG advanced features and multimodal parsing: https://github.com/HKUDS/LightRAG/blob/main/docs/AdvancedFeatures.md
- PageIndex repository: https://github.com/VectifyAI/PageIndex

## Architecture

Use the sidecar orchestration approach.

KGMS runs as its own backend/frontend application. LightRAG runs as an independent container or service. KGMS calls LightRAG through REST APIs and does not import LightRAG Core.

Primary services:

- KGMS Frontend: document management, query mode selection, evidence display, PageIndex snippet display, small graph view.
- KGMS Backend: upload orchestration, KGMS metadata, PageIndex indexing, status aggregation, retrieval routing, hybrid fusion, lightweight domain normalization.
- LightRAG Server: file parsing, multimodal sidecars, VLM analysis, entity/relation extraction, graph storage, native/vector retrieval, graph retrieval.
- Storage/services: Postgres for KGMS metadata, KGMS file volume for original files and PageIndex artifacts, LightRAG-selected storage backends, MinerU/Docling/VLM/model providers as configured.

This avoids a LightRAG fork and keeps LightRAG upgrades practical.

## LightRAG Middleware

LightRAG uses four logical storage types:

- `KV_STORAGE`: LLM cache, chunks, document data.
- `VECTOR_STORAGE`: entity, relation, and chunk embeddings.
- `GRAPH_STORAGE`: entity-relation graph.
- `DOC_STATUS_STORAGE`: indexing status.

The PoC should follow LightRAG-supported Docker configuration rather than inventing storage access. Recommended service-style setup:

- `PGKVStorage` and `PGDocStatusStorage` on Postgres, or LightRAG defaults for a simpler run.
- `MilvusVectorDBStorage` on Milvus for vector storage, with Milvus-managed etcd and MinIO.
- `Neo4JStorage` or `MemgraphStorage` for graph storage, depending on the LightRAG compose profile chosen.
- MinerU and/or Docling endpoints for PDF/Office/image/table parsing.
- `VLM_PROCESS_ENABLE=true` and VLM model settings when image/table analysis must enter the index.
- OpenAI-compatible `LLM_BINDING_HOST`, `EMBEDDING_BINDING_HOST`, and `RERANK_BINDING_HOST` can point to cloud or internal base URLs.

KGMS must include startup capability checks:

- LightRAG health endpoint is reachable.
- Required document APIs are reachable.
- Required graph/query APIs are reachable.
- Multimodal parser/VLM configuration warnings are surfaced if missing.

## Storage Boundaries

KGMS should not store large binary files or complete PageIndex workspaces in Postgres.

Original files:

- Store in KGMS file volume/object-store-compatible path:
  `/data/kgms/uploads/{sha256}/{original_filename}`
- Postgres stores metadata only: file name, MIME type, size, SHA-256, storage path, upload time, LightRAG ids, PageIndex ids, and statuses.

LightRAG data:

- LightRAG owns its own storage and input/parsed volumes.
- KGMS stores LightRAG `track_id`, `doc_id` when known, status, and error summaries.
- KGMS does not copy LightRAG vectors, graph data, or internal sidecars into its own database unless needed as derived display metadata.

PageIndex data:

- Complete PageIndex artifacts live under:
  `/data/kgms/pageindex/{document_id}/`
- Suggested files include:
  - `workspace/`
  - `tree.json`
  - `blocks.jsonl`
  - configuration/model hash metadata
- Postgres stores query/display structures:
  - `pageindex_jobs`
  - `pageindex_indexes`
  - `pageindex_nodes`
  - `document_blocks`

Postgres is the KGMS metadata and display-structure database, not the large artifact store.

## Backend Components

### Document Service

Responsibilities:

- Save uploaded files.
- Create KGMS document metadata.
- Accept `index_targets`.
- Start LightRAG upload and/or PageIndex job.
- Aggregate LightRAG and PageIndex statuses.
- Delete KGMS files/PageIndex artifacts and call LightRAG deletion when applicable.

Key APIs:

- `POST /api/documents/upload`
  - multipart upload
  - `index_targets`: `both | lightrag | pageindex`
  - default: `both`
- `GET /api/documents`
  - paginated document list
  - includes KGMS metadata, LightRAG status, PageIndex status, and errors
- `POST /api/documents/{id}/pageindex/rebuild`
  - allowed even when LightRAG is not rebuilt
- `DELETE /api/documents/{id}`
  - deletes KGMS-owned data and asks LightRAG to delete if applicable

LightRAG rebuild policy:

- If parser, embedding, storage, or domain prompt configuration changes, require delete and re-upload.
- PageIndex can be rebuilt independently.

### LightRAG Client

Responsibilities:

- Wrap LightRAG REST APIs with stable KGMS-facing methods.
- Upload documents to LightRAG.
- Poll LightRAG document and pipeline status.
- Execute LightRAG query modes.
- Fetch query data and graph subgraphs.

Expected LightRAG APIs:

- `POST /documents/upload`
- `GET /documents/track_status/{track_id}`
- `POST /documents/paginated`
- `GET /documents/status_counts`
- `GET /documents/pipeline_status`
- `POST /query`
- `POST /query/data`
- `GET /graph/label/search`
- `GET /graph/label/popular`
- `GET /graphs?label=...&max_depth=...&max_nodes=...`

### PageIndex Service

Responsibilities:

- Create and track PageIndex jobs.
- Build PageIndex indexes from KGMS-owned document text blocks or reusable parsed content when available.
- Store PageIndex artifacts on disk.
- Sync display/query structures to Postgres.
- Execute PageIndex searches and return node/block references.

PageIndex build should preserve:

- document id
- file path
- page number when available
- heading path when available
- block id
- text/table/image-description content
- source modality

### Retrieval Orchestrator

Unified API:

- `POST /api/retrieval/query`

Request fields:

- `query`
- `mode`: `native | lightrag | pageindex | hybrid | smart`
- `top_k`
- optional filters
- `include_graph`
- `include_pageindex_snippets`

Mode behavior:

- `native`: call LightRAG `naive` mode.
- `lightrag`: call LightRAG `mix` by default and use `/query/data` when structured context is needed.
- `pageindex`: query PageIndex only.
- `hybrid`: query LightRAG and PageIndex in parallel, then combine evidence.
- `smart`: use deterministic rules:
  - relationship, chain, actor, unit/equipment/event questions -> LightRAG
  - page, original wording, evidence location, section content questions -> PageIndex
  - uncertain cases -> hybrid

Response shape:

- `answer`
- `mode_used`
- `route_reason`
- `sources`
- `pageindex_hits`
- `graph`
- `diagnostics`

Hybrid failure behavior:

- LightRAG failure with PageIndex success: downgrade to PageIndex and report diagnostic.
- PageIndex failure with LightRAG success: downgrade to LightRAG and report diagnostic.
- Both fail: return an error response without fabricating an answer.

### Military Domain Adapter

First PoC version is lightweight.

LightRAG prompt profile:

- Mount `./data/prompts:/app/data/prompts`
- Set `PROMPT_DIR=/app/data/prompts`
- Add `./data/prompts/entity_type/military.yml`
- Set `ENTITY_TYPE_PROMPT_FILE=military.yml`

Initial node types:

- `forceunit`
- `organization`
- `person`
- `platform`
- `weaponsystem`
- `sensor`
- `facility`
- `location`
- `document`
- `capability`
- `militaryevent`
- `militaryaction`
- `timepoint`
- `quantity`
- `coordinate`

Initial action handling:

- Events and actions are nodes.
- Action nodes must have at least one anchor: actor, target, location, time, or parent event.
- Avoid creating action nodes for low-value verbs such as "shows", "states", "includes", "mentions", and equivalent Chinese terms.

Minimal KGMS-side normalization:

- type-to-color/icon mapping for graph display
- stop-action filtering for display
- relation keyword display mapping
- no automatic entity merge in the first version

## Small Graph Display

KGMS should use LightRAG graph/query APIs first, not direct Neo4j queries.

Graph data strategy:

1. Use `/query/data` entities and relationships when enough context is returned.
2. If more context is needed, choose one to three seed entities from the query result.
3. Call `/graphs?label=<entity>&max_depth=1|2&max_nodes=50`.
4. KGMS deduplicates, trims, maps node/edge labels, and returns a frontend-friendly graph.

Frontend graph behavior:

- nodes colored by entity/event/action type
- edges labeled by mapped `keywords`
- clicking a node or edge shows description and evidence/source links when available

Direct Neo4j/Cypher is not part of the first PoC. Add it later only if LightRAG graph APIs cannot support required path or filtering queries.

## Ingestion Flow

1. User uploads a file in KGMS and chooses index target. Default is `both`.
2. KGMS stores the original file and creates a `documents` row.
3. If LightRAG is selected:
   - KGMS uploads the file to LightRAG.
   - KGMS records LightRAG `track_id`.
   - LightRAG runs parser routing, multimodal analysis, chunking, extraction, and indexing.
   - KGMS polls LightRAG status and shows it in the document list.
4. If PageIndex is selected:
   - KGMS creates a `pageindex_jobs` row.
   - The PageIndex worker extracts or reuses text blocks, builds the PageIndex tree/index, writes artifacts, and syncs display structures to Postgres.
5. The document page displays independent LightRAG and PageIndex statuses.

## Query Flow

1. User enters a query and selects a mode.
2. KGMS route planner resolves `smart` into an actual route or runs fixed mode logic.
3. KGMS executes the required retrievers.
4. KGMS gathers answer/evidence:
   - LightRAG chunks/entities/relationships
   - PageIndex tree nodes and block snippets
5. KGMS builds the small graph if requested.
6. KGMS returns unified response to the frontend.
7. Frontend renders answer, sources, PageIndex hits, diagnostics, and graph.

## Frontend Design

Document management page:

- upload control
- index target selection
- document list
- LightRAG status
- PageIndex status
- error details
- PageIndex rebuild action
- delete document action

Retrieval page:

- query input
- mode selector
- answer panel
- route reason and timing
- evidence panel
- PageIndex hits with expandable original snippets
- small graph panel
- diagnostics panel for partial failures

PageIndex result display:

- document name
- page number or block id when available
- heading path
- summary
- expandable original text/table/image-description snippet

## Error Handling

- LightRAG unavailable:
  - KGMS marks LightRAG status as `unknown` or `unavailable`.
  - PageIndex-only operations can continue.
- PageIndex job failure:
  - Persist failure status and error summary.
  - Allow PageIndex rebuild.
- Hybrid partial failure:
  - Return the successful retriever result and diagnostics.
- Multimodal capability missing:
  - Surface startup/config warning in document page.
- Duplicate file:
  - Detect by SHA-256.
  - Reuse KGMS file metadata where practical.
  - Allow PageIndex rebuild.
- LightRAG reconfiguration:
  - Require delete and re-upload for affected documents.

## Testing Strategy

Backend unit tests:

- document metadata creation
- status aggregation
- PageIndex job transitions
- retrieval routing rules
- hybrid downgrade behavior
- lightweight domain normalization

LightRAG client tests:

- mock upload
- mock status polling
- mock query/query-data
- mock graph APIs

PageIndex service tests:

- build index from a small text fixture
- persist artifacts
- sync nodes and blocks
- query and return block references

API integration tests:

- upload with `both`
- upload with `pageindex`
- upload with `lightrag`
- PageIndex rebuild
- hybrid query with one retriever failing

Frontend tests:

- document table status rendering
- upload target selector
- retrieval result rendering
- PageIndex snippet expansion
- graph empty and populated states

Manual PoC acceptance:

- ingest one PDF and one DOCX containing text, images, and tables
- default `both` indexing completes or reports clear partial failure
- `native`, `lightrag`, `pageindex`, `hybrid`, and `smart` modes return interpretable results
- PageIndex results show original location and expandable snippets
- small graph appears for graph-relevant queries

## Open Risks

- LightRAG multimodal capability depends on the exact installed version and parser/VLM configuration. KGMS must show explicit capability warnings.
- Military action nodes can become noisy. First PoC only uses lightweight filtering; deeper ontology and normalization are deferred.
- PageIndex may require adapter work to consume parsed multimodal blocks with stable references.
- Hybrid answer fusion may need prompt tuning after seeing real retrieval outputs.
- Direct graph edits and entity merges should remain manual or deferred until extraction quality is better understood.
