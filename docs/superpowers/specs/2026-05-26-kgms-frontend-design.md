# KGMS 前端 MVP 设计

日期：2026-05-26

## 目标

实现 KGMS 第一版前端工作台，前端只调用 KGMS Backend，不直接调用 LightRAG 或 PageIndex。

第一版前端需要支持：

- 文档上传。
- 文档列表和抽取/索引状态展示。
- LightRAG 和 PageIndex 状态同步。
- 知识检索。
- 检索模式选择：`native`、`lightrag`、`pageindex`、`hybrid`、`smart`。
- 回答展示。
- PageIndex 原文证据展示。
- LightRAG 小图谱展示。
- 根据检索模式自适应显示回答、证据和小图谱区域。

第一版不做：

- 复杂权限、多用户和审计。
- 完整文档详情页。
- 可编辑图谱。
- 完整本体管理页面。
- 项目或 workspace 级 LightRAG 隔离。

## 技术方案

采用：

- Vite
- React
- TypeScript
- Tailwind CSS
- ECharts graph

理由：

- 当前仓库还没有前端，Vite + React 启动成本低。
- KGMS 是本地和内网工作台，不需要 Next.js 的 SSR 和路由复杂度。
- Tailwind 适合快速实现安静、密集、工作台式 UI。
- ECharts graph 能直接消费后端返回的小图谱节点和边，支持缩放、拖拽、tooltip、节点颜色和边标签。

后续如果 UI 需要进一步标准化，可以引入 shadcn/ui 或 Ant Design；如果图谱交互明显变复杂，可以再替换为 Sigma.js + graphology。

## 页面结构

前端采用左侧导航工作台布局。

主页面：

- 文档管理
- 知识检索
- 领域配置，第一版只保留导航入口；点击后显示“领域本体配置将在后续版本开放”，不实现编辑能力。

左侧导航固定，主内容区域根据当前页面切换。

## 文档管理页

文档管理页采用“顶部操作栏 + 状态摘要 + 文档表格”的结构。

顶部区域：

- 页面标题：文档管理。
- 简短说明：上传文档，跟踪 LightRAG 图谱抽取与 PageIndex 内容索引状态。
- 操作按钮：
  - 上传文档。
  - 同步状态。
  - 刷新。

状态摘要：

- 文档总数。
- LightRAG 完成数量。
- PageIndex 同步数量。
- 异常任务数量。

文档表格字段：

- 文件名。
- 文件大小。
- LightRAG `doc_id` 或 `track_id` 摘要。
- PageIndex `doc_id` 摘要。
- 索引目标。
- LightRAG 状态。
- PageIndex 状态。
- 更新时间。
- 操作。

状态颜色：

- `completed`：绿色。
- `synced`：蓝色。
- `processing`、`uploaded`、`pending`：黄色或灰色。
- `failed`：红色。
- `skipped`：灰色。

上传交互：

- 点击“上传文档”打开弹窗或右侧抽屉。
- 用户选择文件。
- 用户选择索引目标：
  - `both`
  - `lightrag`
  - `pageindex`
- 默认值为 `both`。
- 上传成功后刷新文档列表。

状态同步：

- 手动点击“同步状态”调用 `POST /api/documents/sync-status`。
- 页面打开后可以定时同步，建议 30 秒一次。
- 同步完成后调用 `GET /api/documents` 刷新列表。
- 单个文档失败时不弹全局错误遮罩，只在该行显示错误状态和错误摘要。

## 知识检索页

知识检索页采用“上方结果区 + 底部固定输入栏”的结构。

顶部标题区域：

- 页面标题：知识检索。
- 状态标签：
  - 当前文档数量。
  - LightRAG 在线状态。
  - PageIndex 在线状态。

结果区：

- 回答面板。
- PageIndex 原文证据面板。
- LightRAG 小图谱面板。
- 诊断信息条。

底部输入栏：

- 左侧为检索模式选择。
- 中间为问题输入框。
- 右侧为发送按钮。

检索模式选择不平铺展示 5 个按钮，而使用紧凑下拉或 segmented menu。默认建议为 `smart` 或 `hybrid`，实现时可先使用 `smart`。

## 检索模式自适应布局

前端根据后端返回的实际 `mode`、`graph` 和 `pageindex_hits` 决定结果区布局。

`native`：

- 显示回答面板。
- 显示来源信息。
- 隐藏 PageIndex 原文证据面板。
- 隐藏小图谱面板。
- 回答面板占满主结果区域。

`lightrag`：

- 显示回答面板。
- 显示小图谱面板。
- 隐藏 PageIndex 原文证据面板。
- 回答和小图谱左右分栏。

`pageindex`：

- 显示回答面板。
- 显示 PageIndex 原文证据面板。
- 隐藏小图谱面板。
- 回答面板扩大，证据面板位于下方。

`hybrid`：

- 显示回答面板。
- 显示 PageIndex 原文证据面板。
- 显示小图谱面板。
- 回答和小图谱左右分栏，证据面板放在回答下方。

`smart`：

- 按后端返回的实际 `mode` 和数据决定布局。
- 如果后端路由到 PageIndex，则使用 PageIndex 布局。
- 如果后端路由到 LightRAG，则使用 LightRAG 布局。
- 如果后端路由到 hybrid，则使用完整布局。

空状态：

- graph 为空：显示“本次未召回图谱”。
- `pageindex_hits` 为空：显示“未找到原文证据”。
- answer 为空且 diagnostics 有错误：显示错误摘要和重试入口。

## 自适应尺寸规则

桌面端优先。

宽屏，视口宽度大于等于 1200px：

- 回答面板最小宽度约 560px。
- 小图谱面板最小宽度约 320 到 340px。
- 小图谱面板在右侧，并尽量占满右侧高度。
- PageIndex 证据面板默认高度约 140 到 220px。
- 证据较多时展示前 3 条，并提供展开全部。

窄屏或小窗口，视口宽度小于 1200px：

- 回答、图谱、证据改为上下堆叠。
- 小图谱可以折叠。
- 底部输入栏保持固定在底部。

滚动规则：

- 页面整体尽量不出现复杂嵌套滚动。
- 回答面板内部可滚动。
- 证据面板内部可滚动。
- 图谱面板内部不滚动，使用图谱自身缩放和平移。
- 底部输入栏固定高度，输入多行时最多扩展到约 120px。

## 小图谱渲染

第一版使用 ECharts graph。

后端输入结构：

```json
{
  "nodes": [
    {
      "id": "09III型核潜艇",
      "label": "09III型核潜艇",
      "entity_type": "equipment",
      "display_name": "装备",
      "color": "#0891b2",
      "properties": {}
    }
  ],
  "edges": [
    {
      "source": "09III型核潜艇",
      "target": "鹰击-18",
      "label": "搭载",
      "properties": {}
    }
  ]
}
```

渲染规则：

- 节点名称使用 `label`。
- 节点颜色必须按实体类型统一。
- 节点颜色优先使用后端 `color`。
- 如果后端没有返回 `color`，前端使用本地 `entity_type` 颜色 fallback。
- 节点分类显示 `display_name`。
- 边标签使用 `label`。
- tooltip 展示：
  - 节点名。
  - 节点类型。
  - 主要 properties。
  - 边关系标签。
- 小图谱默认 force layout。
- 节点数量过多时只展示后端返回的小图谱，不在前端扩展查询。

实体类型颜色规范：

| entity_type | 中文显示 | 颜色 |
| --- | --- | --- |
| `country` | 国家 | `#c2410c` |
| `force_unit` | 部队/军事力量 | `#1d4ed8` |
| `organization` | 组织机构 | `#475569` |
| `person` | 人员 | `#7c3aed` |
| `equipment` | 装备 | `#0891b2` |
| `facility` | 设施 | `#92400e` |
| `location` | 地点 | `#16a34a` |
| `region` | 区域 | `#4d7c0f` |
| `event` | 事件 | `#ea580c` |
| `action` | 动作 | `#ca8a04` |
| `capability` | 能力 | `#0f766e` |
| `indicator` | 指标/属性值 | `#db2777` |
| `resource` | 资源 | `#a16207` |
| `time` | 时间 | `#64748b` |
| `plan` | 计划/方案 | `#4338ca` |
| `document` | 文档/资料 | `#94a3b8` |
| `other` | 其他 | `#737373` |

图谱面板需要展示一个轻量图例。图例只显示当前结果中出现的实体类型，避免占用过多空间。颜色语义在文档管理页、检索页和后续图谱详情页中保持一致。

## API 对接

基础配置：

- 前端使用环境变量配置 KGMS Backend 地址。
- 默认开发地址可设为 `http://127.0.0.1:8000` 或当前启动端口。

文档 API：

- `GET /api/documents`
- `POST /api/documents/upload`
- `POST /api/documents/sync-status`
- `POST /api/documents/{document_id}/lightrag/sync`
- `POST /api/documents/{document_id}/pageindex/sync`

检索 API：

- `POST /api/retrieval/query`

检索请求：

```json
{
  "query": "09III型核潜艇的武器系统有哪些？",
  "mode": "hybrid",
  "top_k": 5,
  "filters": {},
  "include_graph": true,
  "include_pageindex_snippets": true
}
```

检索响应重点字段：

- `answer`
- `mode`
- `route_reason`
- `sources`
- `pageindex_hits`
- `graph`
- `diagnostics`

## 组件拆分

建议目录：

```text
kgms-frontend/
  src/
    api/
      client.ts
      documents.ts
      retrieval.ts
    components/
      AppShell.tsx
      StatusBadge.tsx
      DocumentTable.tsx
      UploadDialog.tsx
      RetrievalComposer.tsx
      AnswerPanel.tsx
      EvidencePanel.tsx
      GraphPanel.tsx
      DiagnosticsBar.tsx
      EmptyState.tsx
    pages/
      DocumentsPage.tsx
      RetrievalPage.tsx
      DomainConfigPage.tsx
    types/
      api.ts
```

组件职责：

- `AppShell`：左侧导航和主内容容器。
- `StatusBadge`：统一渲染文档状态。
- `DocumentTable`：展示文档列表和行操作。
- `UploadDialog`：上传文件并选择索引目标。
- `RetrievalComposer`：底部输入栏、模式选择和发送。
- `AnswerPanel`：展示回答、来源和复制操作。
- `EvidencePanel`：展示 PageIndex 原文证据。
- `GraphPanel`：封装 ECharts graph。
- `DiagnosticsBar`：展示路由原因、耗时和降级错误。
- `EmptyState`：统一空状态。

## 加载与错误处理

文档页：

- 上传中显示按钮 loading。
- 上传失败显示 toast，并保留弹窗内容。
- 同步状态中显示顶部按钮 loading。
- 同步返回 errors 时显示轻量提示，并在表格行展示错误。

检索页：

- 查询中禁用发送按钮。
- 当前问题显示为用户消息或输入历史摘要。
- 检索中在回答区显示 loading skeleton。
- LightRAG 或 PageIndex 单路失败时，显示 diagnostics，不清空另一方成功结果。
- 两路都失败时显示错误面板和重试按钮。

## 测试与验收

最低验收项：

- 前端能启动并访问。
- 文档管理页能拉取已有文档。
- 能上传 PDF，并选择索引目标。
- 能手动同步状态。
- 文档状态能正确显示 LightRAG 和 PageIndex 状态。
- 检索页能选择 5 种模式并调用后端。
- native 模式只显示回答。
- lightrag 模式显示回答和小图谱。
- pageindex 模式显示回答和 PageIndex 证据。
- hybrid 模式显示回答、小图谱和 PageIndex 证据。
- smart 模式按后端返回结果自适应。
- 小图谱节点颜色、标签和边标签可见。
- 页面在桌面宽度下没有明显文本重叠或面板挤压。

建议验证方式：

- 单元测试覆盖 API client 和布局选择函数。
- 使用 Playwright 或浏览器手动验证文档页和检索页主流程。
- 使用真实 KGMS Backend 验证一次 `09III型核潜艇.pdf` 的检索结果。
