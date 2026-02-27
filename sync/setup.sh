#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🌱 Jninty Sync Server Setup${NC}"
echo ""

# Check Docker is installed
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Error: Docker is not installed.${NC}"
  echo "Install Docker from https://docker.com/get-started"
  exit 1
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
  echo -e "${RED}Error: Docker Compose is not available.${NC}"
  exit 1
fi

# Load .env or use defaults
if [ -f .env ]; then
  source .env
else
  cp .env.example .env
  echo -e "${YELLOW}Created .env from .env.example — edit it to change credentials.${NC}"
  source .env
fi

COUCH_USER=${COUCHDB_USER:-admin}
COUCH_PASS=${COUCHDB_PASSWORD:-jninty2026}

# Start CouchDB
echo "Starting CouchDB..."
docker compose up -d

# Wait for CouchDB to be ready
echo "Waiting for CouchDB to start..."
for i in {1..30}; do
  if curl -s http://localhost:5984/ > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Verify CouchDB is running
if ! curl -s http://localhost:5984/ > /dev/null 2>&1; then
  echo -e "${RED}Error: CouchDB failed to start.${NC}"
  echo "Check logs: docker compose logs couchdb"
  exit 1
fi

echo -e "${GREEN}CouchDB is running!${NC}"

# Create the jninty database
echo "Creating jninty database..."
curl -s -X PUT "http://${COUCH_USER}:${COUCH_PASS}@localhost:5984/jninty" > /dev/null 2>&1 || true

# Enable CORS
echo "Configuring CORS for cross-device access..."
COUCH_CONFIG="http://${COUCH_USER}:${COUCH_PASS}@localhost:5984/_node/_local/_config"
curl -s -X PUT "${COUCH_CONFIG}/httpd/enable_cors" -d '"true"' > /dev/null
curl -s -X PUT "${COUCH_CONFIG}/cors/origins" -d '"*"' > /dev/null
curl -s -X PUT "${COUCH_CONFIG}/cors/credentials" -d '"true"' > /dev/null
curl -s -X PUT "${COUCH_CONFIG}/cors/methods" -d '"GET, PUT, POST, HEAD, DELETE"' > /dev/null
curl -s -X PUT "${COUCH_CONFIG}/cors/headers" -d '"accept, authorization, content-type, origin, referer"' > /dev/null

# Detect LAN IP
LAN_IP=""
if command -v ipconfig &> /dev/null; then
  # macOS
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
fi
if [ -z "$LAN_IP" ]; then
  # Linux
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
fi

echo ""
echo -e "${GREEN}✅ Jninty Sync Server is ready!${NC}"
echo ""
echo "Admin panel:  http://localhost:5984/_utils/"
echo ""
if [ -n "$LAN_IP" ]; then
  echo -e "${GREEN}📱 To sync from your phone, use this URL in Jninty settings:${NC}"
  echo ""
  echo "   http://${COUCH_USER}:${COUCH_PASS}@${LAN_IP}:5984/jninty"
  echo ""
else
  echo "To sync from your phone, find your computer's LAN IP and use:"
  echo "   http://${COUCH_USER}:${COUCH_PASS}@YOUR_LAN_IP:5984/jninty"
fi
echo "---"
echo "Stop server:   cd sync && docker compose down"
echo "View logs:     cd sync && docker compose logs -f"
echo "Reset data:    cd sync && docker compose down -v"
