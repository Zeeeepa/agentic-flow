# 🚀 Agentic Flow Deployment Guide

Complete guide for deploying Agentic Flow in production environments.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Deployment Options](#deployment-options)
- [Configuration](#configuration)
- [Production Setup](#production-setup)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- API key for your chosen LLM provider

### 1. Clone and Configure

```bash
# Navigate to deployment directory
cd agentic-flow/deployment

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env  # or vim, code, etc.
```

### 2. Choose Your Provider

Edit `.env` and set:

```bash
# For OpenRouter (recommended - 100+ models, best pricing)
PROVIDER=openrouter
OPENROUTER_API_KEY=your_key_here
COMPLETION_MODEL=deepseek/deepseek-chat

# OR for Anthropic Claude
PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key_here
COMPLETION_MODEL=claude-sonnet-4-5-20250929

# OR for Google Gemini
PROVIDER=gemini
GOOGLE_GEMINI_API_KEY=your_key_here
COMPLETION_MODEL=gemini-2.0-flash-exp

# OR for local ONNX (100% free, no API key needed)
PROVIDER=onnx
```

### 3. Deploy

```bash
# Production deployment
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f agentic-flow
```

### 4. Test

```bash
# Health check
curl http://localhost:8080/health

# Run a test agent
docker exec -it agentic-flow-production \
  node dist/index.js --agent coder --task "Create a hello world function"
```

---

## 🎯 Deployment Options

### Option 1: Docker Compose (Recommended)

**Best for:** Single server, easy setup, quick deployment

```bash
# Simple deployment
docker-compose up -d

# Production deployment with monitoring
docker-compose -f docker-compose.production.yml up -d

# Scale agents
docker-compose -f docker-compose.production.yml up -d --scale agentic-flow=3
```

### Option 2: Docker Run

**Best for:** Minimal setup, testing, CI/CD

```bash
# Build image
docker build -t agentic-flow:latest -f Dockerfile ..

# Run container
docker run -d \
  --name agentic-flow \
  --env-file .env \
  -p 8080:8080 \
  -p 4433:4433 \
  -v agentic-flow-data:/app/.swarm \
  --restart unless-stopped \
  agentic-flow:latest \
  --agent coder --task "Your task here"
```

### Option 3: Kubernetes

**Best for:** Large-scale, production clusters, high availability

```bash
# Create namespace
kubectl create namespace agentic-flow

# Create secret with API keys
kubectl create secret generic agentic-flow-secrets \
  --from-literal=ANTHROPIC_API_KEY=your_key \
  --from-literal=OPENROUTER_API_KEY=your_key \
  -n agentic-flow

# Apply deployment
kubectl apply -f k8s/ -n agentic-flow

# Check status
kubectl get pods -n agentic-flow
```

### Option 4: AWS ECS

**Best for:** AWS infrastructure, managed containers

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag agentic-flow:latest <account>.dkr.ecr.us-east-1.amazonaws.com/agentic-flow:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/agentic-flow:latest

# Create task definition and service via AWS Console or CLI
aws ecs create-service \
  --cluster agentic-flow-cluster \
  --service-name agentic-flow \
  --task-definition agentic-flow:1 \
  --desired-count 2
```

### Option 5: Google Cloud Run

**Best for:** Serverless, auto-scaling, pay-per-use

```bash
# Build and deploy
gcloud run deploy agentic-flow \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars PROVIDER=gemini \
  --set-secrets GOOGLE_GEMINI_API_KEY=gemini-key:latest
```

### Option 6: Vercel/Cloudflare Workers

**Best for:** Edge deployment, global distribution

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd ../
vercel deploy --prod
```

---

## ⚙️ Configuration

### Environment Variables

#### **Provider Configuration**

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `PROVIDER` | LLM provider to use | Yes | `openrouter`, `anthropic`, `gemini`, `onnx` |
| `ANTHROPIC_API_KEY` | Claude API key | If using Anthropic | `sk-ant-...` |
| `OPENROUTER_API_KEY` | OpenRouter API key | If using OpenRouter | `sk-or-...` |
| `GOOGLE_GEMINI_API_KEY` | Gemini API key | If using Gemini | `AIza...` |
| `COMPLETION_MODEL` | Model to use | No | `deepseek/deepseek-chat` |

#### **Feature Flags**

| Variable | Description | Default | Values |
|----------|-------------|---------|--------|
| `ENABLE_AGENT_BOOSTER` | Ultra-fast code ops | `true` | `true`, `false` |
| `REASONINGBANK_ENABLED` | Learning memory | `true` | `true`, `false` |
| `ENABLE_QUIC` | Fast transport | `true` | `true`, `false` |
| `ENABLE_OPTIMIZATION` | Cost optimization | `true` | `true`, `false` |
| `ENABLE_STREAMING` | Stream responses | `true` | `true`, `false` |

#### **Runtime Configuration**

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `HEALTH_PORT` | Health check port | `8080` |
| `QUIC_PORT` | QUIC transport port | `4433` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `KEEP_ALIVE` | Keep container running | `true` |

#### **Task Configuration (Parallel Mode)**

| Variable | Description | Example |
|----------|-------------|---------|
| `TOPIC` | Research topic | `migrate payments service` |
| `DIFF` | Code diff to review | `feat: add payments router` |
| `DATASET` | Data to analyze | `monthly tx volume` |

---

## 🏭 Production Setup

### 1. Create Production Environment File

```bash
cd deployment
cp .env.example .env.production

# Edit with production settings
nano .env.production
```

### 2. Security Hardening

```bash
# Use secrets management (recommended)
# AWS Secrets Manager
aws secretsmanager create-secret \
  --name agentic-flow/api-keys \
  --secret-string file://secrets.json

# Or Docker secrets
echo "your_api_key" | docker secret create openrouter_key -

# Update docker-compose.production.yml to use secrets
```

### 3. Persistent Storage

```bash
# Create named volumes for data persistence
docker volume create agentic-flow-reasoningbank
docker volume create agentic-flow-workspace

# Backup strategy
docker run --rm \
  -v agentic-flow-reasoningbank:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/reasoningbank-$(date +%Y%m%d).tar.gz /data
```

### 4. Monitoring Setup

```bash
# Create monitoring directory
mkdir -p monitoring

# Add monitoring dashboard (example provided in repo)
# Access at http://localhost:8081
```

### 5. Load Balancing (Multi-Instance)

```bash
# Scale horizontally
docker-compose -f docker-compose.production.yml up -d --scale agentic-flow=5

# Or use Nginx reverse proxy
# Config provided in monitoring/nginx.conf
```

---

## 📊 Monitoring

### Health Checks

```bash
# Container health
docker-compose -f docker-compose.production.yml ps

# Application health
curl http://localhost:8080/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-18T19:00:00.000Z"}
```

### Logs

```bash
# Follow logs
docker-compose -f docker-compose.production.yml logs -f

# Filter by service
docker-compose -f docker-compose.production.yml logs -f agentic-flow

# Export logs
docker-compose -f docker-compose.production.yml logs --no-color > logs.txt
```

### Metrics

```bash
# Container stats
docker stats agentic-flow-production

# Resource usage
docker inspect agentic-flow-production | grep -A 10 "Memory"
```

### ReasoningBank Statistics

```bash
# Check learning database
docker exec agentic-flow-production \
  sqlite3 /app/.swarm/memory.db "SELECT COUNT(*) FROM pattern_memories;"

# View recent memories
docker exec agentic-flow-production \
  node -e "const rb = require('./dist/reasoningbank'); rb.db.getRecentMemories(10).then(console.log)"
```

---

## 🔧 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs agentic-flow-production

# Common issues:
# 1. Missing API key
grep "API_KEY" .env  # Verify keys are set

# 2. Port conflict
lsof -i :8080  # Check if port is in use

# 3. Build errors
docker-compose -f docker-compose.production.yml build --no-cache
```

### Agent Execution Fails

```bash
# Test connection
docker exec -it agentic-flow-production curl -v http://localhost:8080/health

# Verify provider configuration
docker exec -it agentic-flow-production env | grep PROVIDER

# Test API key
docker exec -it agentic-flow-production \
  node -e "console.log(process.env.OPENROUTER_API_KEY?.substring(0,10))"
```

### Performance Issues

```bash
# Check resource limits
docker inspect agentic-flow-production | grep -A 5 "Resources"

# Increase limits in docker-compose.production.yml:
# resources:
#   limits:
#     cpus: '4.0'
#     memory: 8G

# Restart with new limits
docker-compose -f docker-compose.production.yml up -d
```

### ReasoningBank Not Learning

```bash
# Verify ReasoningBank is enabled
docker exec agentic-flow-production env | grep REASONINGBANK_ENABLED

# Check database exists
docker exec agentic-flow-production ls -la /app/.swarm/

# Reset database (caution: deletes learning data)
docker exec agentic-flow-production rm /app/.swarm/memory.db
docker-compose -f docker-compose.production.yml restart
```

---

## 🔐 Security Best Practices

### 1. API Key Management

```bash
# Never commit .env files
echo ".env*" >> .gitignore

# Use environment-specific files
.env.development
.env.staging
.env.production  # Never commit!

# Use secrets management
docker secret create openrouter_key -
kubectl create secret generic api-keys --from-literal=key=value
```

### 2. Network Security

```bash
# Restrict container network access
docker-compose -f docker-compose.production.yml up -d --network agentic-network

# Use firewall rules
sudo ufw allow 8080/tcp  # Health checks only
sudo ufw deny 4433/tcp   # Internal QUIC only
```

### 3. Container Security

```bash
# Run as non-root user (add to Dockerfile)
USER node

# Read-only root filesystem
docker run --read-only -v /tmp:/tmp agentic-flow:latest

# Security scanning
docker scan agentic-flow:latest
```

---

## 📈 Scaling Strategies

### Horizontal Scaling

```bash
# Docker Compose
docker-compose -f docker-compose.production.yml up -d --scale agentic-flow=10

# Kubernetes
kubectl scale deployment agentic-flow --replicas=10
```

### Vertical Scaling

```bash
# Increase container resources
# Edit docker-compose.production.yml:
deploy:
  resources:
    limits:
      cpus: '8.0'
      memory: 16G
```

### Load Distribution

```bash
# Use Nginx for load balancing
upstream agentic_flow {
    least_conn;
    server agentic-flow-1:8080;
    server agentic-flow-2:8080;
    server agentic-flow-3:8080;
}
```

---

## 🎯 Cost Optimization

### Provider Selection by Use Case

| Use Case | Recommended Provider | Cost/1M Tokens | Speed |
|----------|---------------------|----------------|-------|
| **High Volume** | OpenRouter (DeepSeek) | $0.14 | Fast |
| **Quality Critical** | Anthropic (Claude) | $3.00 | Best |
| **Privacy Required** | ONNX (Local) | $0.00 | Good |
| **Balanced** | Gemini Flash | $0.10 | Very Fast |

### Enable Cost Optimization

```bash
# In .env
ENABLE_OPTIMIZATION=true
USE_COST_OPTIMIZATION=true
PROVIDER=openrouter
COMPLETION_MODEL=deepseek/deepseek-chat  # Best value
```

---

## 📚 Additional Resources

- [Main README](../README.md)
- [Agent Booster Documentation](../../agent-booster/README.md)
- [ReasoningBank Guide](../src/reasoningbank/README.md)
- [Multi-Model Router](../src/router/README.md)
- [GitHub Repository](https://github.com/ruvnet/agentic-flow)

---

## 💬 Support

- **Issues**: https://github.com/ruvnet/agentic-flow/issues
- **Discussions**: https://github.com/ruvnet/agentic-flow/discussions
- **Documentation**: https://github.com/ruvnet/agentic-flow/tree/main/docs

---

**Ready to deploy! 🚀**

For any issues or questions, please open an issue on GitHub.

