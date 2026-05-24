# KGMS LightRAG + PageIndex PoC 设计

日期：2026-05-24

## 目标

构建一个知识图谱检索系统的 PoC，组合使用：

- LightRAG：负责多模态文档解析、知识图谱抽取、图检索和 native 向量检索。
- PageIndex：负责基于文档结构和内容的检索。
- KGMS：作为编排层，提供自己的 API、元数据存储、PageIndex 任务、检索路由和前端。

PoC 必须支持 PDF 和 Office 文档，并能处理文本、图片和表格。系统需要提供文档管理界面、检索界面、证据展示、PageIndex 命中片段展示，以及在有图谱数据时展示小图谱。

## 已确认范围

第一阶段目标是 PoC，不是生产级部署。

范围内：

- FastAPI 后端、React 前端、Docker Compose 部署。
- LightRAG 作为独立服务运行，KGMS 通过 REST API 调用。
- PageIndex 由 KGMS 后端管理。
- 上传时选择索引目标：`lightrag`、`pageindex` 或 `both`，默认 `both`。
- 检索模式：`native`、`lightrag`、`pageindex`、`hybrid`、`smart`。
- 两个前端页面：文档管理页和检索页。
- 基于 LightRAG graph/query API 的小图谱展示。
- 通过 LightRAG prompt YAML 做轻量级军事领域抽取适配。
- KGMS 侧做最小规范化：展示、过滤和关系标签映射。

第一阶段不做：

- fork LightRAG 或修改 LightRAG 存储 schema。
- 在 LightRAG 内部把 `relation_type` 做成强 schema 字段。
- 完整军事本体、完整别名管理、自动实体合并、事件链推理或高精度抽取评测。
- KGMS 直接依赖 Neo4j/Cypher 做图查询。
- 生产级权限、多租户、审计和高可用。

后续事项：军事本体和规范化层在深入实现前需要单独讨论。PoC 先做轻量版。

## 外部参考

- LightRAG API Server：https://github.com/HKUDS/LightRAG/blob/main/docs/LightRAG-API-Server.md
- LightRAG Core 和存储后端：https://github.com/HKUDS/LightRAG/blob/main/docs/ProgramingWithCore.md
- LightRAG Advanced Features 和多模态解析：https://github.com/HKUDS/LightRAG/blob/main/docs/AdvancedFeatures.md
- PageIndex 仓库：https://github.com/VectifyAI/PageIndex

## 总体架构

采用旁路编排服务方案。

KGMS 作为独立后端和前端应用运行。LightRAG 作为独立容器或独立服务运行。KGMS 只通过 REST API 调用 LightRAG，不直接 import LightRAG Core。

主要服务：

- KGMS Frontend：文档管理、检索模式选择、证据展示、PageIndex 片段展示、小图谱展示。
- KGMS Backend：上传编排、KGMS 元数据、PageIndex 索引、状态聚合、检索路由、hybrid 融合、轻量领域规范化。
- LightRAG Server：文件解析、多模态 sidecar、VLM 分析、实体/关系抽取、图存储、native 向量检索、图检索。
- 存储和外部服务：Postgres 存 KGMS 元数据，KGMS 文件卷存原始文件和 PageIndex 工件；LightRAG 使用它自己配置的存储后端；MinerU、Docling、VLM 和模型服务按配置接入。

这个方案避免 fork LightRAG，后续 LightRAG 升级成本较低。

## LightRAG 中间件

LightRAG 有 4 类逻辑存储：

- `KV_STORAGE`：LLM cache、chunks、文档数据。
- `VECTOR_STORAGE`：实体、关系、chunk 的 embedding。
- `GRAPH_STORAGE`：实体关系图。
- `DOC_STATUS_STORAGE`：文档索引状态。

PoC 应按 LightRAG 支持的 Docker 配置选择中间件，不绕过 LightRAG 自己的存储接口。推荐服务化配置：

- `PGKVStorage` 和 `PGDocStatusStorage` 使用 Postgres；如果先追求最小可运行，也可以使用 LightRAG 默认文件存储。
- `MilvusVectorDBStorage` 使用 Milvus；Milvus 自带 etcd 和 MinIO 作为内部组件。
- `Neo4JStorage` 或 `MemgraphStorage` 作为图存储，具体按 LightRAG compose profile 选择。
- MinerU 和/或 Docling endpoint 用于 PDF、Office、图片和表格解析。
- 如果图片和表格分析需要进入索引，启用 `VLM_PROCESS_ENABLE=true` 并配置 VLM model。
- `LLM_BINDING_HOST`、`EMBEDDING_BINDING_HOST`、`RERANK_BINDING_HOST` 使用 OpenAI-compatible 地址，可以指向云端 API 或内网 base_url。

KGMS 启动时要做能力检查：

- LightRAG health endpoint 可访问。
- 必要的文档 API 可访问。
- 必要的 graph/query API 可访问。
- 如果多模态 parser 或 VLM 配置缺失，在文档页显示配置警告。

## 存储边界

KGMS 不把大文件或完整 PageIndex workspace 存进 Postgres。

原始文件：

- 存在 KGMS 文件卷或可替换成对象存储的路径：
  `/data/kgms/uploads/{sha256}/{original_filename}`
- Postgres 只存元数据：文件名、MIME、大小、SHA-256、存储路径、上传时间、LightRAG ids、PageIndex ids 和状态。

LightRAG 数据：

- LightRAG 管理自己的存储、input volume 和 parsed volume。
- KGMS 只保存 LightRAG `track_id`、已知的 `doc_id`、状态和错误摘要。
- KGMS 不复制 LightRAG 向量、图谱或内部 sidecar。只有为了前端展示产生的派生元数据，才进入 KGMS 自己的表。

PageIndex 数据：

- 完整 PageIndex 工件放在：
  `/data/kgms/pageindex/{document_id}/`
- 建议包含：
  - `workspace/`
  - `tree.json`
  - `blocks.jsonl`
  - 配置和 model hash 元数据
- Postgres 保存可查询、可展示的结构：
  - `pageindex_jobs`
  - `pageindex_indexes`
  - `pageindex_nodes`
  - `document_blocks`

结论：Postgres 是 KGMS 的元数据和展示结构数据库，不是大文件仓库。

## 后端组件

### Document Service

职责：

- 保存上传文件。
- 创建 KGMS 文档元数据。
- 接收 `index_targets`。
- 启动 LightRAG 上传任务和/或 PageIndex 任务。
- 聚合 LightRAG 和 PageIndex 状态。
- 删除 KGMS 文件、PageIndex 工件，并在需要时调用 LightRAG 删除接口。

核心 API：

- `POST /api/documents/upload`
  - multipart upload
  - `index_targets`：`both | lightrag | pageindex`
  - 默认：`both`
- `GET /api/documents`
  - 分页文档列表
  - 返回 KGMS 元数据、LightRAG 状态、PageIndex 状态和错误
- `POST /api/documents/{id}/pageindex/rebuild`
  - 只重建 PageIndex，不重建 LightRAG
- `DELETE /api/documents/{id}`
  - 删除 KGMS 自有数据，并在适用时请求 LightRAG 删除对应文档

LightRAG 重建策略：

- 如果 parser、embedding、storage 或领域 prompt 配置变化，要求删除后重新上传。
- PageIndex 可以独立重建。

### LightRAG Client

职责：

- 封装 LightRAG REST API，给 KGMS 内部提供稳定调用接口。
- 上传文档到 LightRAG。
- 轮询 LightRAG 文档状态和 pipeline 状态。
- 执行 LightRAG 检索模式。
- 获取 query data 和 graph 子图。

预期使用的 LightRAG API：

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

职责：

- 创建和跟踪 PageIndex job。
- 从 KGMS 文档文本块或可复用解析内容构建 PageIndex index。
- 把 PageIndex 工件写入文件卷。
- 把前端展示和查询需要的结构同步到 Postgres。
- 执行 PageIndex 检索并返回 node/block references。

PageIndex 构建时要尽量保留：

- document id
- 文件路径
- 页码
- heading path
- block id
- 文本、表格文本、图片说明
- 来源模态

### Retrieval Orchestrator

统一 API：

- `POST /api/retrieval/query`

请求字段：

- `query`
- `mode`：`native | lightrag | pageindex | hybrid | smart`
- `top_k`
- 可选 filters
- `include_graph`
- `include_pageindex_snippets`

模式行为：

- `native`：调用 LightRAG `naive` mode。
- `lightrag`：默认调用 LightRAG `mix` mode；需要结构化上下文时使用 `/query/data`。
- `pageindex`：只查询 PageIndex。
- `hybrid`：并行查询 LightRAG 和 PageIndex，再合并证据。
- `smart`：使用确定性规则：
  - 关系、链路、参与方、单位、装备、事件类问题优先 LightRAG。
  - 页码、原文、证据位置、章节内容类问题优先 PageIndex。
  - 不确定时走 hybrid。

响应结构：

- `answer`
- `mode_used`
- `route_reason`
- `sources`
- `pageindex_hits`
- `graph`
- `diagnostics`

Hybrid 失败策略：

- LightRAG 失败但 PageIndex 成功：降级到 PageIndex，并在 diagnostics 中说明。
- PageIndex 失败但 LightRAG 成功：降级到 LightRAG，并在 diagnostics 中说明。
- 两者都失败：返回错误，不编造答案。

### Military Domain Adapter

第一版只做轻量适配。

LightRAG prompt profile：

- 挂载 `./data/prompts:/app/data/prompts`
- 设置 `PROMPT_DIR=/app/data/prompts`
- 添加 `./data/prompts/entity_type/military.yml`
- 设置 `ENTITY_TYPE_PROMPT_FILE=military.yml`

初始节点类型：

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

初始动作处理：

- 事件和动作都作为节点。
- 动作节点必须至少有一个锚点：主体、目标、地点、时间或所属事件。
- 避免为低价值动词创建动作节点，例如“显示”“指出”“包括”“提到”等。

KGMS 侧最小规范化：

- 为图展示提供类型到颜色/图标的映射。
- 展示时过滤停用动作。
- 做关系关键词到展示标签的映射。
- 第一版不做自动实体合并。

## 小图谱展示

KGMS 首先使用 LightRAG graph/query API，不直接查询 Neo4j。

图数据策略：

1. 如果 `/query/data` 返回的 entities 和 relationships 已经足够，直接用它们构造小图谱。
2. 如果需要更多上下文，从查询结果中选择 1 到 3 个种子实体。
3. 调用 `/graphs?label=<entity>&max_depth=1|2&max_nodes=50`。
4. KGMS 做去重、裁剪、节点/边标签映射，并返回前端友好的 graph。

前端图谱行为：

- 节点按实体、事件、动作类型着色。
- 边使用映射后的 `keywords` 展示。
- 点击节点或边时展示描述和可用的证据/来源链接。

第一版不直接使用 Neo4j/Cypher。只有当 LightRAG graph API 无法满足路径查询或复杂过滤时，再增加 KGMS 的只读图查询接口。

## 入库流程

1. 用户在 KGMS 上传文件并选择索引目标，默认 `both`。
2. KGMS 保存原始文件并创建 `documents` 记录。
3. 如果选择 LightRAG：
   - KGMS 把文件上传到 LightRAG。
   - KGMS 记录 LightRAG `track_id`。
   - LightRAG 执行 parser routing、多模态分析、chunking、抽取和索引。
   - KGMS 轮询 LightRAG 状态，并在文档列表中展示。
4. 如果选择 PageIndex：
   - KGMS 创建 `pageindex_jobs` 记录。
   - PageIndex worker 提取或复用文本块，构建 PageIndex tree/index，写入工件，并同步展示结构到 Postgres。
5. 文档页分别显示 LightRAG 和 PageIndex 的独立状态。

## 检索流程

1. 用户输入问题并选择检索模式。
2. KGMS route planner 把 `smart` 解析为实际路由，或执行固定模式逻辑。
3. KGMS 执行所需 retrievers。
4. KGMS 汇总答案和证据：
   - LightRAG chunks、entities、relationships
   - PageIndex tree nodes 和 block snippets
5. 如果请求包含图谱，KGMS 构建小图谱。
6. KGMS 返回统一响应给前端。
7. 前端展示 answer、sources、PageIndex hits、diagnostics 和 graph。

## 前端设计

文档管理页：

- 上传控件
- 索引目标选择
- 文档列表
- LightRAG 状态
- PageIndex 状态
- 错误详情
- PageIndex rebuild 操作
- 删除文档操作

检索页：

- 查询输入框
- mode selector
- answer panel
- route reason 和耗时
- evidence panel
- 可展开原文片段的 PageIndex hits
- small graph panel
- partial failure diagnostics panel

PageIndex 结果展示：

- 文档名
- 页码或 block id
- heading path
- 摘要
- 可展开的原文、表格文本或图片说明片段

## 错误处理

- LightRAG 不可用：
  - KGMS 将 LightRAG 状态标记为 `unknown` 或 `unavailable`。
  - PageIndex-only 操作可以继续。
- PageIndex job 失败：
  - 持久化失败状态和错误摘要。
  - 允许重建 PageIndex。
- Hybrid 部分失败：
  - 返回成功 retriever 的结果，并写入 diagnostics。
- 多模态能力缺失：
  - 在文档页显示启动或配置警告。
- 重复文件：
  - 使用 SHA-256 检测。
  - 可复用 KGMS 文件元数据。
  - 允许重建 PageIndex。
- LightRAG 配置变更：
  - 受影响文档需要删除并重新上传。

## 测试策略

后端单元测试：

- 文档元数据创建
- 状态聚合
- PageIndex job 状态流转
- 检索路由规则
- hybrid 降级行为
- 轻量领域规范化

LightRAG client 测试：

- mock upload
- mock status polling
- mock query/query-data
- mock graph APIs

PageIndex service 测试：

- 使用小型文本 fixture 构建 index
- 持久化 artifacts
- 同步 nodes 和 blocks
- 查询并返回 block references

API 集成测试：

- 使用 `both` 上传
- 使用 `pageindex` 上传
- 使用 `lightrag` 上传
- PageIndex rebuild
- hybrid query 中一个 retriever 失败

前端测试：

- 文档表格状态渲染
- 上传目标 selector
- 检索结果渲染
- PageIndex snippet 展开
- graph 空状态和有数据状态

手动 PoC 验收：

- 导入一个 PDF 和一个 DOCX，内容包含文本、图片和表格。
- 默认 `both` 索引完成，或明确显示部分失败原因。
- `native`、`lightrag`、`pageindex`、`hybrid`、`smart` 都能返回可解释结果。
- PageIndex 结果能显示原文位置和可展开片段。
- 图谱相关问题能显示小图谱。

## 风险

- LightRAG 多模态能力依赖具体安装版本以及 parser/VLM 配置。KGMS 必须显示明确的能力警告。
- 军事动作节点容易产生噪声。第一版只做轻量过滤，更深的本体和规范化推迟到后续讨论。
- PageIndex 可能需要适配器，才能稳定消费带引用信息的多模态解析块。
- Hybrid 答案融合需要在看到真实检索输出后调 prompt。
- 直接图谱编辑和实体合并应保持人工触发，或推迟到抽取质量更清楚之后。
