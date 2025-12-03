#!/bin/bash
# Docker wrapper for telegram_session_end.py
# Runs the hook inside the droid-bridge container

docker exec -i droid-bridge python /app/hooks/telegram_session_end.py "$@"
