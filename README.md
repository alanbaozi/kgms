# KGMS

KGMS is a knowledge graph retrieval prototype that integrates LightRAG with a
FastAPI backend and React frontend.

## Components

- `kgms-backend`: API orchestration layer for documents, retrieval, knowledge graph views, and configuration.
- `kgms-frontend`: Web UI for document management, retrieval, graph visualization, and system/domain settings.
- `deploy/lightrag-server`: Docker Compose examples for running LightRAG with Postgres, Redis, Neo4j, Milvus, etcd, and MinIO.

## Local Development

Backend:

```bash
cd kgms-backend
cp .env.example .env
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd kgms-frontend
npm install
npm run dev
```

Never commit real `.env` files, API keys, server IPs, local databases, logs, or offline deployment bundles.

