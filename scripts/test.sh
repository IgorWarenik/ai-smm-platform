#!/bin/bash

# Test script for AI Marketing Platform

set -e

echo "🧪 Running AI Marketing Platform tests..."

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "📦 Activating virtual environment..."
    source venv/bin/activate
fi

# Check if pytest is available
if ! command -v pytest &> /dev/null; then
    echo "❌ pytest not found. Please install dependencies first."
    exit 1
fi

# Set environment variables for testing
export PYTHONPATH="${PYTHONPATH}:packages/ai-engine/src"
export TESTING=1

# Run tests with coverage
echo "📊 Running tests with coverage..."
pytest \
    --cov=packages/ai-engine/src \
    --cov=packages/db/src \
    --cov-report=html:htmlcov \
    --cov-report=term-missing \
    --cov-fail-under=80 \
    -v \
    --tb=short \
    tests/

# Check coverage threshold
COVERAGE=$(python -c "
import xml.etree.ElementTree as ET
try:
    tree = ET.parse('coverage.xml')
    root = tree.getroot()
    coverage = float(root.attrib['line-rate']) * 100
    print(f'{coverage:.1f}')
except:
    print('0')
")

if (( $(echo "$COVERAGE < 80" | bc -l) )); then
    echo "❌ Coverage is below 80%: ${COVERAGE}%"
    echo "Please add more tests to improve coverage."
    exit 1
else
    echo "✅ Coverage is good: ${COVERAGE}%"
fi

# Run additional test types
echo "🔍 Running additional test checks..."

# Type checking with mypy
if command -v mypy &> /dev/null; then
    echo "🔍 Running type checking..."
    mypy packages/ai-engine/src --ignore-missing-imports || echo "⚠️ Type checking failed"
else
    echo "⚠️ mypy not found, skipping type checking"
fi

# Security check with bandit
if command -v bandit &> /dev/null; then
    echo "🔒 Running security check..."
    bandit -r packages/ai-engine/src -f json -o security_report.json || echo "⚠️ Security check found issues"
else
    echo "⚠️ bandit not found, skipping security check"
fi

echo "✅ All tests completed successfully!"
echo ""
echo "Coverage report: htmlcov/index.html"
if [ -f "security_report.json" ]; then
    echo "Security report: security_report.json"
fi