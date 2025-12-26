# Taobao Scraper API - Quick Start Guide

## Overview
This API integrates with your existing MongoDB setup and provides web scraping capabilities for Taobao, Tmall, and 1688 platforms.

## Prerequisites
- Docker and Docker Compose installed
- Your existing MongoDB container running (mongodb on mongodb_network)

## Quick Start

### 1. Make the deployment script executable
```bash
chmod +x deploy.sh
```

### 2. Start the Scraper API

The scraper will automatically connect to your existing MongoDB container:

```bash
# Build and start the API
./deploy.sh build
./deploy.sh start
```

Or using docker-compose directly:
```bash
docker-compose up -d
```

### 3. Verify it's running

Check the status:
```bash
./deploy.sh status
```

Or visit:
- API Health: http://localhost:3000/health
- Web Interface: http://localhost:3000
- MongoDB Express: http://localhost:8089 (from your existing setup)

## How It Works

The scraper API:
- Connects to your existing `mongodb` container on the `mongodb_network`
- Creates a new database called `taobao_scraper` (doesn't affect your other databases)
- Uses the same admin credentials (admin/admin)
- Stores scraped product data and job information

## Available Commands

```bash
./deploy.sh build          # Build the Docker image
./deploy.sh start          # Start the API service
./deploy.sh stop           # Stop the API service
./deploy.sh restart        # Restart the API service
./deploy.sh logs           # View logs in real-time
./deploy.sh status         # Check service status
./deploy.sh backup         # Backup the taobao_scraper database
./deploy.sh clean          # Remove containers (keeps MongoDB data)
./deploy.sh help           # Show all commands
```

## API Endpoints

### Scraping
- `POST /api/scraper/scrape` - Start a scraping job
- `GET /api/scraper/status/:jobId` - Check job status
- `GET /api/scraper/jobs` - List all jobs

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/search` - Search products

### Health
- `GET /health` - Check API health and MongoDB connection

## Example Usage

### 1. Start a scraping job

```bash
curl -X POST http://localhost:3000/api/scraper/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://item.taobao.com/item.htm?id=123456789",
    "platform": "taobao"
  }'
```

Response:
```json
{
  "success": true,
  "jobId": "abc-123",
  "message": "Scraping job started"
}
```

### 2. Check job status

```bash
curl http://localhost:3000/api/scraper/status/abc-123
```

### 3. Get all products

```bash
curl http://localhost:3000/api/products
```

## Database Structure

The scraper creates these collections in the `taobao_scraper` database:
- `products` - Scraped product information
- `scrapingjobs` - Job status and history

You can view them in MongoDB Express at http://localhost:8089

## Configuration

### Environment Variables

The API uses these default settings (matching your MongoDB setup):

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://admin:admin@mongodb:27017/taobao_scraper?authSource=admin
SCRAPER_HEADLESS=true
```

To customize, edit the `docker-compose.yml` file.

## Production Deployment

For production use:

```bash
# Copy and edit production environment
cp .env.production.example .env.production
nano .env.production

# Start with production config
./deploy.sh start:prod
```

## Troubleshooting

### API won't start
1. Ensure MongoDB is running:
   ```bash
   docker ps | grep mongodb
   ```

2. Check if the network exists:
   ```bash
   docker network ls | grep mongodb_network
   ```

3. View logs:
   ```bash
   ./deploy.sh logs
   ```

### Connection errors
- Verify MongoDB credentials match in your setup (default: admin/admin)
- Ensure the `mongodb_network` exists and MongoDB is connected to it
- Check MongoDB container name is exactly `mongodb`

### Puppeteer/Chrome issues
If scraping fails:
- The Docker image includes Chrome/Chromium dependencies
- Check logs for specific errors: `./deploy.sh logs`
- Try increasing shared memory: edit docker-compose.yml, increase `shm_size`

## Backup & Restore

### Backup the scraper database
```bash
./deploy.sh backup
```

Backups are saved to `./backups/YYYYMMDD_HHMMSS/`

### Restore from backup
```bash
docker exec -i mongodb mongorestore \
  --username admin \
  --password admin \
  --authenticationDatabase admin \
  --db taobao_scraper \
  /path/to/backup
```

## Integration with Your MongoDB Setup

Your current setup:
```
mongodb:27017          - MongoDB Database
  └── mongodb_network
      ├── mongodb (existing)
      ├── mongo-express (existing)
      └── scraper-api (new)
```

The scraper API:
- ✅ Uses your existing MongoDB container
- ✅ Shares the same network
- ✅ Uses same credentials
- ✅ Creates separate database (taobao_scraper)
- ✅ Visible in your Mongo Express UI

## Stopping/Removing

### Stop the API only (keeps data)
```bash
./deploy.sh stop
```

### Remove API container and network connections
```bash
docker-compose down
```

### Remove API and its data (MongoDB data remains safe)
```bash
./deploy.sh clean
```

Note: This only removes the scraper API. Your existing MongoDB data and containers remain untouched.

## Next Steps

1. Access the web interface: http://localhost:3000
2. View the API documentation in the web UI
3. Try scraping a product URL
4. View results in MongoDB Express: http://localhost:8089
5. Integrate with your applications using the REST API

## Support

For detailed Docker information, see [README.Docker.md](./README.Docker.md)

For API usage, visit the web interface at http://localhost:3000

