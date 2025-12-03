.PHONY: help install bridge web test clean logs docker-test docker-test-build docker-test-clean docker-up docker-down

help:
	@echo "Droid Remote Control - Available Commands"
	@echo "=========================================="
	@echo "make install         - Install all dependencies"
	@echo "make bridge          - Start bridge server"
	@echo "make web             - Start web UI dev server"
	@echo "make test            - Run all tests"
	@echo "make test-m1         - Run Milestone 1 tests (Telegram)"
	@echo "make test-m2         - Run Milestone 2 tests (Bridge)"
	@echo "make test-m3         - Run Milestone 3 tests (Hooks)"
	@echo "make logs            - Show bridge server logs"
	@echo "make clean           - Clean generated files"
	@echo "make hooks           - Copy hooks to ~/.factory/hooks/"
	@echo "make docker-up       - Build and start main containers"
	@echo "make docker-down     - Stop and remove main containers"
	@echo "make docker-test       - Test build (pause main, run test, resume main)"
	@echo "make docker-test-build - Build only, verify no errors"
	@echo "make docker-test-clean - Cleanup test containers and resume main"

install:
	cd telegram-bridge && pip install -r requirements.txt
	cd telegram-bridge/web && npm install

bridge:
	cd telegram-bridge && python server.py

web:
	cd telegram-bridge/web && npm run build && npm run start

test: test-m1 test-m2 test-m3

test-m1:
	cd tests && python test_milestone_1.py

test-m2:
	cd tests && python test_milestone_2.py

test-m3:
	cd tests && python test_milestone_3.py

logs:
	@if exist telegram-bridge\logs\bridge.log (type telegram-bridge\logs\bridge.log) else (echo No logs found)

clean:
	del /s /q *.pyc 2>nul
	del /s /q __pycache__ 2>nul
	del /s /q hooks\*.log 2>nul
	del /s /q telegram-bridge\logs\*.log 2>nul

hooks:
	@echo Copying hooks to ~/.factory/hooks/
	xcopy /E /I /Y hooks "%USERPROFILE%\.factory\hooks"
	@echo Done! Restart Droid to load new hooks.

docker-up:
	docker compose up -d --build
	@echo Containers started. View logs with: docker compose logs -f

docker-down:
	docker compose down
	@echo Containers stopped.

docker-test:
	@echo Building test images...
	docker compose -p droid-test build
	@echo Pausing main containers...
	-docker compose stop
	@echo Starting test containers...
	@echo Press Ctrl+C to stop, then run 'make docker-test-clean'
	-docker compose -p droid-test up --abort-on-container-exit
	@echo Run 'make docker-test-clean' to cleanup and resume main containers

docker-test-clean:
	@echo Cleaning up test containers...
	-docker compose -p droid-test down -v --remove-orphans
	@echo Resuming main containers...
	docker compose start
	@echo Done! Main containers resumed.

docker-test-build:
	@echo Building test images only (no run)...
	docker compose -p droid-test build
	@echo Build successful!
