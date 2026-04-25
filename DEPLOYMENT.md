# Deployment Guide

## Prerequisites

- Git
- Node.js 18+ (for frontend)
- Python 3.11+ (for backend)
- Docker & Docker Compose (optional)

## Local Development

### 1. Clone & Setup

```bash
# Navigate to project
cd aegis

# Create environment file
cp .env.example .env

# Open .env and add your keys:
# - OPENAI_API_KEY (from https://platform.openai.com/api-keys)
# - SLACK_WEBHOOK_URL (from https://api.slack.com/apps)
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
```

Backend runs at: http://localhost:8000

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: http://localhost:3000

---

## Docker Deployment (Recommended)

### 1. Setup

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 2. Build & Run

```bash
# Build images
docker-compose build

# Run services
docker-compose up

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Ports:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

---

## Production Deployments

### Option 1: Heroku (Recommended for First Deploy)

#### Prerequisites
- Heroku account
- Heroku CLI installed

#### Deploy Backend

```bash
cd backend

# Create Heroku app
heroku create aegis-api

# Set environment variables
heroku config:set OPENAI_API_KEY=sk-...
heroku config:set SLACK_WEBHOOK_URL=https://...
heroku config:set ENVIRONMENT=production

# Create Procfile
echo "web: python main.py" > Procfile

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

#### Deploy Frontend

```bash
cd frontend

# Create Heroku app
heroku create aegis-frontend

# Create Procfile for Vite preview
echo "web: npm run preview" > Procfile

# Update vite.config.js for production
# Change preview port to process.env.PORT || 3000

# Deploy
git push heroku main

# Visit your site
heroku open
```

---

### Option 2: Railway (Easiest with GitHub)

#### Frontend Setup

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Connect your GitHub account
5. Select `aegis` repository
6. Configure:
   - Root Directory: `frontend`
   - Start Command: `npm run build && npm run preview`
   - Port: `3000`

#### Backend Setup

1. New Project → Deploy from GitHub
2. Select `aegis` repository
3. Configure:
   - Root Directory: `backend`
   - Start Command: `pip install -r requirements.txt && python main.py`
   - Port: `8000`
   - Environment Variables: Add OpenAI & Slack keys

---

### Option 3: Render (Free Tier Available)

#### Backend

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - Name: `aegis-api`
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python main.py`
   - Environment: Python 3.11
   - Free tier: OK

#### Frontend

1. New Web Service
2. Configure:
   - Name: `aegis-frontend`
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run preview`
   - Environment: Node

---

### Option 4: AWS EC2 (Full Control)

#### 1. Launch Instance

```bash
# Use Ubuntu 22.04 LTS (free tier eligible)
```

#### 2. SSH into Instance

```bash
ssh -i your-key.pem ubuntu@your-instance-ip
```

#### 3. Setup System

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Node & Python
sudo apt install -y nodejs npm python3 python3-pip python3-venv git

# Clone repository
git clone https://github.com/your-repo/aegis.git
cd aegis
```

#### 4. Deploy with PM2

```bash
# Install PM2
sudo npm install -g pm2

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pm2 start "python main.py" --name aegis-api
pm2 save

# Frontend
cd ../frontend
npm install
npm run build
pm2 start "npm run preview" --name aegis-frontend
pm2 save

# Enable startup
pm2 startup
```

#### 5. Setup Nginx Proxy

```bash
sudo apt install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/aegis
```

```nginx
upstream backend {
    server 127.0.0.1:8000;
}

upstream frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/aegis /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. Add SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

### Option 5: DigitalOcean App Platform

#### 1. Create app.yaml

```yaml
name: aegis
services:
- name: api
  github:
    repo: your-username/aegis
    branch: main
  build_command: cd backend && pip install -r requirements.txt
  run_command: cd backend && python main.py
  environment_slug: python
  
- name: web
  github:
    repo: your-username/aegis
    branch: main
  build_command: cd frontend && npm install && npm run build
  run_command: cd frontend && npm run preview
  environment_slug: node

envs:
- key: OPENAI_API_KEY
  scope: api
  value: ${OPENAI_API_KEY}
- key: SLACK_WEBHOOK_URL
  scope: api
  value: ${SLACK_WEBHOOK_URL}
```

#### 2. Deploy

```bash
# Install doctl
# Go to https://docs.digitalocean.com/reference/doctl/

# Deploy
doctl apps create --spec app.yaml
```

---

## Environment Configuration

### Production .env

```bash
# API
ENVIRONMENT=production
PORT=8000
CORS_ORIGINS=https://your-frontend.com,https://www.your-frontend.com

# AI
OPENAI_API_KEY=sk-prod-key-here

# Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Database
DATABASE_URL=sqlite:///./data/aegis.db
# For production, consider PostgreSQL:
# DATABASE_URL=postgresql://user:pass@localhost/aegis
```

---

## Post-Deployment Checklist

- [ ] Environment variables set correctly
- [ ] API endpoints accessible
- [ ] Frontend loads without errors
- [ ] Rate limiting working
- [ ] Database initialized
- [ ] Slack alerts configured (if using)
- [ ] HTTPS enabled (production)
- [ ] CORS properly configured
- [ ] Monitoring/logging setup
- [ ] Backups configured

---

## Monitoring

### View Logs

**Heroku:**
```bash
heroku logs --tail
```

**Railway/Render:**
View in dashboard

**AWS EC2 with PM2:**
```bash
pm2 logs aegis-api
pm2 logs aegis-frontend
```

### Health Check

```bash
curl https://your-api.com/health
# Should return:
# {"status": "healthy", "version": "1.0.0", ...}
```

---

## Scaling & Optimization

### Short Term (100-1K users)
- CDN for frontend (Cloudflare)
- Database backups
- Monitoring alerts

### Medium Term (1K-10K users)
- Redis caching
- Database replicas
- Read-only API instances

### Long Term (10K+ users)
- Microservices
- Kubernetes orchestration
- Message queues
- Database sharding

---

## Troubleshooting

### Backend won't start

```bash
# Check Python version
python --version  # Should be 3.11+

# Check port
lsof -i :8000

# Reinstall dependencies
pip install --force-reinstall -r requirements.txt
```

### Frontend shows "API Error"

```bash
# Check CORS_ORIGINS in backend .env
# Frontend URL must be in the list

# Test connectivity
curl https://your-api.com/health
```

### Database errors

```bash
# Check database file exists
ls -la backend/data/

# Check permissions
chmod 755 backend/data/
```

### Heroku memory issues

```bash
# Upgrade dyno
heroku dynos:type standard-1x

# Or optimize code:
pip install -U pip
pip install --upgrade fastapi uvicorn
```

---

## Support

- Open an issue on GitHub
- Check application logs
- Review deployment guide above

**Happy deploying! 🚀**
