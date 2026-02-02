#!/bin/bash
# Docker wrapper for telegram_post_tool.py
# Runs the hook inside the droid-bridge container

docker exec -i droid-bridge python /app/hooks/telegram_post_tool.py "$@"
