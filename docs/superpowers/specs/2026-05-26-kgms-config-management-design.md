# KGMS 配置管理设计

## 目标

KGMS 需要提供两个可视化配置入口：

- 系统配置：查看和修改 KGMS 对 LightRAG、PageIndex、MinerU、LLM、Embedding、Rerank 的集成配置。
- 领域配置：查看和修改 LightRAG 军事领域实体类型、关系关键词、抽取 Prompt 和问答 Prompt。

开发阶段先在 `kgms-backend/mock/lightrag-server` 中维护一份本地 LightRAG 部署目录。正式部署时，KGMS 后端容器通过 volume 挂载服务器真实 LightRAG 部署目录，并把 `KGMS_MANAGED_LIGHTRAG_ROOT` 指向该挂载路径。

## 架构

KGMS 后端新增配置管理服务，负责读写两个文件域：

- KGMS 自身 `.env`：保存 `KGMS_LIGHTRAG_BASE_URL`、`KGMS_PAGEINDEX_API_KEY` 等 KGMS 集成配置。
- LightRAG 部署目录：保存 `.env`、`prompts/entity_type/military.yml`、`prompts/query/military_qa.md`。

前端只调用 KGMS 后端，不直接访问服务器文件或 Docker。后端接口返回密钥时只返回掩码和是否已设置，保存时允许写入真实值。

## 系统配置

系统配置页展示：

- LightRAG 服务地址，即 `KGMS_LIGHTRAG_BASE_URL`。
- KGMS 调用 LightRAG 的 API key。
- PageIndex base URL、API key、profile。
- LightRAG 的 LLM、query LLM、keyword LLM 配置。
- Embedding 模型、维度、base URL。
- Rerank 模型、base URL。
- MinerU token 和 VLM 配置。
- 当前管理的 LightRAG 部署目录和配置文件路径。

保存规则：

- 非密钥字段按表单值写入。
- 密钥字段为空表示保持原值不变。
- 密钥字段非空表示写入新值。
- 返回结果继续使用掩码，不返回真实密钥。

## 领域配置

领域配置页展示：

- 后端内置实体类型、中文显示名和颜色。
- 从 `military.yml` 中解析或回退得到的关系关键词。
- 完整 `military.yml` 文本。
- 完整 `military_qa.md` 文本。

保存规则：

- 保存前为原文件创建时间戳备份。
- `military.yml` 和 `military_qa.md` 分别保存。
- 当前版本不在 UI 中拆分结构化编辑实体类型，先通过原始 Prompt 文本保证可控和完整。

## 部署策略

本地开发：

- `KGMS_MANAGED_LIGHTRAG_ROOT=./mock/lightrag-server`
- KGMS 读写本地 mock 文件。
- LightRAG 服务地址仍可指向 `http://lightrag.example:9621` 做联调。

服务器部署：

- KGMS 后端容器挂载真实 LightRAG 部署目录。
- `KGMS_MANAGED_LIGHTRAG_ROOT=/managed/lightrag-server`
- 保存配置后提示需要重启 LightRAG。
- 自动重启 Docker 作为后续可选能力，默认关闭。

## 安全边界

- GET 接口不返回真实 API key/token。
- PUT 接口只允许修改白名单配置项。
- 文件路径由后端配置决定，前端不能传任意路径。
- Prompt 保存前创建备份。
- Docker 重启默认不启用，避免本地开发阶段误操作服务器服务。
