# 🚀 Agentic Flow - Deployment Package

Complete production-ready deployment package for Agentic Flow AI agent framework.

## 📦 What's Included

```
deployment/
├── quick-deploy.sh              # One-command deployment script ⚡
├── .env.example                 # Configuration template
├── docker-compose.yml           # Simple deployment
├── docker-compose.production.yml # Production with monitoring
├── docker-compose.agent.yml     # Development mode
├── Dockerfile                   # Container image
├── DEPLOYMENT.md               # Complete deployment guide
├── k8s/                        # Kubernetes manifests
│   └── deployment.yaml         # K8s deployment config
└── monitoring/                 # Monitoring stack
    ├── dashboard.html          # Real-time dashboard
    └── nginx.conf              # Load balancer config
```

## ⚡ Quick Start (60 Seconds)

### Option 1: Automated Script

```bash
cd agentic-flow/deployment

# Copy and configure environment
cp .env.example .env
nano .env  # Add your API keys

# Run automated deployment
./quick-deploy.sh
```

The script will:
1. ✅ Check prerequisites (Docker, Docker Compose)
2. ✅ Validate configuration
3. ✅ Build Docker image
4. ✅ Start services
5. ✅ Run health checks
6. ✅ Display access information

### Option 2: Manual Deployment

```bash
# 1. Configure
cp .env.example .env
# Edit .env with your settings

# 2. Build and start
docker-compose -f docker-compose.production.yml up -d

# 3. Check status
docker-compose -f docker-compose.production.yml ps

# 4. View logs
docker-compose -f docker-compose.production.yml logs -f
```

## 🔑 Configuration

### Minimum Required (.env)

```bash
PROVIDER=openrouter              # or anthropic, gemini, onnx
OPENROUTER_API_KEY=sk-or-...    # Your API key
COMPLETION_MODEL=deepseek/deepseek-chat
```

### Recommended Production Settings

```bash
# Provider
PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-key-here
COMPLETION_MODEL=deepseek/deepseek-chat

# Features
ENABLE_AGENT_BOOSTER=true       # 352x faster code ops
REASONINGBANK_ENABLED=true      # Learning memory
ENABLE_QUIC=true                # Fast transport
ENABLE_OPTIMIZATION=true        # Cost optimization

# Runtime
NODE_ENV=production
HEALTH_PORT=8080
KEEP_ALIVE=true
```

## 📊 Access Points

After deployment:

| Service | URL | Description |
|---------|-----|-------------|
| **Health Check** | http://localhost:8080/health | API health status |
| **Dashboard** | http://localhost:8081 | Real-time monitoring |
| **QUIC Transport** | localhost:4433 | Agent communication |

## 🧪 Testing Deployment

```bash
# 1. Health check
curl http://localhost:8080/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-18T..."}

# 2. Run test agent
docker exec -it agentic-flow-production \
  node dist/index.js --agent coder --task "Create hello world function"

# 3. Check logs
docker-compose -f docker-compose.production.yml logs -f agentic-flow
```

## 🏗️ Deployment Modes

### 1. Development Mode

Fast iteration with hot reload:

```bash
docker-compose -f docker-compose.agent.yml up
```

Features:
- Single container
- Live code updates
- Detailed logging
- No persistent storage

### 2. Simple Production

Basic production setup:

```bash
docker-compose up -d
```

Features:
- Single container
- Auto-restart
- Persistent storage
- Health checks

### 3. Production with Monitoring

Full production stack:

```bash
docker-compose -f docker-compose.production.yml up -d
```

Features:
- ✅ Multiple containers
- ✅ Load balancing
- ✅ Real-time dashboard
- ✅ Health monitoring
- ✅ Resource limits
- ✅ Auto-scaling support

### 4. Kubernetes

Enterprise-grade deployment:

```bash
# Create namespace
kubectl create namespace agentic-flow

# Create secrets
kubectl create secret generic agentic-flow-secrets \
  --from-literal=openrouter-api-key=your_key \
  -n agentic-flow

# Deploy
kubectl apply -f k8s/ -n agentic-flow

# Check status
kubectl get pods -n agentic-flow
```

Features:
- ✅ High availability (3+ replicas)
- ✅ Auto-scaling (2-10 pods)
- ✅ Load balancing
- ✅ Rolling updates
- ✅ Health checks
- ✅ Persistent storage

## 💰 Cost Optimization Guide

### Provider Comparison

| Provider | Cost/1M Tokens | Speed | Use Case |
|----------|---------------|-------|----------|
| **ONNX (Local)** | $0.00 | Good | Privacy, offline |
| **DeepSeek** | $0.14 | Fast | High volume |
| **Gemini Flash** | $0.10 | Very Fast | Balanced |
| **Claude Sonnet** | $3.00 | Best | Quality critical |

### Recommended Setup by Scale

**Small (<1000 requests/day):**
```bash
PROVIDER=onnx  # 100% free local inference
```

**Medium (1000-10000/day):**
```bash
PROVIDER=openrouter
COMPLETION_MODEL=deepseek/deepseek-chat  # $0.14/M tokens
```

**Large (>10000/day):**
```bash
PROVIDER=gemini
COMPLETION_MODEL=gemini-2.0-flash-exp  # $0.10/M tokens
ENABLE_OPTIMIZATION=true
```

## 📈 Scaling

### Horizontal Scaling (Docker Compose)

```bash
# Scale to 5 instances
docker-compose -f docker-compose.production.yml up -d --scale agentic-flow=5

# Check instances
docker-compose -f docker-compose.production.yml ps
```

### Kubernetes Auto-scaling

Already configured in `k8s/deployment.yaml`:
- Min replicas: 2
- Max replicas: 10
- CPU trigger: 70%
- Memory trigger: 80%

## 🔒 Security Checklist

- [ ] API keys stored in environment variables (not in code)
- [ ] `.env` file added to `.gitignore`
- [ ] Docker secrets used in production
- [ ] Health endpoint not exposed to public internet
- [ ] Resource limits set in docker-compose
- [ ] Regular security updates applied

## 🛠️ Common Commands

```bash
# Start services
docker-compose -f docker-compose.production.yml up -d

# Stop services
docker-compose -f docker-compose.production.yml down

# Restart services
docker-compose -f docker-compose.production.yml restart

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Check status
docker-compose -f docker-compose.production.yml ps

# Execute command in container
docker exec -it agentic-flow-production <command>

# Rebuild after code changes
docker-compose -f docker-compose.production.yml build --no-cache
docker-compose -f docker-compose.production.yml up -d

# Clean up everything
docker-compose -f docker-compose.production.yml down -v
```

## 📊 Monitoring

### Dashboard Access

Open http://localhost:8081 in your browser to see:
- System status (online/offline)
- Performance metrics
- Resource usage
- Real-time logs

### Health Checks

```bash
# Docker health check
docker inspect agentic-flow-production | grep Health -A 10

# Manual check
curl http://localhost:8080/health
```

### Logs

```bash
# Live logs
docker-compose -f docker-compose.production.yml logs -f

# Last 100 lines
docker-compose -f docker-compose.production.yml logs --tail=100

# Export logs
docker-compose -f docker-compose.production.yml logs --no-color > logs.txt
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs agentic-flow-production

# Common issues:
# 1. Missing API key - Check .env file
# 2. Port conflict - Change HEALTH_PORT
# 3. Build failed - Try rebuilding with --no-cache
```

### Agent Execution Fails

```bash
# Check environment
docker exec agentic-flow-production env | grep PROVIDER

# Test health
docker exec agentic-flow-production curl http://localhost:8080/health

# Check agent list
docker exec agentic-flow-production node dist/index.js --list
```

### Performance Issues

```bash
# Check resource usage
docker stats agentic-flow-production

# Increase limits in docker-compose.production.yml:
# resources:
#   limits:
#     cpus: '4.0'
#     memory: 8G
```

## 📚 Additional Resources

- **Full Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Main README**: [../README.md](../README.md)
- **Agent Booster**: [../../agent-booster/README.md](../../agent-booster/README.md)
- **ReasoningBank**: [../src/reasoningbank/README.md](../src/reasoningbank/README.md)

## 🆘 Support

- **Issues**: https://github.com/ruvnet/agentic-flow/issues
- **Discussions**: https://github.com/ruvnet/agentic-flow/discussions

---

**Ready to deploy! 🚀**

Choose your deployment method and get started in 60 seconds.

