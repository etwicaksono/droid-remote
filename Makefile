.PHONY: help install bridge web test clean logs

help:
	@echo "Droid Remote Control - Available Commands"
	@echo "=========================================="
	@echo "make install    - Install all dependencies"
	@echo "make bridge     - Start bridge server"
	@echo "make web        - Start web UI dev server"
	@echo "make test       - Run all tests"
	@echo "make test-m1    - Run Milestone 1 tests (Telegram)"
	@echo "make test-m2    - Run Milestone 2 tests (Bridge)"
	@echo "make test-m3    - Run Milestone 3 tests (Hooks)"
	@echo "make logs       - Show bridge server logs"
	@echo "make clean      - Clean generated files"
	@echo "make hooks      - Copy hooks to ~/.factory/hooks/"

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
