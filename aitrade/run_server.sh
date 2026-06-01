#!/bin/bash
cd /Users/r2k8/Library/CloudStorage/OneDrive-Personal/CODE/trading-system
echo "Starting local dashboard on port 8000..."
echo "Open your browser and navigate to: http://localhost:8000/dashboard/"
python3 -m http.server 8000
