#!/bin/bash
echo "Starting Emergency Room Management System..."

# Navigate to project directory
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Start the FastAPI server using Uvicorn
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
