from __future__ import annotations

from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture()
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.mark.asyncio
async def test_login_returns_token_for_valid_auditor(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "auditor@unilog.com",
            "password": "auditor123",
            "role": "SENIOR_AUDITOR",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "auditor@unilog.com"
    assert body["user"]["role"] == "SENIOR_AUDITOR"
    assert body["token"]


@pytest.mark.asyncio
async def test_login_rejects_wrong_password(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "auditor@unilog.com",
            "password": "wrong-pass",
            "role": "SENIOR_AUDITOR",
        },
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_rejects_invalid_role(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "admin@unilog.com",
            "password": "admin123",
            "role": "SENIOR_AUDITOR",
        },
    )

    assert response.status_code == 403
