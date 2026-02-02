#!/bin/bash
# Docker wrapper for telegram_notify.py
# Runs the hook inside the droid-bridge container

docker exec -i droid-bridge python /app/hooks/telegram_notify.py "$@"
