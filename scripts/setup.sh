#!/bin/bash

# Setup script for AI Marketing Platform development environment

set -e

echo "🚀 Setting up AI Marketing Platform development environment..."

# Check if Python 3.11+ is available
if ! command -v python3.11 &> /dev/null && ! command -v python3.12 &> /dev/null; then
    echo "❌ Python 3.11+ is required. Please install Python 3.11 or later."
    exit 1
fi

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Install Python dependencies
echo "📚 Installing Python dependencies..."
pip install -r packages/ai-engine/requirements.txt

# Install Node.js dependencies (if frontend exists)
if [ -f "package.json" ]; then
    echo "📱 Installing Node.js dependencies..."
    npm install
fi

# Setup pre-commit hooks
echo "🔗 Setting up pre-commit hooks..."
if command -v pre-commit &> /dev/null; then
    pre-commit install
else
    echo "⚠️ pre-commit not found. Install with: pip install pre-commit"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️ Please edit .env file with your actual API keys and configuration."
fi

# Setup database (if using local PostgreSQL)
echo "🗄️ Setting up database..."
if command -v psql &> /dev/null; then
    # Create database if it doesn't exist
    createdb marketing_platform 2>/dev/null || echo "Database 'marketing_platform' already exists or PostgreSQL not running"
else
    echo "⚠️ PostgreSQL not found. Make sure it's installed and running."
fi

# Run database migrations
echo "🛠️ Running database migrations..."
if [ -f "alembic.ini" ]; then
    alembic upgrade head
else
    echo "⚠️ Alembic not configured. Run migrations manually when ready."
fi

# Seed database with initial data
echo "🌱 Seeding database..."
if [ -f "packages/db/src/seed.py" ]; then
    python -m packages.db.src.seed
else
    echo "⚠️ Seed script not found. Run seeding manually when ready."
fi

# Run tests to verify setup
echo "🧪 Running tests to verify setup..."
pytest --version >/dev/null 2>&1 && pytest tests/ -v --tb=short || echo "⚠️ Tests failed or pytest not available"

echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Start the development server: uvicorn app.main:app --reload"
echo "3. Open http://localhost:8000/docs for API documentation"
echo "4. Run tests: pytest"
echo ""
echo "Happy coding! 🎉"