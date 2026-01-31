# ============================================
# Docker Development Commands
# ============================================

.PHONY: build up down restart logs shell clean prune production

# Build the Docker image
build:
	docker compose build

# Start the dev container (with build if needed)
up:
	docker compose up --build

# Start in detached mode
up-d:
	docker compose up -d --build

# Stop the container
down:
	docker compose down

# Restart the container
restart:
	docker compose down && docker compose up --build

# View container logs
logs:
	docker compose logs -f

# Open a shell inside the running container
shell:
	docker compose exec app sh

# Remove containers, networks, and volumes
clean:
	docker compose down -v --remove-orphans

# Remove all unused Docker resources (use with caution)
prune:
	docker system prune -f

# Install new npm packages (rebuilds node_modules volume)
install:
	docker compose down -v
	docker compose up --build

# Run a one-off npm command inside the container
npm:
	docker compose exec app npm $(filter-out $@,$(MAKECMDGOALS))

# Prevent make from treating arguments as targets
%:
	@:

# ============================================
# Production Deployment (run on server)
# ============================================

# Deploy to production (run this on the production server)
production:
	git config --global --add safe.directory /root/h2h
	@if [ -d "/root/h2h/.git" ]; then \
		cd /root/h2h && \
		git fetch origin && \
		git reset --hard origin/main && \
		git clean -fd; \
	else \
		mkdir -p /root/h2h && \
		git clone git@github.com:jpzk/human-to-human.git /root/h2h; \
	fi
	cd /root/h2h && \
	docker compose -f docker-compose.prod.yml down || true && \
	docker compose -f docker-compose.prod.yml build --no-cache && \
	docker compose -f docker-compose.prod.yml up -d && \
	docker image prune -f
	@echo "Deployment complete!"
