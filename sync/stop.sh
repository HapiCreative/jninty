#!/bin/bash
echo "Stopping Jninty sync server..."
docker compose down
echo "Sync server stopped. Your data is preserved."
echo "Run ./setup.sh to start it again."
