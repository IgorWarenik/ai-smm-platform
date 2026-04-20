#!/bin/bash

# Linting script for AI Marketing Platform

set -e

echo "🔍 Running AI Marketing Platform linting..."

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "📦 Activating virtual environment..."
    source venv/bin/activate
fi

# Check if ruff is available
if ! command -v ruff &> /dev/null; then
    echo "❌ ruff not found. Please install dependencies first."
    exit 1
fi

echo "🐶 Running ruff check..."
ruff check packages/ai-engine/src packages/db/src tests/

echo "✨ Running ruff format..."
ruff format packages/ai-engine/src packages/db/src tests/

echo "📏 Checking code style..."
# Check for long lines
find packages/ai-engine/src packages/db/src tests/ -name "*.py" -exec grep -l '.\{89\}' {} \; | head -10 | while read file; do
    echo "⚠️ Long lines found in: $file"
done || true

# Check for TODO comments
echo "📝 Checking for TODO comments..."
grep -r "TODO\|FIXME\|XXX" packages/ai-engine/src packages/db/src || echo "✅ No TODO comments found"

# Check for print statements in production code
echo "🖨️ Checking for print statements..."
grep -r "^\s*print(" packages/ai-engine/src packages/db/src || echo "✅ No print statements found in production code"

# Check for unused imports
echo "📦 Checking for unused imports..."
python -m pip install --quiet unused || true
if command -v unused &> /dev/null; then
    unused --ignore "test_*.py" packages/ai-engine/src || echo "⚠️ Unused imports found"
else
    echo "⚠️ unused not installed, skipping unused import check"
fi

echo "✅ Linting completed successfully!"