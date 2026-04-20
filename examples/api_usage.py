# API Usage Examples

## Authentication

### Login
```python
import httpx
import asyncio

async def login():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        response = await client.post("/auth/login", json={
            "email": "user@example.com",
            "password": "secure_password"
        })

        if response.status_code == 200:
            data = response.json()
            access_token = data["access_token"]
            print(f"Login successful! Token: {access_token[:20]}...")
            return access_token
        else:
            print(f"Login failed: {response.text}")
            return None

# Usage
token = asyncio.run(login())
```

### Register New User
```python
async def register():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        response = await client.post("/auth/register", json={
            "email": "newuser@example.com",
            "password": "secure_password123",
            "full_name": "John Doe",
            "company": "ACME Marketing"
        })

        if response.status_code == 201:
            print("Registration successful!")
        else:
            print(f"Registration failed: {response.text}")

# Usage
asyncio.run(register())
```

## Project Management

### Create New Project
```python
async def create_project(token: str):
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        response = await client.post("/projects", json={
            "name": "Q1 2024 Marketing Campaign",
            "description": "Comprehensive marketing campaign for product launch"
        }, headers=headers)

        if response.status_code == 201:
            project = response.json()
            print(f"Project created: {project['id']}")
            return project["id"]
        else:
            print(f"Failed to create project: {response.text}")
            return None

# Usage
project_id = asyncio.run(create_project(token))
```

### List Projects
```python
async def list_projects(token: str):
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        response = await client.get("/projects", headers=headers)

        if response.status_code == 200:
            data = response.json()
            for project in data["projects"]:
                print(f"- {project['name']} ({project['id']})")
        else:
            print(f"Failed to list projects: {response.text}")

# Usage
asyncio.run(list_projects(token))
```

## Task Management

### Create Marketing Task
```python
async def create_task(token: str, project_id: str):
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        response = await client.post(
            f"/projects/{project_id}/tasks",
            json={
                "title": "Create Instagram Content Series",
                "description": "Generate 10 engaging Instagram posts for product launch",
                "task_type": "content_creation",
                "priority": "high",
                "input_data": {
                    "target_audience": "Tech-savvy millennials 25-35",
                    "product": "AI-powered analytics platform",
                    "tone": "professional_casual",
                    "platforms": ["instagram"],
                    "content_goals": [
                        "Build brand awareness",
                        "Drive website traffic",
                        "Generate leads"
                    ]
                }
            },
            headers=headers
        )

        if response.status_code == 201:
            task = response.json()
            print(f"Task created: {task['task_id']}")
            return task["task_id"]
        else:
            print(f"Failed to create task: {response.text}")
            return None

# Usage
task_id = asyncio.run(create_task(token, project_id))
```

### Monitor Task Progress
```python
import websockets
import json
import asyncio

async def monitor_task(project_id: str, task_id: str, token: str):
    uri = f"ws://localhost:8000/api/v1/projects/{project_id}/tasks/{task_id}/stream"

    headers = {"Authorization": f"Bearer {token}"}

    async with websockets.connect(uri, extra_headers=headers) as websocket:
        print("Connected to task stream...")

        while True:
            try:
                message = await websocket.recv()
                data = json.loads(message)

                if data["type"] == "progress":
                    progress = data["data"]
                    print(f"Progress: {progress['progress']}% - {progress['message']}")

                elif data["type"] == "completed":
                    print("Task completed!")
                    break

                elif data["type"] == "error":
                    print(f"Task failed: {data['message']}")
                    break

            except websockets.exceptions.ConnectionClosed:
                print("Connection closed")
                break

# Usage
asyncio.run(monitor_task(project_id, task_id, token))
```

### Get Task Results
```python
async def get_task_results(token: str, project_id: str, task_id: str):
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        response = await client.get(
            f"/projects/{project_id}/tasks/{task_id}",
            headers=headers
        )

        if response.status_code == 200:
            task = response.json()
            if task["status"] == "completed":
                results = task["results"]
                print("Task Results:")
                print(json.dumps(results, indent=2))
            else:
                print(f"Task status: {task['status']}")
        else:
            print(f"Failed to get task: {response.text}")

# Usage
asyncio.run(get_task_results(token, project_id, task_id))
```

## Knowledge Base Operations

### Upload Document
```python
async def upload_document(token: str, project_id: str, file_path: str):
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        with open(file_path, "rb") as f:
            files = {"file": (file_path.split("/")[-1], f, "application/pdf")}
            data = {
                "metadata": json.dumps({
                    "tags": ["marketing", "strategy"],
                    "category": "research"
                })
            }

            response = await client.post(
                f"/projects/{project_id}/knowledge",
                files=files,
                data=data,
                headers=headers
            )

        if response.status_code == 201:
            doc = response.json()
            print(f"Document uploaded: {doc['id']}")
        else:
            print(f"Upload failed: {response.text}")

# Usage
asyncio.run(upload_document(token, project_id, "marketing_strategy.pdf"))
```

### Semantic Search
```python
async def search_knowledge(token: str, project_id: str, query: str):
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        response = await client.post(
            f"/projects/{project_id}/search",
            json={
                "query": query,
                "limit": 5,
                "filters": {
                    "content_type": "document",
                    "date_from": "2024-01-01"
                }
            },
            headers=headers
        )

        if response.status_code == 200:
            results = response.json()
            print(f"Found {len(results['results'])} results:")

            for result in results["results"]:
                print(f"- Score: {result['similarity_score']:.2f}")
                print(f"  Content: {result['content'][:200]}...")
                print(f"  Source: {result['metadata']['source']}")
                print()
        else:
            print(f"Search failed: {response.text}")

# Usage
asyncio.run(search_knowledge(token, project_id, "competitor analysis techniques"))
```

## Agent Configuration

### List Available Agents
```python
async def list_agents(token: str, project_id: str):
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        response = await client.get(
            f"/projects/{project_id}/agents",
            headers=headers
        )

        if response.status_code == 200:
            data = response.json()
            for agent in data["agents"]:
                print(f"- {agent['name']} ({agent['id']})")
                print(f"  Capabilities: {', '.join(agent['capabilities'])}")
        else:
            print(f"Failed to list agents: {response.text}")

# Usage
asyncio.run(list_agents(token, project_id))
```

### Configure Agent
```python
async def configure_agent(token: str, project_id: str, agent_id: str):
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        response = await client.post(
            f"/projects/{project_id}/agents/{agent_id}/configure",
            json={
                "settings": {
                    "creativity_level": 0.8,
                    "tone": "professional_casual",
                    "target_audience": "B2B tech companies",
                    "content_style": "educational_entertaining",
                    "brand_voice": "innovative_trusted"
                }
            },
            headers=headers
        )

        if response.status_code == 200:
            print(f"Agent {agent_id} configured successfully")
        else:
            print(f"Configuration failed: {response.text}")

# Usage
asyncio.run(configure_agent(token, project_id, "content_maker"))
```

## Error Handling

### Handling API Errors
```python
async def safe_api_call(client: httpx.AsyncClient, method: str, url: str, **kwargs):
    try:
        response = await client.request(method, url, **kwargs)

        if response.status_code >= 400:
            error_data = response.json()
            error_code = error_data.get("error", {}).get("code", "UNKNOWN_ERROR")
            error_message = error_data.get("error", {}).get("message", "Unknown error")

            if error_code == "RATE_LIMITED":
                print("Rate limit exceeded. Please wait before retrying.")
            elif error_code == "AUTHENTICATION_ERROR":
                print("Authentication failed. Please check your token.")
            else:
                print(f"API Error [{error_code}]: {error_message}")

            return None

        return response.json()

    except httpx.RequestError as e:
        print(f"Network error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None

# Usage
result = await safe_api_call(
    client, "GET", "/projects",
    headers={"Authorization": f"Bearer {token}"}
)
```

## Complete Workflow Example

```python
import asyncio
import httpx
import json

async def complete_workflow():
    """Complete example of using the AI Marketing Platform."""

    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        # 1. Login
        print("🔐 Logging in...")
        login_response = await client.post("/auth/login", json={
            "email": "demo@example.com",
            "password": "demo_password"
        })

        if login_response.status_code != 200:
            print("Login failed")
            return

        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create project
        print("📁 Creating project...")
        project_response = await client.post("/projects", json={
            "name": "Demo Marketing Campaign",
            "description": "AI-powered marketing demonstration"
        }, headers=headers)

        project_id = project_response.json()["id"]

        # 3. Upload knowledge
        print("📚 Uploading knowledge base...")
        with open("demo_marketing_guide.pdf", "rb") as f:
            files = {"file": ("marketing_guide.pdf", f, "application/pdf")}
            await client.post(
                f"/projects/{project_id}/knowledge",
                files=files,
                data={"metadata": json.dumps({"tags": ["guide", "strategy"]})},
                headers=headers
            )

        # 4. Create marketing task
        print("🎯 Creating marketing task...")
        task_response = await client.post(f"/projects/{project_id}/tasks", json={
            "title": "Generate Social Media Campaign",
            "description": "Create a comprehensive social media strategy",
            "task_type": "content_creation",
            "input_data": {
                "target_audience": "Small business owners",
                "product": "Marketing automation tool",
                "platforms": ["instagram", "linkedin", "twitter"],
                "campaign_duration": "30 days",
                "budget_range": "$5,000 - $10,000"
            }
        }, headers=headers)

        task_id = task_response.json()["task_id"]

        # 5. Monitor progress (simplified)
        print("⏳ Monitoring task progress...")
        for i in range(10):  # Check 10 times
            await asyncio.sleep(3)  # Wait 3 seconds

            status_response = await client.get(
                f"/projects/{project_id}/tasks/{task_id}",
                headers=headers
            )

            status = status_response.json()["status"]
            progress = status_response.json()["progress"]

            print(f"Status: {status} ({progress}%)")

            if status == "completed":
                results = status_response.json()["results"]
                print("✅ Task completed!")
                print("Results:", json.dumps(results, indent=2))
                break
            elif status == "failed":
                print("❌ Task failed")
                break

        print("🎉 Workflow completed!")

# Run the complete example
if __name__ == "__main__":
    asyncio.run(complete_workflow())
```