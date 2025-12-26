#!/bin/bash

# Taobao Scraper API - Deployment Script
# This script helps you deploy and manage the Docker containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${NC}ℹ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    print_success "Docker and Docker Compose are installed"
}

# Build the Docker image
build() {
    print_info "Building Docker image..."
    docker-compose build
    print_success "Docker image built successfully"
}

# Start services
start() {
    print_info "Starting services..."
    docker-compose up -d
    print_success "Services started successfully"
    print_info "API available at: http://localhost:3000"
    print_info "Health check: http://localhost:3000/health"
}

# Start production services
start_prod() {
    print_info "Starting production services..."

    if [ ! -f .env.production ]; then
        print_warning ".env.production not found. Using defaults from .env.production.example"
        print_warning "Please create .env.production with secure credentials for production!"
    fi

    docker-compose -f docker-compose.prod.yml up -d
    print_success "Production services started successfully"
}

# Stop services
stop() {
    print_info "Stopping services..."
    docker-compose down
    print_success "Services stopped successfully"
}

# Stop production services
stop_prod() {
    print_info "Stopping production services..."
    docker-compose -f docker-compose.prod.yml down
    print_success "Production services stopped successfully"
}

# View logs
logs() {
    docker-compose logs -f
}

# View logs for production
logs_prod() {
    docker-compose -f docker-compose.prod.yml logs -f
}

# Check status
status() {
    print_info "Service Status:"
    docker-compose ps
    echo ""
    print_info "Checking health endpoint..."
    curl -s http://localhost:3000/health | json_pp || print_warning "Health endpoint not responding"
}

# Restart services
restart() {
    print_info "Restarting services..."
    docker-compose restart
    print_success "Services restarted successfully"
}

# Clean up (remove containers, networks, and volumes)
clean() {
    print_warning "This will remove all containers, networks, and volumes (including database data)"
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
        print_info "Cleaning up..."
        docker-compose down -v
        print_success "Cleanup completed"
    else
        print_info "Cleanup cancelled"
    fi
}

# Backup MongoDB
backup() {
    print_info "Creating MongoDB backup..."
    BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    docker exec mongodb mongodump \
        --username admin \
        --password admin \
        --authenticationDatabase admin \
        --db taobao_scraper \
        --out /tmp/backup

    docker cp mongodb:/tmp/backup "$BACKUP_DIR"
    print_success "Backup created at: $BACKUP_DIR"
}

# Show help
show_help() {
    cat << EOF
Taobao Scraper API - Docker Deployment Script

Usage: ./deploy.sh [command]

Commands:
    build           Build the Docker image
    start           Start development services (API + MongoDB)
    start:prod      Start production services with resource limits
    stop            Stop services
    stop:prod       Stop production services
    restart         Restart services
    logs            View service logs (follow mode)
    logs:prod       View production service logs
    status          Show service status and health
    backup          Backup MongoDB database
    clean           Remove all containers, networks, and volumes
    help            Show this help message

Examples:
    ./deploy.sh build          # Build the Docker image
    ./deploy.sh start          # Start services in development mode
    ./deploy.sh logs           # View logs
    ./deploy.sh status         # Check service status
    ./deploy.sh backup         # Create database backup
    ./deploy.sh clean          # Clean up everything

For more information, see README.Docker.md
EOF
}

# Main script
main() {
    check_docker

    case "${1:-}" in
        build)
            build
            ;;
        start)
            start
            ;;
        start:prod)
            start_prod
            ;;
        stop)
            stop
            ;;
        stop:prod)
            stop_prod
            ;;
        restart)
            restart
            ;;
        logs)
            logs
            ;;
        logs:prod)
            logs_prod
            ;;
        status)
            status
            ;;
        backup)
            backup
            ;;
        clean)
            clean
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: ${1:-}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"

