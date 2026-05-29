# KGMS 知识图谱页面设计

## 目标

KGMS 新增“知识图谱”菜单，用于查看 LightRAG 当前知识库中的图谱数据。页面默认查询 `label="*"`，展示全量图谱的受限视图；用户也可以输入或选择实体 label，查看该节点相关的子图。

## LightRAG API

LightRAG 已提供图谱浏览接口：

- `GET /graphs?label=*&max_depth=3&max_nodes=300`
- `GET /graph/label/popular?limit=50`
- `GET /graph/label/search?q=雷达&limit=50`

`/graphs` 的 `label="*"` 表示查询全量图谱。`max_nodes` 用于限制返回节点数量，返回体包含 `nodes`、`edges` 和 `is_truncated`。

## KGMS 后端

KGMS 后端新增图谱代理接口：

- `GET /api/knowledge-graph`
  - 参数：`label`、`max_depth`、`max_nodes`
  - 默认：`label="*"`、`max_depth=3`、`max_nodes=300`
  - 调用 LightRAG `/graphs`
  - 将 LightRAG 原始节点和边转换成 KGMS 统一的 `GraphResponse`
  - 返回 `is_truncated`、节点数、关系数和查询参数

- `GET /api/knowledge-graph/labels`
  - 参数：`query`、`limit`
  - `query` 为空时调用热门 label 接口
  - `query` 非空时调用搜索 label 接口

## 前端页面

新增“知识图谱”菜单：

- 顶部控制区：
  - 节点名称输入框，默认 `*`
  - datalist 下拉候选，来自热门 label 或搜索 label
  - 最大节点数选择：100、300、500、1000
  - 最大深度选择：1、2、3、4、5
  - 查询和刷新按钮
- 主图区：
  - 复用现有 `GraphPanel`
  - 显示节点数、关系数和截断提示
  - `is_truncated=true` 时提示“图谱已按最大节点数截断”

## 边界

第一版只做图谱查看，不做节点编辑、关系编辑、节点展开合并。后续可以继续接入 LightRAG 的 entity/relation 编辑接口。

