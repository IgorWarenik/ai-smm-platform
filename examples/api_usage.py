"""Minimal Python examples for the current Fastify API.

Optional dependency:
    pip install httpx
"""

import asyncio
import json
from typing import Any

import httpx

API_BASE_URL = "http://localhost:3001"


async def register(email: str, password: str, name: str) -> dict[str, Any]:
    async with httpx.AsyncClient(base_url=API_BASE_URL) as client:
        response = await client.post(
            "/api/auth/register",
            json={"email": email, "password": password, "name": name},
        )
        response.raise_for_status()
        return response.json()["data"]


async def login(email: str, password: str) -> dict[str, Any]:
    async with httpx.AsyncClient(base_url=API_BASE_URL) as client:
        response = await client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        response.raise_for_status()
        return response.json()["data"]


async def create_project(access_token: str, name: str) -> dict[str, Any]:
    async with httpx.AsyncClient(base_url=API_BASE_URL) as client:
        response = await client.post(
            "/api/projects",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"name": name, "settings": {}},
        )
        response.raise_for_status()
        return response.json()["data"]


async def create_task(access_token: str, project_id: str, prompt: str) -> dict[str, Any]:
    async with httpx.AsyncClient(base_url=API_BASE_URL) as client:
        response = await client.post(
            f"/api/projects/{project_id}/tasks",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"input": prompt},
        )
        response.raise_for_status()
        return response.json()["data"]


async def get_task(access_token: str, project_id: str, task_id: str) -> dict[str, Any]:
    async with httpx.AsyncClient(base_url=API_BASE_URL) as client:
        response = await client.get(
            f"/api/projects/{project_id}/tasks/{task_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        return response.json()["data"]


async def stream_task_events(access_token: str, project_id: str, task_id: str) -> None:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "text/event-stream",
    }
    async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=None) as client:
        async with client.stream(
            "GET",
            f"/api/projects/{project_id}/tasks/{task_id}/stream",
            headers=headers,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    print(line)


async def create_knowledge_item(
    access_token: str,
    project_id: str,
    content: str,
    category: str = "GENERAL",
) -> dict[str, Any]:
    async with httpx.AsyncClient(base_url=API_BASE_URL) as client:
        response = await client.post(
            f"/api/projects/{project_id}/knowledge",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"content": content, "category": category, "metadata": {}},
        )
        response.raise_for_status()
        return response.json()["data"]


async def search_knowledge(access_token: str, project_id: str, query: str) -> dict[str, Any]:
    async with httpx.AsyncClient(base_url=API_BASE_URL) as client:
        response = await client.get(
            f"/api/projects/{project_id}/knowledge/search",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"q": query, "limit": 5},
        )
        response.raise_for_status()
        return response.json()


async def main() -> None:
    email = "demo@example.com"
    password = "password123"
    name = "Demo User"

    try:
        await register(email, password, name)
    except httpx.HTTPStatusError as err:
        if err.response.status_code != 409:
            raise

    auth = await login(email, password)
    access_token = auth["tokens"]["accessToken"]

    project = await create_project(access_token, "API Example Project")
    task = await create_task(
        access_token,
        project["id"],
        "Create an Instagram post with image direction and copy about our mission.",
    )
    knowledge = await create_knowledge_item(
        access_token,
        project["id"],
        "Our brand voice is clear, direct, optimistic, and never corporate.",
    )
    search = await search_knowledge(access_token, project["id"], "brand voice")
    latest_task = await get_task(access_token, project["id"], task["id"])

    print("Project:")
    print(json.dumps(project, indent=2))
    print("\nTask:")
    print(json.dumps(latest_task, indent=2))
    print("\nKnowledge item:")
    print(json.dumps(knowledge, indent=2))
    print("\nKnowledge search:")
    print(json.dumps(search, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
