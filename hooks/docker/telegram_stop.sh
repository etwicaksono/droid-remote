#!/bin/bash
# Docker wrapper for telegram_stop.py
# Runs the hook inside the droid-bridge container

docker exec -i droid-bridge python /app/hooks/telegram_stop.py "$@"
