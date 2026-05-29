#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/../.." && pwd)"

cd "${DEPLOY_DIR}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令：$1" >&2
    exit 1
  fi
}

env_value() {
  local file="$1"
  local key="$2"
  if [ ! -f "${file}" ]; then
    return 0
  fi
  awk -F= -v key="${key}" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "${file}"
}

replace_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "${file}"; then
    sed -i.bak "s#^${key}=.*#${key}=${value}#" "${file}"
    rm -f "${file}.bak"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${file}"
  fi
}

require_command docker

if ! docker compose version >/dev/null 2>&1; then
  echo "当前 Docker 不支持 'docker compose'，请先安装 Docker Compose v2。" >&2
  exit 1
fi

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "已创建 LightRAG .env，请先填入现有 LightRAG 密钥后重新执行。"
  exit 1
fi

if [ ! -f "kgms.env" ]; then
  cp kgms.env.example kgms.env
  existing_pageindex_key="$(env_value "${REPO_ROOT}/kgms-backend/.env" "KGMS_PAGEINDEX_API_KEY")"
  if [ -n "${existing_pageindex_key}" ]; then
    replace_env_value kgms.env KGMS_PAGEINDEX_API_KEY "${existing_pageindex_key}"
  fi
fi

if grep -q "replace-with-pageindex-api-key" kgms.env; then
  echo "请先编辑 ${DEPLOY_DIR}/kgms.env，填入 KGMS_PAGEINDEX_API_KEY 后再执行。" >&2
  exit 1
fi

mkdir -p kgms-data

echo "构建 KGMS 镜像..."
docker compose build kgms-backend kgms-frontend

echo "启动 KGMS 服务..."
docker compose up -d kgms-backend kgms-frontend

echo "当前服务状态："
docker compose ps kgms-backend kgms-frontend lightrag

echo "KGMS 访问地址：http://<server-ip>:${KGMS_WEB_PORT:-8080}"
