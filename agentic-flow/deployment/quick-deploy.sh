#!/bin/bash
# Agentic Flow - Quick Deployment Script
# This script automates the deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
cat << "EOF"
   ___                    __  _      ________             
  / _ | ___ ____ ___  ___/ /_(_)__  / __/ / /__ _    __
 / __ |/ _ `/ -_) _ \/ _  / / / _ \/ _// / / _ \ |/|/ /
/_/ |_|\_,_/\__/_//_/\_,_/_/_/\___/_/ /_/_/\___/__,__/ 
                                                         
        Ultra-Fast AI Agent Deployment
EOF
echo -e "${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from template...${NC}"
    
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env file${NC}"
        echo -e "${YELLOW}Please edit .env and add your API keys:${NC}"
        echo "  nano .env"
        echo ""
        echo "Required settings:"
        echo "  - PROVIDER: Choose 'openrouter', 'anthropic', 'gemini', or 'onnx'"
        echo "  - API_KEY: Add your provider's API key"
        echo ""
        read -p "Press Enter after configuring .env file..."
    else
        echo -e "${RED}Error: .env.example not found${NC}"
        exit 1
    fi
fi

# Validate .env has required keys
echo -e "${YELLOW}Validating configuration...${NC}"

source .env

if [ -z "$PROVIDER" ]; then
    echo -e "${RED}Error: PROVIDER not set in .env${NC}"
    exit 1
fi

# Check if API key is set based on provider
case "$PROVIDER" in
    anthropic)
        if [ -z "$ANTHROPIC_API_KEY" ]; then
            echo -e "${RED}Error: ANTHROPIC_API_KEY not set for anthropic provider${NC}"
            exit 1
        fi
        ;;
    openrouter)
        if [ -z "$OPENROUTER_API_KEY" ]; then
            echo -e "${RED}Error: OPENROUTER_API_KEY not set for openrouter provider${NC}"
            exit 1
        fi
        ;;
    gemini)
        if [ -z "$GOOGLE_GEMINI_API_KEY" ]; then
            echo -e "${RED}Error: GOOGLE_GEMINI_API_KEY not set for gemini provider${NC}"
            exit 1
        fi
        ;;
    onnx)
        echo -e "${GREEN}✓ ONNX provider selected (no API key needed)${NC}"
        ;;
    *)
        echo -e "${RED}Error: Invalid PROVIDER value: $PROVIDER${NC}"
        echo "Valid options: anthropic, openrouter, gemini, onnx"
        exit 1
        ;;
esac

echo -e "${GREEN}✓ Configuration valid${NC}"

# Ask deployment type
echo ""
echo -e "${BLUE}Select deployment type:${NC}"
echo "  1) Production (recommended - with monitoring)"
echo "  2) Simple (basic setup)"
echo "  3) Development (with hot reload)"
read -p "Enter choice [1-3]: " DEPLOY_TYPE

case $DEPLOY_TYPE in
    1)
        COMPOSE_FILE="docker-compose.production.yml"
        echo -e "${GREEN}Deploying production setup...${NC}"
        ;;
    2)
        COMPOSE_FILE="docker-compose.yml"
        echo -e "${GREEN}Deploying simple setup...${NC}"
        ;;
    3)
        COMPOSE_FILE="docker-compose.agent.yml"
        echo -e "${GREEN}Deploying development setup...${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice. Defaulting to production.${NC}"
        COMPOSE_FILE="docker-compose.production.yml"
        ;;
esac

# Build and deploy
echo ""
echo -e "${YELLOW}Building Docker image...${NC}"

if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

$DOCKER_COMPOSE -f $COMPOSE_FILE build --no-cache

echo -e "${GREEN}✓ Build complete${NC}"

echo ""
echo -e "${YELLOW}Starting services...${NC}"
$DOCKER_COMPOSE -f $COMPOSE_FILE up -d

echo -e "${GREEN}✓ Services started${NC}"

# Wait for health check
echo ""
echo -e "${YELLOW}Waiting for health check...${NC}"
sleep 10

HEALTH_URL="http://localhost:8080/health"
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s $HEALTH_URL > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Health check passed!${NC}"
        break
    else
        echo -n "."
        sleep 2
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo ""
    echo -e "${RED}Health check failed. Checking logs...${NC}"
    $DOCKER_COMPOSE -f $COMPOSE_FILE logs --tail=50
    exit 1
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  Deployment Successful! 🚀${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${BLUE}Access points:${NC}"
echo "  • Health Check: http://localhost:8080/health"
if [ "$COMPOSE_FILE" = "docker-compose.production.yml" ]; then
    echo "  • Dashboard: http://localhost:8081"
fi
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  • View logs:      $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo "  • Check status:   $DOCKER_COMPOSE -f $COMPOSE_FILE ps"
echo "  • Stop services:  $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "  • Restart:        $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
echo ""
echo -e "${BLUE}Test agent execution:${NC}"
echo "  docker exec -it agentic-flow-production \\"
echo "    node dist/index.js --agent coder --task 'Create hello world'"
echo ""
echo -e "${BLUE}ReasoningBank status:${NC}"
echo "  docker exec agentic-flow-production \\"
echo "    ls -lah /app/.swarm/"
echo ""
echo -e "${YELLOW}For detailed documentation, see: DEPLOYMENT.md${NC}"
echo ""

