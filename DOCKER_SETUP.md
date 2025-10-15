# Docker Compose Setup Guide

This guide explains how to set up and run your restaurant management application using Docker Compose with Nginx as a reverse proxy.

## 🏗️ Architecture Overview

The Docker Compose setup includes:

- **Backend API** (Express.js) - Restaurant Management API
- **Frontend 1** (Next.js) - Jellyfish main website
- **Frontend 2** (React + Vite) - Jellyfish Manager admin panel
- **Nginx** - Reverse proxy and load balancer
- **PostgreSQL** - Primary database
- **Redis** - Caching and session storage

## 📁 Project Structure

```
zezeo_project/
├── docker-compose.yml          # Main Docker Compose configuration
├── .env.example               # Environment variables template
├── .dockerignore             # Docker ignore patterns
├── nginx/                    # Nginx configuration
│   ├── nginx.conf           # Main Nginx config
│   └── conf.d/
│       └── default.conf     # Virtual hosts configuration
├── Restaurant-Management/    # Backend API
│   ├── Dockerfile
│   ├── healthcheck.js
│   └── [backend source files]
├── jellyfish/               # Next.js Frontend
│   ├── Dockerfile
│   └── [frontend source files]
└── jellyfishmaneger/        # React + Vite Frontend
    ├── Dockerfile
    ├── nginx.conf
    └── [frontend source files]
```

## 🚀 Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available for containers

### 1. Environment Setup

```bash
# Copy environment variables
cp .env.example .env

# Edit the .env file with your specific values
nano .env
```

### 2. Build and Run

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 3. Access Applications

| Service | URL | Description |
|---------|-----|-------------|
| Main Website | http://localhost | Next.js frontend (Jellyfish) |
| Admin Panel | http://manager.localhost | React admin panel |
| API | http://localhost/api | Backend REST API |
| Health Check | http://health.localhost/health | System health status |

## 🌐 Host Configuration (Optional)

To use custom domains locally, add these entries to your hosts file:

**Windows:** `C:\Windows\System32\drivers\etc\hosts`
**Linux/Mac:** `/etc/hosts`

```
127.0.0.1 localhost
127.0.0.1 jellyfish.local
127.0.0.1 manager.localhost
127.0.0.1 admin.localhost
127.0.0.1 health.localhost
```

## 🔧 Configuration Details

### Nginx Proxy Configuration

The Nginx configuration provides:

- **Reverse proxy** for all services
- **Load balancing** with upstream servers
- **Rate limiting** (10 req/s for API, 1 req/s for auth)
- **Security headers** (XSS, CSRF protection)
- **Gzip compression** for static assets
- **WebSocket support** for Socket.io

### Service Ports

| Service | Internal Port | External Access |
|---------|---------------|-----------------|
| Backend | 3000 | Via Nginx proxy |
| Next.js Frontend | 3000 | Via Nginx proxy |
| Manager Frontend | 8080 | Via Nginx proxy |
| Nginx | 80/443 | Direct access |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

### Volume Mounts

- **Source code volumes** for development
- **Database persistence** for PostgreSQL
- **Redis data persistence**
- **Nginx configuration** for custom configs

## 🛠️ Development Workflow

### Starting Development Environment

```bash
# Start all services
docker-compose up -d

# View real-time logs
docker-compose logs -f backend frontend-nextjs frontend-manager

# Restart a specific service
docker-compose restart backend

# Rebuild a service after code changes
docker-compose up --build backend -d
```

### Debugging

```bash
# Execute commands in running containers
docker-compose exec backend sh
docker-compose exec frontend-nextjs sh

# View service logs
docker-compose logs backend
docker-compose logs nginx

# Check container resource usage
docker stats
```

### Database Operations

```bash
# Access PostgreSQL
docker-compose exec postgres psql -U restaurant_user -d restaurant_db

# Backup database
docker-compose exec postgres pg_dump -U restaurant_user restaurant_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U restaurant_user -d restaurant_db < backup.sql
```

### Redis Operations

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Monitor Redis
docker-compose exec redis redis-cli monitor

# Check Redis info
docker-compose exec redis redis-cli info
```

## 🔒 Security Features

### Rate Limiting
- API endpoints: 10 requests/second per IP
- Authentication endpoints: 1 request/second per IP
- Burst allowance with nodelay

### Security Headers
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

### Container Security
- Non-root users in all containers
- Read-only filesystems where applicable
- Limited resource allocation
- Health checks for service monitoring

## 📊 Monitoring and Health Checks

### Health Check Endpoints

```bash
# Application health
curl http://health.localhost/health

# Individual service health
curl http://localhost/api/health
```

### Container Health

```bash
# Check container health
docker-compose ps

# View health check logs
docker inspect --format='{{.State.Health}}' container_name
```

## 🚨 Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Check what's using port 80
netstat -tulpn | grep :80
# Stop conflicting services
sudo systemctl stop apache2  # or nginx
```

**Database connection issues:**
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Test database connection
docker-compose exec backend npm run test:db
```

**Build failures:**
```bash
# Clean build cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

**Memory issues:**
```bash
# Check container resource usage
docker stats

# Increase Docker memory limit
# Docker Desktop: Settings > Resources > Memory
```

### Log Analysis

```bash
# View all logs
docker-compose logs

# Follow logs with timestamps
docker-compose logs -f -t

# Filter logs by service
docker-compose logs nginx | grep error
```

## 🔄 Maintenance

### Updates

```bash
# Update base images
docker-compose pull

# Rebuild with latest dependencies
docker-compose build --no-cache

# Update and restart
docker-compose up --build -d
```

### Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Clean unused Docker resources
docker system prune -a
```

### Backup Strategy

```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
docker-compose exec postgres pg_dump -U restaurant_user restaurant_db > "backup_db_$DATE.sql"

# Backup uploaded files
tar -czf "backup_uploads_$DATE.tar.gz" uploads/

# Backup configuration
tar -czf "backup_config_$DATE.tar.gz" nginx/ .env
```

## 🎯 Production Deployment

### Environment Variables

For production, ensure you set:
- Strong database passwords
- Secure JWT secrets
- Production API URLs
- SSL certificates for HTTPS

### SSL Setup

1. Obtain SSL certificates (Let's Encrypt recommended)
2. Mount certificates in nginx/ssl/
3. Update nginx configuration for HTTPS
4. Redirect HTTP to HTTPS

### Performance Optimization

- Enable Nginx caching
- Configure proper cache headers
- Use CDN for static assets
- Monitor container resources
- Set up log rotation

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review Docker and service logs
3. Verify environment configuration
4. Check network connectivity between containers

## 🔖 References

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [Express.js Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)