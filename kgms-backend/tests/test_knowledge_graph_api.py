from app.dependencies import get_lightrag_client


class FakeLightRAGGraph:
    def __init__(self) -> None:
        self.graph_calls: list[dict] = []
        self.popular_label_calls: list[int] = []
        self.search_label_calls: list[dict] = []

    async def graph(
        self,
        label: str = "*",
        max_depth: int = 3,
        max_nodes: int = 300,
    ) -> dict:
        self.graph_calls.append(
            {"label": label, "max_depth": max_depth, "max_nodes": max_nodes}
        )
        return {
            "nodes": [
                {
                    "id": "n1",
                    "labels": ["09III型核潜艇"],
                    "properties": {
                        "entity_type": "equipment",
                        "description": "核潜艇装备节点",
                    },
                },
                {
                    "id": "n2",
                    "labels": ["声呐系统"],
                    "properties": {"entity_type": "equipment"},
                },
            ],
            "edges": [
                {
                    "id": "e1",
                    "source": "n1",
                    "target": "n2",
                    "type": "DIRECTED",
                    "properties": {
                        "keywords": "搭载系统",
                        "description": "09III型核潜艇搭载声呐系统",
                    },
                }
            ],
            "is_truncated": True,
        }

    async def popular_labels(self, limit: int = 50) -> list[str]:
        self.popular_label_calls.append(limit)
        return ["09III型核潜艇", "声呐系统"]

    async def search_labels(self, query: str, limit: int = 50) -> list[str]:
        self.search_label_calls.append({"query": query, "limit": limit})
        return [f"{query}节点"]


def test_knowledge_graph_defaults_to_all_label_and_maps_lightrag_graph(client) -> None:
    lightrag = FakeLightRAGGraph()
    client.app.dependency_overrides[get_lightrag_client] = lambda: lightrag

    response = client.get("/api/knowledge-graph")

    assert response.status_code == 200
    data = response.json()
    assert lightrag.graph_calls == [{"label": "*", "max_depth": 3, "max_nodes": 300}]
    assert data["label"] == "*"
    assert data["is_truncated"] is True
    assert data["node_count"] == 2
    assert data["edge_count"] == 1
    assert data["graph"]["nodes"][0] == {
        "id": "n1",
        "label": "09III型核潜艇",
        "entity_type": "equipment",
        "display_name": "装备",
        "color": "#0891b2",
        "properties": {
            "labels": ["09III型核潜艇"],
            "properties": {
                "entity_type": "equipment",
                "description": "核潜艇装备节点",
            },
        },
    }
    assert data["graph"]["edges"][0]["source"] == "n1"
    assert data["graph"]["edges"][0]["target"] == "n2"
    assert data["graph"]["edges"][0]["label"] == "搭载系统"


def test_knowledge_graph_passes_label_depth_and_node_limit(client) -> None:
    lightrag = FakeLightRAGGraph()
    client.app.dependency_overrides[get_lightrag_client] = lambda: lightrag

    response = client.get(
        "/api/knowledge-graph",
        params={"label": "09III型核潜艇", "max_depth": 2, "max_nodes": 100},
    )

    assert response.status_code == 200
    assert lightrag.graph_calls == [
        {"label": "09III型核潜艇", "max_depth": 2, "max_nodes": 100}
    ]


def test_knowledge_graph_labels_uses_popular_labels_without_query(client) -> None:
    lightrag = FakeLightRAGGraph()
    client.app.dependency_overrides[get_lightrag_client] = lambda: lightrag

    response = client.get("/api/knowledge-graph/labels", params={"limit": 20})

    assert response.status_code == 200
    assert response.json() == {
        "labels": ["09III型核潜艇", "声呐系统"],
        "query": None,
        "limit": 20,
    }
    assert lightrag.popular_label_calls == [20]


def test_knowledge_graph_labels_uses_search_when_query_is_present(client) -> None:
    lightrag = FakeLightRAGGraph()
    client.app.dependency_overrides[get_lightrag_client] = lambda: lightrag

    response = client.get(
        "/api/knowledge-graph/labels",
        params={"query": "雷达", "limit": 10},
    )

    assert response.status_code == 200
    assert response.json() == {"labels": ["雷达节点"], "query": "雷达", "limit": 10}
    assert lightrag.search_label_calls == [{"query": "雷达", "limit": 10}]
