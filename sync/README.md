# Jninty Sync Server (Optional)

Multi-device sync for Jninty using CouchDB. This is entirely optional —
the app works perfectly on a single device without this.

## Requirements
- Docker and Docker Compose installed

## Quick Start
```bash
cd sync
cp .env.example .env     # Edit credentials if desired
./setup.sh               # Starts CouchDB + configures everything
```

The script will print a sync URL. Enter it in the Jninty app:
Settings > Multi-Device Sync > paste the URL > Start Sync.

## Commands
- **Start:** `./setup.sh`
- **Stop:** `./stop.sh`
- **Logs:** `docker compose logs -f`
- **Reset all data:** `docker compose down -v`
- **Admin panel:** http://localhost:5984/_utils/

## Security Note
This setup is designed for your home LAN. Do NOT expose port 5984
to the internet without adding HTTPS and changing the default password.
