#!/bin/bash

# Deployment script for AI Marketing Platform

set -e

ENVIRONMENT=${1:-staging}
TAG=${2:-latest}

echo "🚀 Deploying AI Marketing Platform to $ENVIRONMENT..."

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment. Use 'staging' or 'production'."
    exit 1
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

# Build Docker images
echo "🏗️ Building Docker images..."
docker-compose build --no-cache

# Tag images
echo "🏷️ Tagging images..."
docker tag ai-marketing-platform_api:latest ai-marketing-platform_api:$TAG
docker tag ai-marketing-platform_worker:latest ai-marketing-platform_worker:$TAG

# Run pre-deployment tests
echo "🧪 Running pre-deployment tests..."
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔍 Running full test suite for production..."
    ./scripts/test.sh
else
    echo "🔍 Running smoke tests for staging..."
    pytest tests/ -k "smoke" --tb=short
fi

# Deploy based on environment
if [ "$ENVIRONMENT" = "staging" ]; then
    echo "🌐 Deploying to staging environment..."

    # Use docker-compose for staging
    docker-compose -f docker-compose.staging.yml up -d

    # Wait for services to be healthy
    echo "⏳ Waiting for services to be healthy..."
    sleep 30

    # Run health checks
    echo "🏥 Running health checks..."
    curl -f http://localhost:8000/health || echo "⚠️ Health check failed"

elif [ "$ENVIRONMENT" = "production" ]; then
    echo "🌐 Deploying to production environment..."

    # Push images to registry (assuming Docker registry is configured)
    echo "📤 Pushing images to registry..."
    docker push ai-marketing-platform_api:$TAG
    docker push ai-marketing-platform_worker:$TAG

    # Deploy using docker stack or kubernetes
    if command -v kubectl &> /dev/null; then
        echo "☸️ Deploying to Kubernetes..."
        # Apply Kubernetes manifests
        kubectl apply -f k8s/
        kubectl set image deployment/api api=ai-marketing-platform_api:$TAG
        kubectl set image deployment/worker worker=ai-marketing-platform_worker:$TAG

        # Wait for rollout
        kubectl rollout status deployment/api
        kubectl rollout status deployment/worker

    elif command -v docker &> /dev/null; then
        echo "🐳 Deploying with Docker Swarm..."
        docker stack deploy -c docker-compose.prod.yml marketing-platform

    else
        echo "❌ No deployment method available (Kubernetes or Docker Swarm)"
        exit 1
    fi
fi

# Run post-deployment tests
echo "🧪 Running post-deployment tests..."
if [ "$ENVIRONMENT" = "staging" ]; then
    # Test staging endpoints
    curl -f http://localhost:8000/docs || echo "⚠️ API docs not accessible"
fi

# Send deployment notification
echo "📢 Sending deployment notification..."
# Add webhook or notification logic here

echo "✅ Deployment to $ENVIRONMENT completed successfully!"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Tag: $TAG"
echo "API URL: http://localhost:8000 (for staging)"
echo ""
echo "Monitor logs:"
if command -v kubectl &> /dev/null; then
    echo "kubectl logs -f deployment/api"
    echo "kubectl logs -f deployment/worker"
else
    echo "docker-compose logs -f"
fi