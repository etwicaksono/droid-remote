# Telegram-Droid Bridge Server Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY telegram-bridge/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy config module from project root
COPY config/ /app/config/

# Copy application code
COPY telegram-bridge/ /app/

# Create directories
RUN mkdir -p /app/logs /app/data

# Expose port
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8765/health || exit 1

# Run server
CMD ["python", "server.py"]
