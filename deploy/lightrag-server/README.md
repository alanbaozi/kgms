# KGMS LightRAG Server 部署

目标服务器：`<server-ip>`

本目录部署 LightRAG 和中间件：

- LightRAG Server: `9621`
- Postgres/pgvector: LightRAG KV 与文档状态
- Redis: 后续可用于缓存/状态扩展
- Neo4j: 图存储
- Milvus + etcd + MinIO: 向量存储

真实 `.env` 不提交到 git。先复制模板：

```bash
cp .env.example .env
```

然后填写：

- `LLM_BINDING_API_KEY`
- `EMBEDDING_BINDING_API_KEY`
- `RERANK_BINDING_API_KEY`
- `VLM_LLM_BINDING_API_KEY`
- `MINERU_API_TOKEN`
- `POSTGRES_PASSWORD`
- `NEO4J_PASSWORD`
- `MINIO_ACCESS_KEY_ID`
- `MINIO_SECRET_ACCESS_KEY`

## LightRAG 版本

当前部署从官方源码 tag 构建本地镜像：

```yaml
build:
  context: ./lightrag-src
  dockerfile: Dockerfile
image: kgms/lightrag:v1.5.0rc2-source
```

不要使用 `ghcr.io/hkuds/lightrag:latest`。截至 2026-05-24，GHCR 的 `latest` 仍可能解析到 `v1.4.16`，该版本不会实际消费 `MINERU_API_TOKEN`、`LIGHTRAG_PARSER` 和 `ENTITY_TYPE_PROMPT_FILE`。

## 军事领域适配

LightRAG v1.5+ 使用 `ENTITY_TYPE_PROMPT_FILE` 加载实体类型说明和抽取示例：

```env
ENTITY_TYPE_PROMPT_FILE=military.yml
ENTITY_EXTRACTION_USE_JSON=true
```

`ENTITY_TYPES` 在 v1.5+ 已废弃，不再作为 KGMS 的主配置方式。实体类型闭集和抽取示例维护在：

```text
prompts/entity_type/military.yml
```

问答领域 prompt：

```text
prompts/query/military_qa.md
```

KGMS 后续调用 LightRAG `/query` 时，应把 `prompts/query/military_qa.md` 的内容作为 `user_prompt` 传入。直接使用 LightRAG WebUI 时，可手动粘贴到 User Prompt 设置里。

修改 `ENTITY_TYPE_PROMPT_FILE` 或 prompt 文件后，已经抽取入库的旧文档不会自动重算；需要删除旧文档并重新上传，或者清空数据卷后重新索引。

## 建议先加 swap

服务器当前内存较小。建议先加 4GB swap：

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
cp /etc/fstab /etc/fstab.bak.$(date +%Y%m%d%H%M%S)
printf '\n/swapfile none swap sw 0 0\n' >> /etc/fstab
free -h
```

如果 `fallocate` 不可用，改用：

```bash
dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
```

## Docker bridge sysctl

Docker 当前提示 bridge netfilter 未开启，可执行：

```bash
cat >/etc/sysctl.d/99-docker-bridge.conf <<'EOF'
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
EOF
modprobe br_netfilter
sysctl --system
```

## 启动

```bash
rm -rf lightrag-src
git clone --branch v1.5.0rc2 --single-branch https://github.com/HKUDS/LightRAG.git lightrag-src
docker compose pull postgres redis neo4j milvus milvus-etcd milvus-minio
docker compose build lightrag
docker compose up -d
docker compose ps
```

查看日志：

```bash
docker compose logs -f lightrag
```

健康检查：

```bash
curl http://127.0.0.1:9621/health
```

浏览器访问：

```text
http://<server-ip>:9621/webui
```

## KGMS 前后端部署

KGMS 前后端可以和 LightRAG 使用同一个 Compose 栈部署。先准备 KGMS 后端自己的环境文件：

```bash
cp kgms.env.example kgms.env
```

然后编辑 `kgms.env`：

- `KGMS_PAGEINDEX_API_KEY` 填 PageIndex API Key。
- `KGMS_LIGHTRAG_BASE_URL=http://lightrag:9621` 保持不变；这是 Compose 网络内访问 LightRAG 的地址。
- 如果允许 KGMS 在前端点击按钮重启 LightRAG，保持：

```env
KGMS_LIGHTRAG_RESTART_ENABLED=true
KGMS_LIGHTRAG_RESTART_STRATEGY=docker_socket
KGMS_LIGHTRAG_CONTAINER_NAME=kgms-lightrag
```

`kgms-backend` 会挂载：

- `./.env` 到 `/managed/lightrag-server/.env`
- `./prompts` 到 `/managed/lightrag-server/prompts`
- `./kgms.env` 到 `/app/config/kgms.env`

因此系统配置页会读取和修改服务器真实的 LightRAG `.env`，领域配置页会读取和修改服务器真实的 `military.yml` 与 `military_qa.md`。

启动 KGMS：

```bash
docker compose build kgms-backend kgms-frontend
docker compose up -d kgms-backend kgms-frontend
docker compose ps
```

也可以使用脚本自动检查并启动：

```bash
./scripts/bootstrap-kgms.sh
```

浏览器访问 KGMS：

```text
http://<server-ip>:8080
```

KGMS 前端通过 Nginx 把 `/api` 反向代理到 `kgms-backend`，不需要单独暴露后端端口。

安全说明：`kgms-backend` 挂载 `/var/run/docker.sock` 后具备 Docker 控制能力。只应在可信内网或受防火墙保护的服务器上启用。若不希望 KGMS 自动重启 LightRAG，可以把 `KGMS_LIGHTRAG_RESTART_ENABLED=false`，保存配置后手动执行：

```bash
docker compose restart lightrag
```

## Smoke test

查询 health：

```bash
curl -s http://127.0.0.1:9621/health | python3 -m json.tool | head -80
```

检查 prompt 是否挂载：

```bash
docker compose exec lightrag ls -l /app/data/prompts/entity_type/military.yml
docker compose exec lightrag ls -l /app/data/prompts/query/military_qa.md
```

上传测试文档：

```bash
printf '第72合成旅在东部沿海训练区组织联合防空演练。' >/tmp/kgms-test.txt
curl -F "file=@/tmp/kgms-test.txt" http://127.0.0.1:9621/documents/upload
```

查询：

```bash
curl -s http://127.0.0.1:9621/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"第72合成旅在哪里组织演练？","mode":"mix"}'
```

## 端口策略

默认只把 Neo4j 和 Milvus 管理端口绑定到 `127.0.0.1`，避免直接暴露到公网。需要远程访问 Neo4j Browser 时，建议用 SSH tunnel：

```bash
ssh -L 7474:127.0.0.1:7474 -L 7687:127.0.0.1:7687 root@<server-ip>
```

## 重新索引规则

以下配置变更后，需要清空 LightRAG 数据并重新上传文档：

- `EMBEDDING_MODEL`
- `EMBEDDING_DIM`
- `EMBEDDING_SEND_DIM`
- `LIGHTRAG_PARSER`
- `ENTITY_TYPE_PROMPT_FILE`
- `VLM_PROCESS_ENABLE`

清理所有容器和数据卷：

```bash
docker compose down -v
```
