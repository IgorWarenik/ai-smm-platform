# AI Marketing Platform

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.0-green.svg)](https://fastapi.tiangolo.com/)
[![CrewAI](https://img.shields.io/badge/CrewAI-0.30.0-orange.svg)](https://www.crewai.com/)

AI-powered marketing platform that orchestrates intelligent agents to automate content creation and marketing strategy development.

## 🚀 Features

- **Multi-Agent AI Orchestration**: CrewAI-powered agents for marketing strategy and content creation
- **Semantic Search**: Voyage AI embeddings with pgvector for intelligent knowledge retrieval
- **Embedding Cache**: Redis caching for Voyage AI embeddings to reduce repeated token usage
- **Multi-Tenant SaaS**: Isolated project workspaces with Row Level Security
- **Real-time Collaboration**: WebSocket updates for task progress and results
- **Async Processing**: Celery + Redis for scalable background task processing
- **Modern API**: FastAPI with automatic OpenAPI documentation
- **Type Safety**: Full TypeScript + Python type coverage

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js       │    │   FastAPI       │    │   CrewAI        │
│   Frontend      │◄──►│   Backend       │◄──►│   Agents        │
│                 │    │                 │    │                 │
│ • React 18      │    │ • Pydantic      │    │ • Marketer      │
│ • TypeScript    │    │ • JWT Auth      │    │ • Content Maker │
│ • Tailwind CSS  │    │ • Async/Await   │    │ • Evaluator     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ PostgreSQL      │    │   Redis         │    │   Voyage AI     │
│ + pgvector      │    │   Cache/Queue   │    │   Embeddings    │
│                 │    │                 │    │                 │
│ • RAG Storage   │    │ • Sessions      │    │ • 1024d vectors │
│ • Multi-tenant  │    │ • Background    │    │ • Cosine sim    │
│ • RLS Policies  │    │ • Tasks         │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL 16+** with pgvector extension
- **Redis 7+**
- **Docker & Docker Compose** (for local development)

## 🛠️ Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/your-org/ai-marketing-platform.git
cd ai-marketing-platform
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys
nano .env
```

Required environment variables:
```bash
# AI Services
ANTHROPIC_API_KEY=your_claude_key
VOYAGE_API_KEY=your_voyage_key

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/marketing_db

# Redis
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret
```

### 3. Local Development with Docker
```bash
# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec api python -m alembic upgrade head

# Seed initial data
docker-compose exec api python -m app.scripts.seed
```

### 4. Manual Setup (Alternative)
```bash
# Install Python dependencies
pip install -r packages/ai-engine/requirements.txt

# Install Node.js dependencies
npm install

# Start PostgreSQL and Redis
# (configure your local instances)

# Run migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start the frontend (in another terminal)
npm run dev
```

## 📖 Usage

### Creating a Marketing Task

```python
import httpx

async with httpx.AsyncClient() as client:
    response = await client.post(
        "http://localhost:8000/api/v1/projects/{project_id}/tasks",
        json={
            "title": "Q1 Social Media Campaign",
            "description": "Create engaging Instagram content for product launch",
            "task_type": "content_creation",
            "input_data": {
                "target_audience": "Millennials 25-35",
                "product": "AI Analytics Platform",
                "tone": "professional_casual",
                "platforms": ["instagram", "linkedin"]
            }
        },
        headers={"Authorization": "Bearer your-jwt-token"}
    )

    task = response.json()
    print(f"Task created: {task['task_id']}")
```

### Searching Knowledge Base

```python
response = await client.post(
    f"/api/v1/projects/{project_id}/search",
    json={
        "query": "competitor analysis techniques",
        "limit": 5,
        "filters": {
            "content_type": "document",
            "date_from": "2024-01-01"
        }
    }
)

results = response.json()
for result in results["results"]:
    print(f"Found: {result['content'][:100]}...")
```

## 🧪 Testing

```bash
# Run all tests with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_tasks.py -v

# Run with different Python version
tox
```

## 📚 Documentation

- **[Architecture Overview](docs/ARCHITECTURE.md)** - System design and data flow
- **[API Specification](docs/API_SPEC.md)** - Complete API reference
- **[Code Style Guide](docs/CODE_STYLE.md)** - Development standards
- **[Testing Guide](docs/TEST_GUIDE.md)** - Testing strategies and tools
- **[Spec-Driven Development Guide](specs/README.md)** - Contract-first workflow and task protocol
- **[Deployment Guide](docs/DOCKER.md)** - Production deployment
- **[Debug Protocol](docs/DEBUG_PROTOCOL.md)** - Troubleshooting guide

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Follow** the [Code Style Guide](docs/CODE_STYLE.md)
4. **Write tests** for new functionality
5. **Commit** with clear messages: `git commit -m "Add amazing feature"`
6. **Push** to the branch: `git push origin feature/amazing-feature`
7. **Open** a Pull Request

### Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-agent-capability

# 2. Make changes following code style
# 3. Run tests
pytest

# 4. Run linting
ruff check .

# 5. Format code
black .

# 6. Commit (pre-commit hooks will run automatically)
git commit -m "feat: add new agent capability"

# 7. Push and create PR
git push origin feature/new-agent-capability
```

## 🔧 Development Scripts

```bash
# Setup development environment
./scripts/setup.sh

# Run tests with coverage
./scripts/test.sh

# Lint and format code
./scripts/lint.sh

# Generate API documentation
./scripts/docs.sh

# Deploy to staging
./scripts/deploy.sh staging
```

## 📊 Monitoring

The platform includes comprehensive monitoring:

- **Prometheus metrics** for performance monitoring
- **Structured logging** with correlation IDs
- **Health checks** for all services
- **Error tracking** with Sentry integration
- **Real-time dashboards** for task progress

## 🚀 Deployment

### Docker Production Deployment
```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Scale workers
docker-compose up -d --scale celery-worker=3
```

### Kubernetes Deployment
```bash
# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** for Claude AI models
- **Voyage AI** for embedding services
- **CrewAI** for multi-agent orchestration
- **FastAPI** for the amazing web framework
- **pgvector** for vector database capabilities

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/ai-marketing-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/ai-marketing-platform/discussions)
- **Email**: support@marketing-platform.com

---

**Built with ❤️ for modern marketing teams**