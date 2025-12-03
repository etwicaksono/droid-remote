#!/bin/bash
# Docker wrapper for telegram_user_prompt.py
# Runs the hook inside the droid-bridge container

docker exec -i droid-bridge python /app/hooks/telegram_user_prompt.py "$@"
