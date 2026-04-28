# Infrastructure & DevOps — Service Context for AI Agent

> **Read `PLANNING.md` first.** This file provides focused context for infrastructure setup, Docker, deployment, and CI/CD.

---

## 1. Role in the Stack

Infrastructure supports **all** services. You provision the foundation that every other service runs on. Your decisions directly impact reliability, performance, and developer productivity.

---

## 2. Local Development (Docker Compose)

```yaml
# infrastructure/docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:16-3.4
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: fm_db
      POSTGRES_USER: fm_user
      POSTGRES_PASSWORD: fm_dev_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d  # Enable PostGIS extensions
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fm_user -d fm_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio
    ports:
      - "9000:9000"     # S3 API
      - "9001:9001"     # Console
    environment:
      MINIO_ROOT_USER: minio_admin
      MINIO_ROOT_PASSWORD: minio_password
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  api:
    build:
      context: ../fm-be
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      SPRING_PROFILES_ACTIVE: dev
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/fm_db
      SPRING_DATASOURCE_USERNAME: fm_user
      SPRING_DATASOURCE_PASSWORD: fm_dev_password
      SPRING_DATA_REDIS_HOST: redis
      SPRING_DATA_REDIS_PORT: 6379
      STORAGE_ENDPOINT: http://minio:9000
      STORAGE_ACCESS_KEY: minio_admin
      STORAGE_SECRET_KEY: minio_password
      STORAGE_BUCKET: fm-media
      JWT_SECRET: dev-jwt-secret-change-in-production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    # Note: Spring Boot @Async/@Scheduled handles background jobs internally.
    # No separate worker service needed (unlike Node.js/BullMQ).


volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### PostGIS Init Script
```sql
-- infrastructure/init-scripts/01-extensions.sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 3. Production Deployment

### 3.1 Server Setup (Ubuntu 22.04 LTS on VPS)

```
Architecture:
  NGINX (80/443) → systemd (Spring Boot JAR :8080, :8081) → PostgreSQL (:5432) + Redis (:6379)
  Static assets (web-portal, client-portal) served by NGINX directly

Prerequisites:
  - Java 17 LTS (via SDKMAN or apt)
  - PostgreSQL 16 + PostGIS 3.4
  - Redis 7
  - NGINX
  - systemd (process manager for Spring Boot JAR instances)
  - Certbot (Let's Encrypt SSL)
  - UFW firewall

Minimum VPS Specs (3,000 users):
  - CPU: 4 vCPUs
  - RAM: 8 GB (PostgreSQL ~3GB, Redis ~512MB, 2×API ~1GB each, OS ~2GB)
  - Disk: 100 GB SSD (DB + media cache + logs)
  - Network: 1 Gbps
```

### 3.1.1 PostgreSQL Production Tuning

```ini
# /etc/postgresql/16/main/postgresql.conf — tuned for 3,000+ users

# Connection limits (2 API instances × 20 pool + admin headroom)
max_connections = 60

# Memory (for 8 GB RAM VPS)
shared_buffers = 2GB           # 25% of RAM
effective_cache_size = 6GB     # 75% of RAM
work_mem = 16MB                # Per-query sort/hash memory
maintenance_work_mem = 512MB   # VACUUM, CREATE INDEX

# Write-ahead log
wal_buffers = 64MB
checkpoint_completion_target = 0.9

# Planner
random_page_cost = 1.1         # SSD-optimized
effective_io_concurrency = 200 # SSD-optimized

# Logging
log_min_duration_statement = 500  # Log queries taking >500ms
log_checkpoints = on
```

### 3.1.2 Redis Production Configuration

```conf
# /etc/redis/redis.conf — production settings

bind 127.0.0.1                 # Localhost only (security)
requirepass <strong-redis-password>

maxmemory 512mb                # Live locations for 3K users = ~600KB; generous headroom for cache
maxmemory-policy allkeys-lru   # Evict least-recently-used when full

# Persistence (AOF for durability — location data is transient but cache is valuable)
appendonly yes
appendfsync everysec

# Performance
tcp-keepalive 60
timeout 300
```

### 3.2 NGINX Configuration

```nginx
# /etc/nginx/nginx.conf — global tuning for 3,000+ users (~100 req/s sustained)
worker_processes auto;              # Match CPU cores (4 vCPUs = 4 workers)
worker_rlimit_nofile 8192;

events {
    worker_connections 2048;         # Per worker: 4 workers × 2048 = 8192 concurrent
    use epoll;                       # Linux high-performance
    multi_accept on;
}

# /etc/nginx/sites-available/fm-api.conf
upstream fm_api {
    server 127.0.0.1:8080;
    server 127.0.0.1:8081;
    keepalive 32;                    # Persistent connections to backend (reduces connection overhead)
}

server {
    listen 443 ssl http2;
    server_name api.fm.example.com;

    ssl_certificate /etc/letsencrypt/live/api.fm.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.fm.example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Rate limiting zones (defined in nginx.conf)
    # limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
    # limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

    # API proxy
    location /v1/ {
        proxy_pass http://fm_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Rate limit on auth endpoints
        location /v1/auth/ {
            limit_req zone=auth burst=5 nodelay;
            proxy_pass http://fm_api;
        }

        # General API rate limiting
        limit_req zone=api burst=50 nodelay;
    }

    # Health check (no rate limit)
    location /v1/health {
        proxy_pass http://fm_api;
    }

    # Request size limits
    client_max_body_size 50M;  # For video uploads (if proxied)
}

# Web Portal
server {
    listen 443 ssl http2;
    server_name portal.fm.example.com;
    root /var/www/fm-portal/dist;

    ssl_certificate /etc/letsencrypt/live/portal.fm.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.fm.example.com/privkey.pem;

    location / {
        try_files $uri $uri/ /index.html;  # SPA fallback
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Client Portal
server {
    listen 443 ssl http2;
    server_name client.fm.example.com;
    root /var/www/fm-client-portal/dist;
    # Same config as web portal
    location / { try_files $uri $uri/ /index.html; }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name api.fm.example.com portal.fm.example.com client.fm.example.com;
    return 301 https://$host$request_uri;
}
```

### 3.3 systemd Service Configuration

```ini
# /etc/systemd/system/fm-api-1.service
[Unit]
Description=Facility Management API Instance 1
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=fm
Group=fm
WorkingDirectory=/opt/fm-be
ExecStart=/usr/bin/java -Xms256m -Xmx512m -jar fm-be.jar --server.port=8080 --spring.profiles.active=prod
Restart=always
RestartSec=10
EnvironmentFile=/opt/fm-be/.env
StandardOutput=append:/var/log/fm/api-1.log
StandardError=append:/var/log/fm/api-1-error.log

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/fm-api-2.service — identical but port 8081
# Copy fm-api-1.service, change --server.port=8081 and log paths
```

```bash
# Management commands
sudo systemctl enable fm-api-1 fm-api-2
sudo systemctl start fm-api-1 fm-api-2
sudo systemctl status fm-api-1 fm-api-2
sudo journalctl -u fm-api-1 -f  # Follow logs
```

---

## 4. Database Management

### 4.1 Backups
```bash
# infrastructure/scripts/backup-db.sh
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/fm-db"
FILENAME="fm_db_${TIMESTAMP}.sql.gz"

pg_dump -h localhost -U fm_user fm_db | gzip > "${BACKUP_DIR}/${FILENAME}"

# Upload to R2/S3
aws s3 cp "${BACKUP_DIR}/${FILENAME}" "s3://fm-backups/db/${FILENAME}" --endpoint-url "$S3_ENDPOINT"

# Retain last 30 days locally
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +30 -delete
```

Schedule via cron: `0 2 * * * /var/www/fm-api/infrastructure/scripts/backup-db.sh`

### 4.2 Migrations
```bash
# Flyway migrations (embedded in Spring Boot, runs on application startup)
# Production: Flyway runs automatically when spring.flyway.enabled=true
# Development: Flyway runs automatically on startup against local PostgreSQL

# Manual migration (if needed outside Spring Boot):
mvn flyway:migrate -Dflyway.url=jdbc:postgresql://localhost:5432/fm_db -Dflyway.user=fm_user -Dflyway.password=fm_dev_password
```

### 4.3 PostGIS Indexes
```sql
-- Critical spatial indexes (run via migration)
CREATE INDEX idx_sites_geofence ON sites USING GIST (geofence);
CREATE INDEX idx_location_history_coords ON location_history 
  USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography);
CREATE INDEX idx_attendance_logs_employee_time ON attendance_logs (employee_id, punch_time DESC);
CREATE INDEX idx_location_history_recorded ON location_history (recorded_at DESC);

-- Partial index: only active sites
CREATE INDEX idx_active_sites ON sites (id) WHERE is_active = true;
```

---

## 5. Monitoring & Health

### 5.1 Health Check Endpoint
```
GET /v1/health → {
  "status": "healthy",
  "uptime": 86400,
  "services": {
    "database": "connected",
    "redis": "connected",
    "storage": "connected"
  },
  "version": "1.0.0"
}
```

### 5.2 Log Management
- API logs → `/var/log/fm/` (systemd managed)
- NGINX logs → `/var/log/nginx/`
- PostgreSQL logs → `/var/log/postgresql/`
- **Log rotation**: `logrotate` configured to rotate daily, keep 14 days

### 5.3 Uptime Monitoring
- External: UptimeRobot or BetterStack pinging `/v1/health` every 60s
- Alerting: Email/Slack on downtime

---

## 6. Security Hardening

```bash
# UFW Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp       # SSH
ufw allow 80/tcp       # HTTP (redirect to HTTPS)
ufw allow 443/tcp      # HTTPS
ufw enable

# Fail2ban for SSH brute force protection
apt install fail2ban
systemctl enable fail2ban

# PostgreSQL: listen only on localhost
# Redis: bind to 127.0.0.1 only, set password
# SSH: key-only auth, disable root login
```

---

## 7. Scaling Considerations (V1 → V2)

| Concern | V1 (1K-3K users) | V2 (10K+ users) |
|---------|-------------------|-------------------|
| API instances | 2 (PM2) | 4+ (Kubernetes/Docker Swarm) |
| Database | Single PostgreSQL | Read replicas, connection pooling (PgBouncer) |
| Redis | Single instance | Redis Cluster or managed (ElastiCache) |
| Object Storage | Cloudflare R2 | Same (R2 scales automatically) |
| Background Jobs | Spring @Async / @Scheduled (embedded) | Dedicated worker instances or Kubernetes Jobs |
| CDN | Cloudflare | Same |
| Location ingestion | Direct API | Consider message queue (Kafka/NATS) |
| Search | PostgreSQL FTS | Elasticsearch/Typesense |

---

## 8. Environment Matrix

| Variable | Dev | Staging | Production |
|----------|-----|---------|------------|
| `SPRING_PROFILES_ACTIVE` | dev | staging | prod |
| `DATABASE_URL` | Docker local | staging VPS | production VPS |
| `REDIS_URL` | Docker local | staging VPS | production VPS |
| `JWT_SECRET` | static dev key | unique | unique (rotated quarterly) |
| `LOG_LEVEL` | debug | info | info |
| `CORS_ORIGINS` | localhost:* | staging domains | production domains |
| `S3_ENDPOINT` | MinIO local | R2 | R2 |

---

## 9. Deployment Must-Dos

The following infrastructural concerns were identified during tech stack analysis that should be addressed before or during production launch:
- **Single VPS Risk & Database Failover**: The entire platform runs on a single VPS with a single PostgreSQL instance. Move to a 2-node setup (hot standby) and configure streaming replication before launch.
- **CI/CD Pipeline**: Establish automated testing and deployment pipelines (e.g., GitHub Actions or GitLab CI) to prevent manual deployment errors.
- **Secrets Management**: Adopt a secrets management tool (e.g., HashiCorp Vault, Doppler) rather than relying exclusively on unencrypted `.env` files in production.
