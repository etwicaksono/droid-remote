#!/bin/bash
# Docker wrapper for telegram_subagent_stop.py
# Runs the hook inside the droid-bridge container

docker exec -i droid-bridge python /app/hooks/telegram_subagent_stop.py "$@"
