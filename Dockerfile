# Development Dockerfile with hot reloading support
FROM node:20-slim

# Install additional tools needed for development
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose Vite dev server and PartyKit server ports
EXPOSE 5173 1999

# Default command runs the dev server
CMD ["npm", "run", "dev"]
