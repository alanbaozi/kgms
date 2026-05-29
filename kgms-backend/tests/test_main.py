def test_root_returns_service_links(client) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["service"] == "KGMS Backend"
    assert response.json()["docs_url"] == "/docs"


def test_cors_allows_local_frontend(client) -> None:
    response = client.options(
        "/api/documents",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
