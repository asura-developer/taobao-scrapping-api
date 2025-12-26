# Docker Deployment Guide

This guide explains how to deploy the Taobao Scraper API using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

## Quick Start

### Using Docker Compose (Recommended)

1. **Start all services (API + MongoDB):**
   ```bash
   docker-compose up -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f scraper-api
   ```

3. **Stop services:**
   ```bash
   docker-compose down
   ```

4. **Stop and remove volumes (WARNING: deletes database data):**
   ```bash
   docker-compose down -v
   ```

### Using Docker Only

1. **Build the image:**
   ```bash
   docker build -t taobao-scraper-api .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name taobao-scraper \
     -p 3000:3000 \
     -e MONGODB_URI="your_mongodb_connection_string" \
     -e SCRAPER_HEADLESS=true \
     --cap-add=SYS_ADMIN \
     taobao-scraper-api
   ```

## Configuration

### Environment Variables

Create a `.env.production` file or modify `docker-compose.yml`:

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://admin:admin@mongodb:27017/taobao_scraper?authSource=admin
SCRAPER_HEADLESS=true
```

### Using Alpine-based Image (Smaller)

To use the Alpine-based image (smaller size but may have compatibility issues):

```bash
docker build -f Dockerfile.alpine -t taobao-scraper-api:alpine .
```

Or modify `docker-compose.yml`:
```yaml
scraper-api:
  build:
    context: .
    dockerfile: Dockerfile.alpine
```

## Production Deployment

### 1. Using External MongoDB (MongoDB Atlas)

Update `docker-compose.yml`:

```yaml
services:
  scraper-api:
    environment:
      - MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/taobao_scraper
    # Remove depends_on since we don't need local MongoDB
```

Then remove the mongodb service from docker-compose.yml.

### 2. Security Best Practices

For production, consider:

- Using Docker secrets for sensitive data
- Running without `--cap-add=SYS_ADMIN` by using `--security-opt=seccomp:unconfined`
- Setting up a reverse proxy (nginx)
- Implementing rate limiting
- Using container orchestration (Kubernetes, Docker Swarm)

### 3. Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
scraper-api:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G
```

## Monitoring

### Health Checks

Check service health:
```bash
docker-compose ps
curl http://localhost:3000/health
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f scraper-api
docker-compose logs -f mongodb
```

### Inspect Container

```bash
docker exec -it taobao-scraper-api sh
```

## Troubleshooting

### Puppeteer/Chrome Issues

If Puppeteer fails to launch Chrome:

1. **Check Chrome installation:**
   ```bash
   docker exec taobao-scraper-api which chromium
   ```

2. **Try running with different security options:**
   Add to docker-compose.yml:
   ```yaml
   security_opt:
     - seccomp:unconfined
   shm_size: '2gb'
   ```

3. **Check for out of memory issues:**
   Increase shared memory:
   ```yaml
   shm_size: '2gb'
   ```

### MongoDB Connection Issues

1. **Check MongoDB is running:**
   ```bash
   docker-compose ps mongodb
   ```

2. **Test connection:**
   ```bash
   docker exec -it taobao-scraper-mongodb mongosh -u admin -p admin
   ```

3. **Check logs:**
   ```bash
   docker-compose logs mongodb
   ```

### Port Conflicts

If port 3000 or 27017 is already in use, modify `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Use port 3001 on host
```

## Scaling

Run multiple scraper instances:

```bash
docker-compose up -d --scale scraper-api=3
```

Note: You'll need to configure a load balancer and ensure each instance uses different ports.

## Backup and Restore

### Backup MongoDB

```bash
docker exec taobao-scraper-mongodb mongodump \
  --username admin \
  --password admin \
  --authenticationDatabase admin \
  --out /tmp/backup

docker cp taobao-scraper-mongodb:/tmp/backup ./backup
```

### Restore MongoDB

```bash
docker cp ./backup taobao-scraper-mongodb:/tmp/backup

docker exec taobao-scraper-mongodb mongorestore \
  --username admin \
  --password admin \
  --authenticationDatabase admin \
  /tmp/backup
```

## Cleanup

Remove all containers, networks, and volumes:

```bash
docker-compose down -v
docker system prune -a
```

## Support

For issues specific to Docker deployment, check:
- Docker logs: `docker-compose logs`
- Container status: `docker-compose ps`
- Health endpoint: `http://localhost:3000/health`

