#!/bin/bash
# Docker wrapper for telegram_pre_tool.py
# Runs the hook inside the droid-bridge container

docker exec -i droid-bridge python /app/hooks/telegram_pre_tool.py "$@"
