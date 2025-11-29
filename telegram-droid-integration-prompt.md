# Telegram-Droid Integration: Complete Implementation Prompt

## Project Overview

Build a complete integration system that allows controlling Factory.ai Droid CLI from Telegram. The user should be able to receive notifications from Droid and send commands/responses back via Telegram bot.

## Development Approach: Test-Driven Milestones

**CRITICAL**: Implement features incrementally. After completing each milestone, run ALL tests for that milestone before proceeding. Do NOT move to the next milestone until all tests pass.

### Milestone Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Milestone 1: Telegram Bot Setup                                │
│  └─► Test: Bot responds to /start                               │
├─────────────────────────────────────────────────────────────────┤
│  Milestone 2: Bridge Server Core                                │
│  └─► Test: Health endpoint, session CRUD                        │
├─────────────────────────────────────────────────────────────────┤
│  Milestone 3: Hook Scripts                                      │
│  └─► Test: Each hook individually with mock data                │
├─────────────────────────────────────────────────────────────────┤
│  Milestone 4: Telegram + Bridge Integration                     │
│  └─► Test: End-to-end notification flow                         │
├─────────────────────────────────────────────────────────────────┤
│  Milestone 5: Web UI Core                                       │
│  └─► Test: Pages render, API calls work                         │
├─────────────────────────────────────────────────────────────────┤
│  Milestone 6: Web UI Real-time                                  │
│  └─► Test: WebSocket connection, live updates                   │
├─────────────────────────────────────────────────────────────────┤
│  Milestone 7: Multi-Session Support                             │
│  └─► Test: Multiple concurrent sessions                         │
├─────────────────────────────────────────────────────────────────┤
│  Milestone 8: Docker Deployment                                 │
│  └─► Test: Container builds, services communicate               │
├─────────────────────────────────────────────────────────────────┤
│  Milestone 9: Cloudflare Tunnel                                 │
│  └─► Test: Public URL accessible, auth works                    │
├─────────────────────────────────────────────────────────────────┤
│  Milestone 10: Full Integration                                 │
│  └─► Test: Complete flow from Droid to Telegram/Web and back    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Milestone 1: Telegram Bot Setup

### Implementation
1. Create bot via @BotFather
2. Save bot token
3. Get your chat ID via @userinfobot
4. Create minimal bot script that responds to /start

### Test Script: test_milestone_1.py

```python
"""
Milestone 1 Tests: Telegram Bot Setup
Run: python test_milestone_1.py
"""
import os
import asyncio
from telegram import Bot
from telegram.error import TelegramError

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

async def test_bot_connection():
    """Test 1.1: Bot can connect to Telegram API"""
    print("Test 1.1: Bot connection...")
    bot = Bot(token=BOT_TOKEN)
    me = await bot.get_me()
    assert me.is_bot, "Should be a bot"
    assert me.username, "Should have username"
    print(f"  ✅ Connected as @{me.username}")
    return True

async def test_send_message():
    """Test 1.2: Bot can send message to your chat"""
    print("Test 1.2: Send message...")
    bot = Bot(token=BOT_TOKEN)
    message = await bot.send_message(
        chat_id=CHAT_ID,
        text="🧪 Milestone 1 Test: If you see this, bot setup is working!"
    )
    assert message.message_id, "Should have message ID"
    print(f"  ✅ Message sent (ID: {message.message_id})")
    return True

async def test_bot_commands():
    """Test 1.3: Bot can set commands"""
    print("Test 1.3: Set bot commands...")
    bot = Bot(token=BOT_TOKEN)
    from telegram import BotCommand
    commands = [
        BotCommand("start", "Start the bot"),
        BotCommand("status", "Check status"),
        BotCommand("sessions", "List sessions"),
    ]
    result = await bot.set_my_commands(commands)
    assert result, "Should set commands successfully"
    print("  ✅ Commands registered")
    return True

async def run_all_tests():
    print("\n" + "="*50)
    print("MILESTONE 1: Telegram Bot Setup")
    print("="*50 + "\n")
    
    tests = [
        test_bot_connection,
        test_send_message,
        test_bot_commands,
    ]
    
    passed = 0
    for test in tests:
        try:
            await test()
            passed += 1
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
    
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{len(tests)} tests passed")
    print("="*50)
    
    if passed == len(tests):
        print("✅ MILESTONE 1 COMPLETE - Proceed to Milestone 2")
    else:
        print("❌ MILESTONE 1 INCOMPLETE - Fix failing tests before proceeding")
    
    return passed == len(tests)

if __name__ == "__main__":
    asyncio.run(run_all_tests())
```

### ✅ Milestone 1 Checklist
- [ ] Bot token saved in .env
- [ ] Chat ID saved in .env
- [ ] test_bot_connection passes
- [ ] test_send_message passes
- [ ] test_bot_commands passes
- [ ] Received test message on Telegram

**⛔ STOP: Do not proceed to Milestone 2 until all tests pass**

---

## Milestone 2: Bridge Server Core

### Implementation
1. Create FastAPI server with health endpoint
2. Implement session registry (in-memory)
3. Implement REST API for sessions
4. Add Socket.IO server

### Test Script: test_milestone_2.py

```python
"""
Milestone 2 Tests: Bridge Server Core
Run: python test_milestone_2.py
Requires: Bridge server running on localhost:8765
"""
import requests
import json
import time

BASE_URL = "http://localhost:8765"

def test_health_endpoint():
    """Test 2.1: Health endpoint returns OK"""
    print("Test 2.1: Health endpoint...")
    response = requests.get(f"{BASE_URL}/health", timeout=5)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert "status" in data, "Should have status field"
    assert data["status"] == "healthy", "Should be healthy"
    print(f"  ✅ Health check passed: {data}")
    return True

def test_register_session():
    """Test 2.2: Can register a new session"""
    print("Test 2.2: Register session...")
    session_data = {
        "session_id": "test-session-001",
        "project_dir": "C:/projects/test-project",
        "session_name": "test-project"
    }
    response = requests.post(
        f"{BASE_URL}/sessions/register",
        json=session_data,
        timeout=5
    )
    assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
    print(f"  ✅ Session registered")
    return True

def test_get_sessions():
    """Test 2.3: Can list all sessions"""
    print("Test 2.3: Get sessions...")
    response = requests.get(f"{BASE_URL}/sessions", timeout=5)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert isinstance(data, list), "Should return a list"
    print(f"  ✅ Got {len(data)} sessions")
    return True

def test_get_single_session():
    """Test 2.4: Can get single session by ID"""
    print("Test 2.4: Get single session...")
    response = requests.get(f"{BASE_URL}/sessions/test-session-001", timeout=5)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data["id"] == "test-session-001", "Should match session ID"
    print(f"  ✅ Got session: {data['name']}")
    return True

def test_update_session_status():
    """Test 2.5: Can update session status"""
    print("Test 2.5: Update session status...")
    response = requests.patch(
        f"{BASE_URL}/sessions/test-session-001",
        json={"status": "waiting"},
        timeout=5
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print("  ✅ Session status updated")
    return True

def test_notify_endpoint():
    """Test 2.6: Notify endpoint accepts notifications"""
    print("Test 2.6: Notify endpoint...")
    notification = {
        "session_name": "test-project",
        "message": "Test notification",
        "type": "info"
    }
    response = requests.post(
        f"{BASE_URL}/sessions/test-session-001/notify",
        json=notification,
        timeout=5
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print("  ✅ Notification accepted")
    return True

def test_delete_session():
    """Test 2.7: Can delete session"""
    print("Test 2.7: Delete session...")
    response = requests.delete(f"{BASE_URL}/sessions/test-session-001", timeout=5)
    assert response.status_code in [200, 204], f"Expected 200/204, got {response.status_code}"
    print("  ✅ Session deleted")
    return True

def test_session_not_found():
    """Test 2.8: Returns 404 for unknown session"""
    print("Test 2.8: Session not found...")
    response = requests.get(f"{BASE_URL}/sessions/nonexistent-session", timeout=5)
    assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    print("  ✅ Correctly returns 404")
    return True

def run_all_tests():
    print("\n" + "="*50)
    print("MILESTONE 2: Bridge Server Core")
    print("="*50 + "\n")
    
    tests = [
        test_health_endpoint,
        test_register_session,
        test_get_sessions,
        test_get_single_session,
        test_update_session_status,
        test_notify_endpoint,
        test_delete_session,
        test_session_not_found,
    ]
    
    passed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except requests.exceptions.ConnectionError:
            print(f"  ❌ FAILED: Cannot connect to server at {BASE_URL}")
            print("     Make sure bridge server is running!")
            break
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
    
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{len(tests)} tests passed")
    print("="*50)
    
    if passed == len(tests):
        print("✅ MILESTONE 2 COMPLETE - Proceed to Milestone 3")
    else:
        print("❌ MILESTONE 2 INCOMPLETE - Fix failing tests before proceeding")
    
    return passed == len(tests)

if __name__ == "__main__":
    run_all_tests()
```

### ✅ Milestone 2 Checklist
- [ ] FastAPI server starts without errors
- [ ] Health endpoint returns {"status": "healthy"}
- [ ] All 8 tests pass
- [ ] Server logs show incoming requests

**⛔ STOP: Do not proceed to Milestone 3 until all tests pass**

---

## Milestone 3: Hook Scripts

### Implementation
1. Create bridge_client.py library
2. Create each hook script
3. Test each script with mock JSON input

### Test Script: test_milestone_3.py

```python
"""
Milestone 3 Tests: Hook Scripts
Run: python test_milestone_3.py
Requires: Bridge server running on localhost:8765
"""
import subprocess
import json
import os
import sys

HOOKS_DIR = os.path.expanduser("~/.factory/hooks")

def run_hook_with_input(hook_name: str, input_data: dict) -> tuple[int, str, str]:
    """Run a hook script with JSON input via stdin"""
    hook_path = os.path.join(HOOKS_DIR, f"{hook_name}.py")
    
    if not os.path.exists(hook_path):
        raise FileNotFoundError(f"Hook not found: {hook_path}")
    
    process = subprocess.Popen(
        [sys.executable, hook_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env={**os.environ, "FACTORY_PROJECT_DIR": "C:/projects/test-project"}
    )
    
    stdout, stderr = process.communicate(
        input=json.dumps(input_data).encode(),
        timeout=10
    )
    
    return process.returncode, stdout.decode(), stderr.decode()

def test_notify_hook():
    """Test 3.1: Notification hook sends to bridge"""
    print("Test 3.1: Notification hook...")
    
    input_data = {
        "session_id": "test-session-notify",
        "message": "Droid needs your permission",
        "type": "permission"
    }
    
    returncode, stdout, stderr = run_hook_with_input("telegram_notify", input_data)
    
    assert returncode == 0, f"Hook should exit 0, got {returncode}. Stderr: {stderr}"
    print("  ✅ Notification hook executed successfully")
    return True

def test_session_start_hook():
    """Test 3.2: Session start hook registers session"""
    print("Test 3.2: Session start hook...")
    
    input_data = {
        "session_id": "test-session-start",
        "trigger": "startup"
    }
    
    returncode, stdout, stderr = run_hook_with_input("telegram_session_start", input_data)
    
    assert returncode == 0, f"Hook should exit 0, got {returncode}. Stderr: {stderr}"
    print("  ✅ Session start hook executed successfully")
    return True

def test_session_end_hook():
    """Test 3.3: Session end hook unregisters session"""
    print("Test 3.3: Session end hook...")
    
    input_data = {
        "session_id": "test-session-end",
        "reason": "prompt_input_exit"
    }
    
    returncode, stdout, stderr = run_hook_with_input("telegram_session_end", input_data)
    
    assert returncode == 0, f"Hook should exit 0, got {returncode}. Stderr: {stderr}"
    print("  ✅ Session end hook executed successfully")
    return True

def test_pre_tool_hook_structure():
    """Test 3.4: PreToolUse hook returns valid JSON"""
    print("Test 3.4: PreToolUse hook output structure...")
    
    input_data = {
        "session_id": "test-session-pretool",
        "tool_name": "Bash",
        "tool_input": {"command": "echo hello"}
    }
    
    # For this test, we need a mock that auto-approves
    # Or we test with a very short timeout
    # Here we just verify the hook script exists and is valid Python
    
    hook_path = os.path.join(HOOKS_DIR, "telegram_pre_tool.py")
    assert os.path.exists(hook_path), f"Hook not found: {hook_path}"
    
    # Syntax check
    result = subprocess.run(
        [sys.executable, "-m", "py_compile", hook_path],
        capture_output=True
    )
    assert result.returncode == 0, f"Syntax error in hook: {result.stderr.decode()}"
    
    print("  ✅ PreToolUse hook syntax valid")
    return True

def test_stop_hook_prevents_loop():
    """Test 3.5: Stop hook respects stop_hook_active flag"""
    print("Test 3.5: Stop hook loop prevention...")
    
    input_data = {
        "session_id": "test-session-stop",
        "stop_hook_active": True  # Should exit immediately
    }
    
    returncode, stdout, stderr = run_hook_with_input("telegram_stop", input_data)
    
    assert returncode == 0, f"Hook should exit 0 when stop_hook_active=True"
    
    # Should NOT output any JSON (just exit)
    if stdout.strip():
        try:
            output = json.loads(stdout)
            assert "decision" not in output, "Should not block when stop_hook_active=True"
        except json.JSONDecodeError:
            pass  # Empty output is fine
    
    print("  ✅ Stop hook respects stop_hook_active flag")
    return True

def test_bridge_client_library():
    """Test 3.6: Bridge client library functions work"""
    print("Test 3.6: Bridge client library...")
    
    lib_path = os.path.join(HOOKS_DIR, "lib", "bridge_client.py")
    assert os.path.exists(lib_path), f"Library not found: {lib_path}"
    
    # Import and test functions exist
    sys.path.insert(0, os.path.join(HOOKS_DIR, "lib"))
    try:
        import bridge_client
        
        assert hasattr(bridge_client, "register_session"), "Missing register_session"
        assert hasattr(bridge_client, "notify"), "Missing notify"
        assert hasattr(bridge_client, "wait_for_response"), "Missing wait_for_response"
        assert hasattr(bridge_client, "unregister_session"), "Missing unregister_session"
        
        print("  ✅ Bridge client library has all required functions")
    finally:
        sys.path.remove(os.path.join(HOOKS_DIR, "lib"))
    
    return True

def run_all_tests():
    print("\n" + "="*50)
    print("MILESTONE 3: Hook Scripts")
    print("="*50 + "\n")
    
    tests = [
        test_bridge_client_library,
        test_notify_hook,
        test_session_start_hook,
        test_session_end_hook,
        test_pre_tool_hook_structure,
        test_stop_hook_prevents_loop,
    ]
    
    passed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except FileNotFoundError as e:
            print(f"  ❌ FAILED: {e}")
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
    
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{len(tests)} tests passed")
    print("="*50)
    
    if passed == len(tests):
        print("✅ MILESTONE 3 COMPLETE - Proceed to Milestone 4")
    else:
        print("❌ MILESTONE 3 INCOMPLETE - Fix failing tests before proceeding")
    
    return passed == len(tests)

if __name__ == "__main__":
    run_all_tests()
```

### ✅ Milestone 3 Checklist
- [ ] All hook scripts exist in ~/.factory/hooks/
- [ ] bridge_client.py library exists with all functions
- [ ] All 6 tests pass
- [ ] Hook scripts have no syntax errors

**⛔ STOP: Do not proceed to Milestone 4 until all tests pass**

---

## Milestone 4: Telegram + Bridge Integration

### Implementation
1. Connect Telegram bot to bridge server
2. Forward notifications to Telegram
3. Handle user responses

### Test Script: test_milestone_4.py

```python
"""
Milestone 4 Tests: Telegram + Bridge Integration
Run: python test_milestone_4.py

This is a semi-automated test - some require manual verification on Telegram.
"""
import requests
import asyncio
import time
import os

BASE_URL = "http://localhost:8765"
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def test_bridge_telegram_connection():
    """Test 4.1: Bridge server reports Telegram bot connected"""
    print("Test 4.1: Bridge-Telegram connection...")
    response = requests.get(f"{BASE_URL}/health", timeout=5)
    data = response.json()
    assert data.get("bot_connected") == True, "Telegram bot should be connected"
    print("  ✅ Telegram bot connected to bridge")
    return True

def test_notification_to_telegram():
    """Test 4.2: Notification sent via bridge appears in Telegram"""
    print("Test 4.2: Notification to Telegram...")
    
    # First register a test session
    requests.post(f"{BASE_URL}/sessions/register", json={
        "session_id": "test-integration-001",
        "project_dir": "C:/projects/integration-test",
        "session_name": "integration-test"
    })
    
    # Send a notification
    response = requests.post(
        f"{BASE_URL}/sessions/test-integration-001/notify",
        json={
            "session_name": "integration-test",
            "message": "🧪 Milestone 4 Test: This notification should appear in Telegram!",
            "type": "info"
        },
        timeout=5
    )
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print("  ✅ Notification sent to bridge")
    print("  📱 CHECK TELEGRAM: You should see the test notification!")
    return True

def test_permission_request_with_buttons():
    """Test 4.3: Permission request shows inline buttons in Telegram"""
    print("Test 4.3: Permission request with buttons...")
    
    response = requests.post(
        f"{BASE_URL}/sessions/test-integration-001/notify",
        json={
            "session_name": "integration-test",
            "message": "⚠️ Test permission request\n\nTool: `Bash`\nCommand: `echo hello`",
            "type": "permission",
            "buttons": [
                {"text": "✅ Approve", "callback": "approve"},
                {"text": "❌ Deny", "callback": "deny"}
            ]
        },
        timeout=5
    )
    
    assert response.status_code == 200
    print("  ✅ Permission request sent")
    print("  📱 CHECK TELEGRAM: You should see Approve/Deny buttons!")
    return True

def test_session_list_command():
    """Test 4.4: /sessions command returns active sessions"""
    print("Test 4.4: Sessions command...")
    print("  📱 MANUAL TEST: Send /sessions to the bot")
    print("     Expected: Bot replies with list including 'integration-test'")
    return True

def cleanup():
    """Clean up test session"""
    requests.delete(f"{BASE_URL}/sessions/test-integration-001")

def run_all_tests():
    print("\n" + "="*50)
    print("MILESTONE 4: Telegram + Bridge Integration")
    print("="*50 + "\n")
    print("NOTE: Some tests require manual verification in Telegram\n")
    
    tests = [
        test_bridge_telegram_connection,
        test_notification_to_telegram,
        test_permission_request_with_buttons,
        test_session_list_command,
    ]
    
    passed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
    
    cleanup()
    
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{len(tests)} automated tests passed")
    print("="*50)
    
    print("\n📋 Manual Verification Checklist:")
    print("  [ ] Received 'Milestone 4 Test' notification in Telegram")
    print("  [ ] Permission request shows Approve/Deny buttons")
    print("  [ ] /sessions command lists 'integration-test'")
    print("  [ ] /start command works")
    
    print("\n" + "="*50)
    if passed == len(tests):
        print("✅ MILESTONE 4 AUTOMATED TESTS COMPLETE")
        print("   Complete manual checklist before proceeding to Milestone 5")
    else:
        print("❌ MILESTONE 4 INCOMPLETE - Fix failing tests before proceeding")
    
    return passed == len(tests)

if __name__ == "__main__":
    run_all_tests()
```

### ✅ Milestone 4 Checklist
- [ ] Bridge server shows bot_connected: true
- [ ] Notifications appear in Telegram
- [ ] Inline buttons (Approve/Deny) work
- [ ] /start command responds
- [ ] /sessions command lists sessions
- [ ] /status command works

**⛔ STOP: Do not proceed to Milestone 5 until all tests pass**

---

## Milestone 5: Web UI Core

### Implementation
1. Set up Next.js project with TypeScript
2. Configure ESLint and Prettier
3. Create basic pages and components
4. Implement API client

### Test Commands

```bash
# Navigate to web directory
cd ~/.factory/telegram-bridge/web

# Test 5.1: TypeScript compilation
npm run type-check
# Expected: No errors

# Test 5.2: ESLint
npm run lint
# Expected: No errors or warnings

# Test 5.3: Prettier
npm run format:check
# Expected: All files formatted

# Test 5.4: Build succeeds
npm run build
# Expected: Build completes without errors

# Test 5.5: Dev server starts
npm run dev
# Expected: Server starts on localhost:3000
```

### Test Script: test_milestone_5.py

```python
"""
Milestone 5 Tests: Web UI Core
Run: python test_milestone_5.py
Requires: Next.js dev server running on localhost:3000
"""
import requests
import subprocess
import os

WEB_URL = "http://localhost:3000"
WEB_DIR = os.path.expanduser("~/.factory/telegram-bridge/web")

def test_nextjs_config_exists():
    """Test 5.1: Next.js configuration files exist"""
    print("Test 5.1: Config files...")
    
    required_files = [
        "next.config.ts",
        "tsconfig.json",
        "eslint.config.mjs",
        "package.json",
        "tailwind.config.ts",
        ".prettierrc"
    ]
    
    for file in required_files:
        path = os.path.join(WEB_DIR, file)
        assert os.path.exists(path), f"Missing: {file}"
    
    print("  ✅ All config files present")
    return True

def test_typescript_strict():
    """Test 5.2: TypeScript uses strict mode"""
    print("Test 5.2: TypeScript strict mode...")
    
    import json
    tsconfig_path = os.path.join(WEB_DIR, "tsconfig.json")
    
    with open(tsconfig_path) as f:
        tsconfig = json.load(f)
    
    compiler_options = tsconfig.get("compilerOptions", {})
    assert compiler_options.get("strict") == True, "strict should be true"
    assert compiler_options.get("noUncheckedIndexedAccess") == True, "noUncheckedIndexedAccess should be true"
    
    print("  ✅ TypeScript strict mode enabled")
    return True

def test_type_check_passes():
    """Test 5.3: TypeScript type check passes"""
    print("Test 5.3: Type check...")
    
    result = subprocess.run(
        ["npm", "run", "type-check"],
        cwd=WEB_DIR,
        capture_output=True,
        shell=True
    )
    
    assert result.returncode == 0, f"Type check failed: {result.stderr.decode()}"
    print("  ✅ Type check passed")
    return True

def test_lint_passes():
    """Test 5.4: ESLint passes with no errors"""
    print("Test 5.4: ESLint...")
    
    result = subprocess.run(
        ["npm", "run", "lint"],
        cwd=WEB_DIR,
        capture_output=True,
        shell=True
    )
    
    assert result.returncode == 0, f"Lint failed: {result.stdout.decode()}"
    print("  ✅ ESLint passed")
    return True

def test_build_succeeds():
    """Test 5.5: Production build succeeds"""
    print("Test 5.5: Build...")
    
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=WEB_DIR,
        capture_output=True,
        shell=True
    )
    
    assert result.returncode == 0, f"Build failed: {result.stderr.decode()}"
    print("  ✅ Build succeeded")
    return True

def test_homepage_loads():
    """Test 5.6: Homepage loads correctly"""
    print("Test 5.6: Homepage...")
    
    response = requests.get(WEB_URL, timeout=10)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    assert "Droid Control" in response.text, "Should contain 'Droid Control'"
    print("  ✅ Homepage loads")
    return True

def test_api_proxy_works():
    """Test 5.7: API proxy forwards to bridge"""
    print("Test 5.7: API proxy...")
    
    response = requests.get(f"{WEB_URL}/api/bridge/health", timeout=10)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print("  ✅ API proxy works")
    return True

def run_all_tests():
    print("\n" + "="*50)
    print("MILESTONE 5: Web UI Core")
    print("="*50 + "\n")
    
    tests = [
        test_nextjs_config_exists,
        test_typescript_strict,
        test_type_check_passes,
        test_lint_passes,
        test_build_succeeds,
        test_homepage_loads,
        test_api_proxy_works,
    ]
    
    passed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except requests.exceptions.ConnectionError:
            print(f"  ❌ FAILED: Cannot connect to {WEB_URL}")
            print("     Make sure Next.js dev server is running!")
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
    
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{len(tests)} tests passed")
    print("="*50)
    
    if passed == len(tests):
        print("✅ MILESTONE 5 COMPLETE - Proceed to Milestone 6")
    else:
        print("❌ MILESTONE 5 INCOMPLETE - Fix failing tests before proceeding")
    
    return passed == len(tests)

if __name__ == "__main__":
    run_all_tests()
```

### ✅ Milestone 5 Checklist
- [ ] All config files exist
- [ ] TypeScript strict mode enabled
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run build` succeeds
- [ ] Homepage loads at localhost:3000
- [ ] API proxy forwards to bridge

**⛔ STOP: Do not proceed to Milestone 6 until all tests pass**

---

## Milestone 6: Web UI Real-time

### Implementation
1. Implement Socket.IO client
2. Add real-time session updates
3. Implement notification handling
4. Add approve/deny actions

### Test Script: test_milestone_6.py

```python
"""
Milestone 6 Tests: Web UI Real-time
Run: python test_milestone_6.py
Requires: Both Next.js and Bridge server running
"""
import socketio
import asyncio
import requests
import time

WS_URL = "http://localhost:8765"
API_URL = "http://localhost:8765"

def test_websocket_connection():
    """Test 6.1: Can connect to Socket.IO server"""
    print("Test 6.1: WebSocket connection...")
    
    sio = socketio.Client()
    connected = False
    
    @sio.event
    def connect():
        nonlocal connected
        connected = True
    
    try:
        sio.connect(WS_URL, wait_timeout=5)
        time.sleep(1)
        assert connected, "Should connect to Socket.IO server"
        print("  ✅ WebSocket connected")
    finally:
        sio.disconnect()
    
    return True

def test_sessions_update_event():
    """Test 6.2: Receives sessions_update event"""
    print("Test 6.2: Sessions update event...")
    
    sio = socketio.Client()
    received_event = []
    
    @sio.on('sessions_update')
    def on_sessions_update(data):
        received_event.append(data)
    
    try:
        sio.connect(WS_URL, wait_timeout=5)
        
        # Trigger an update by registering a session
        requests.post(f"{API_URL}/sessions/register", json={
            "session_id": "ws-test-001",
            "project_dir": "C:/projects/ws-test",
            "session_name": "ws-test"
        })
        
        time.sleep(2)
        
        assert len(received_event) > 0, "Should receive sessions_update event"
        print(f"  ✅ Received sessions_update with {len(received_event[0])} sessions")
    finally:
        sio.disconnect()
        requests.delete(f"{API_URL}/sessions/ws-test-001")
    
    return True

def test_notification_event():
    """Test 6.3: Receives notification event"""
    print("Test 6.3: Notification event...")
    
    sio = socketio.Client()
    received_notification = []
    
    @sio.on('notification')
    def on_notification(data):
        received_notification.append(data)
    
    try:
        sio.connect(WS_URL, wait_timeout=5)
        
        # Register session first
        requests.post(f"{API_URL}/sessions/register", json={
            "session_id": "ws-test-002",
            "project_dir": "C:/projects/ws-test-2",
            "session_name": "ws-test-2"
        })
        
        # Send notification
        requests.post(f"{API_URL}/sessions/ws-test-002/notify", json={
            "session_name": "ws-test-2",
            "message": "WebSocket test notification",
            "type": "info"
        })
        
        time.sleep(2)
        
        assert len(received_notification) > 0, "Should receive notification event"
        print("  ✅ Received notification event")
    finally:
        sio.disconnect()
        requests.delete(f"{API_URL}/sessions/ws-test-002")
    
    return True

def test_respond_via_websocket():
    """Test 6.4: Can send response via WebSocket"""
    print("Test 6.4: Respond via WebSocket...")
    
    sio = socketio.Client()
    
    try:
        sio.connect(WS_URL, wait_timeout=5)
        
        # Register and create pending request
        requests.post(f"{API_URL}/sessions/register", json={
            "session_id": "ws-test-003",
            "project_dir": "C:/projects/ws-test-3",
            "session_name": "ws-test-3"
        })
        
        # Emit respond event
        sio.emit('respond', {
            'sessionId': 'ws-test-003',
            'requestId': 'test-request-001',
            'response': 'Test response from WebSocket'
        })
        
        time.sleep(1)
        print("  ✅ Response sent via WebSocket")
    finally:
        sio.disconnect()
        requests.delete(f"{API_URL}/sessions/ws-test-003")
    
    return True

def test_approve_via_websocket():
    """Test 6.5: Can approve via WebSocket"""
    print("Test 6.5: Approve via WebSocket...")
    
    sio = socketio.Client()
    
    try:
        sio.connect(WS_URL, wait_timeout=5)
        
        sio.emit('approve', {
            'sessionId': 'ws-test-003',
            'requestId': 'test-request-002'
        })
        
        time.sleep(1)
        print("  ✅ Approve sent via WebSocket")
    finally:
        sio.disconnect()
    
    return True

def run_all_tests():
    print("\n" + "="*50)
    print("MILESTONE 6: Web UI Real-time")
    print("="*50 + "\n")
    
    tests = [
        test_websocket_connection,
        test_sessions_update_event,
        test_notification_event,
        test_respond_via_websocket,
        test_approve_via_websocket,
    ]
    
    passed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
    
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{len(tests)} tests passed")
    print("="*50)
    
    print("\n📋 Manual Verification Checklist:")
    print("  [ ] Open Web UI at localhost:3000")
    print("  [ ] Sessions appear and update in real-time")
    print("  [ ] Notifications show as they arrive")
    print("  [ ] Approve/Deny buttons work")
    print("  [ ] Connection indicator shows 'Connected'")
    
    if passed == len(tests):
        print("\n✅ MILESTONE 6 AUTOMATED TESTS COMPLETE")
        print("   Complete manual checklist before proceeding to Milestone 7")
    else:
        print("\n❌ MILESTONE 6 INCOMPLETE - Fix failing tests before proceeding")
    
    return passed == len(tests)

if __name__ == "__main__":
    run_all_tests()
```

### ✅ Milestone 6 Checklist
- [ ] WebSocket connects successfully
- [ ] Sessions update in real-time
- [ ] Notifications appear instantly
- [ ] Approve/Deny buttons work
- [ ] Connection status indicator works
- [ ] UI handles reconnection gracefully

**⛔ STOP: Do not proceed to Milestone 7 until all tests pass**

---

## Milestone 7: Multi-Session Support

### Test Script: test_milestone_7.py

```python
"""
Milestone 7 Tests: Multi-Session Support
Run: python test_milestone_7.py
"""
import requests
import time
import concurrent.futures

API_URL = "http://localhost:8765"

def test_register_multiple_sessions():
    """Test 7.1: Can register multiple sessions"""
    print("Test 7.1: Register multiple sessions...")
    
    sessions = [
        {"session_id": "multi-1", "project_dir": "C:/projects/app1", "session_name": "app1"},
        {"session_id": "multi-2", "project_dir": "C:/projects/app2", "session_name": "app2"},
        {"session_id": "multi-3", "project_dir": "C:/projects/app3", "session_name": "app3"},
    ]
    
    for session in sessions:
        response = requests.post(f"{API_URL}/sessions/register", json=session)
        assert response.status_code in [200, 201]
    
    # Verify all registered
    response = requests.get(f"{API_URL}/sessions")
    data = response.json()
    
    session_ids = [s["id"] for s in data]
    for session in sessions:
        assert session["session_id"] in session_ids, f"Missing session: {session['session_id']}"
    
    print(f"  ✅ Registered {len(sessions)} sessions")
    return True

def test_independent_notifications():
    """Test 7.2: Each session receives its own notifications"""
    print("Test 7.2: Independent notifications...")
    
    for i in range(1, 4):
        response = requests.post(
            f"{API_URL}/sessions/multi-{i}/notify",
            json={
                "session_name": f"app{i}",
                "message": f"Notification for app{i}",
                "type": "info"
            }
        )
        assert response.status_code == 200
    
    print("  ✅ Sent notifications to all 3 sessions")
    print("  📱 CHECK: Each session should have its own notification")
    return True

def test_concurrent_responses():
    """Test 7.3: Can handle concurrent responses to different sessions"""
    print("Test 7.3: Concurrent responses...")
    
    def send_response(session_id):
        return requests.post(
            f"{API_URL}/sessions/{session_id}/respond",
            json={"request_id": f"req-{session_id}", "response": f"Response for {session_id}"}
        )
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(send_response, f"multi-{i}")
            for i in range(1, 4)
        ]
        
        results = [f.result() for f in futures]
        
    for result in results:
        assert result.status_code == 200
    
    print("  ✅ Handled concurrent responses")
    return True

def test_session_list_shows_all():
    """Test 7.4: /sessions shows all active sessions"""
    print("Test 7.4: Session list...")
    
    response = requests.get(f"{API_URL}/sessions")
    sessions = response.json()
    
    multi_sessions = [s for s in sessions if s["id"].startswith("multi-")]
    assert len(multi_sessions) >= 3, f"Expected at least 3 multi sessions, got {len(multi_sessions)}"
    
    print(f"  ✅ Sessions list shows {len(multi_sessions)} test sessions")
    return True

def test_session_isolation():
    """Test 7.5: Session responses don't cross-contaminate"""
    print("Test 7.5: Session isolation...")
    
    # Update different statuses
    requests.patch(f"{API_URL}/sessions/multi-1", json={"status": "running"})
    requests.patch(f"{API_URL}/sessions/multi-2", json={"status": "waiting"})
    requests.patch(f"{API_URL}/sessions/multi-3", json={"status": "stopped"})
    
    # Verify each has correct status
    for i, expected_status in [(1, "running"), (2, "waiting"), (3, "stopped")]:
        response = requests.get(f"{API_URL}/sessions/multi-{i}")
        data = response.json()
        assert data["status"] == expected_status, f"multi-{i} should be {expected_status}"
    
    print("  ✅ Sessions maintain independent state")
    return True

def cleanup():
    """Clean up test sessions"""
    for i in range(1, 4):
        requests.delete(f"{API_URL}/sessions/multi-{i}")

def run_all_tests():
    print("\n" + "="*50)
    print("MILESTONE 7: Multi-Session Support")
    print("="*50 + "\n")
    
    tests = [
        test_register_multiple_sessions,
        test_independent_notifications,
        test_concurrent_responses,
        test_session_list_shows_all,
        test_session_isolation,
    ]
    
    passed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
    
    cleanup()
    
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{len(tests)} tests passed")
    print("="*50)
    
    print("\n📋 Manual Verification Checklist:")
    print("  [ ] Start 2+ Droid instances in different directories")
    print("  [ ] All sessions appear in Web UI")
    print("  [ ] All sessions appear in Telegram /sessions")
    print("  [ ] Can respond to each session independently")
    print("  [ ] Session names clearly distinguish projects")
    
    if passed == len(tests):
        print("\n✅ MILESTONE 7 COMPLETE - Proceed to Milestone 8")
    else:
        print("\n❌ MILESTONE 7 INCOMPLETE - Fix failing tests before proceeding")
    
    return passed == len(tests)

if __name__ == "__main__":
    run_all_tests()
```

### ✅ Milestone 7 Checklist
- [ ] Multiple sessions can register
- [ ] Each session has independent notifications
- [ ] Concurrent responses handled correctly
- [ ] Sessions maintain independent state
- [ ] Web UI shows all sessions
- [ ] Telegram /sessions shows all sessions

**⛔ STOP: Do not proceed to Milestone 8 until all tests pass**

---

## Milestone 8: Docker Deployment

### Test Commands

```powershell
# Navigate to telegram-bridge directory
cd ~/.factory/telegram-bridge

# Test 8.1: Docker build succeeds
docker-compose build
# Expected: All images build successfully

# Test 8.2: Containers start
docker-compose up -d
# Expected: All containers running

# Test 8.3: Health check
docker-compose ps
# Expected: All services healthy

# Test 8.4: View logs
docker-compose logs -f
# Expected: No errors in logs

# Test 8.5: API accessible
curl http://localhost:8765/health
# Expected: {"status": "healthy", ...}

# Test 8.6: Web UI accessible  
curl http://localhost:3000
# Expected: HTML response
```

### ✅ Milestone 8 Checklist
- [ ] `docker-compose build` succeeds
- [ ] `docker-compose up -d` starts all services
- [ ] All containers show healthy status
- [ ] No errors in container logs
- [ ] API accessible at localhost:8765
- [ ] Web UI accessible at localhost:3000
- [ ] Telegram bot still works
- [ ] Hook scripts can connect to containerized server

**⛔ STOP: Do not proceed to Milestone 9 until all tests pass**

---

## Milestone 9: Cloudflare Tunnel

### Test Commands

```powershell
# Test 9.1: Quick tunnel (temporary URL)
cloudflared tunnel --url http://localhost:8765
# Expected: Generates https://xxx.trycloudflare.com URL

# Test 9.2: Access via tunnel URL
# Open the trycloudflare.com URL in browser
# Expected: Web UI loads

# Test 9.3: API via tunnel
curl https://xxx.trycloudflare.com/health
# Expected: {"status": "healthy"}
```

### ✅ Milestone 9 Checklist
- [ ] `cloudflared` installed
- [ ] Quick tunnel generates public URL
- [ ] Web UI accessible via public URL
- [ ] API accessible via public URL
- [ ] Authentication works (if configured)
- [ ] WebSocket works through tunnel

**⛔ STOP: Do not proceed to Milestone 10 until all tests pass**

---

## Milestone 10: Full Integration Test

### Test Script: test_milestone_10.py

```python
"""
Milestone 10: Full Integration Test
This is the final end-to-end test.

Run: python test_milestone_10.py

Prerequisites:
- Bridge server running (Docker or native)
- Web UI running
- Telegram bot connected
- Cloudflare tunnel (optional)
"""
import requests
import subprocess
import json
import time
import os
import sys

API_URL = "http://localhost:8765"
WEB_URL = "http://localhost:3000"

def test_full_droid_flow():
    """Test 10.1: Complete Droid hook flow"""
    print("Test 10.1: Full Droid flow simulation...")
    
    hooks_dir = os.path.expanduser("~/.factory/hooks")
    
    # 1. Simulate SessionStart
    print("  → Simulating SessionStart...")
    result = subprocess.run(
        [sys.executable, os.path.join(hooks_dir, "telegram_session_start.py")],
        input=json.dumps({
            "session_id": "e2e-test-001",
            "trigger": "startup"
        }).encode(),
        capture_output=True,
        env={**os.environ, "FACTORY_PROJECT_DIR": "C:/projects/e2e-test"}
    )
    assert result.returncode == 0, f"SessionStart failed: {result.stderr.decode()}"
    
    time.sleep(1)
    
    # 2. Verify session registered
    response = requests.get(f"{API_URL}/sessions/e2e-test-001")
    assert response.status_code == 200, "Session should be registered"
    print("  ✅ Session registered")
    
    # 3. Simulate Notification
    print("  → Simulating Notification...")
    result = subprocess.run(
        [sys.executable, os.path.join(hooks_dir, "telegram_notify.py")],
        input=json.dumps({
            "session_id": "e2e-test-001",
            "message": "E2E Test: Droid needs input",
            "type": "info"
        }).encode(),
        capture_output=True,
        env={**os.environ, "FACTORY_PROJECT_DIR": "C:/projects/e2e-test"}
    )
    assert result.returncode == 0
    print("  ✅ Notification sent")
    print("  📱 CHECK TELEGRAM: You should see 'E2E Test' notification")
    
    time.sleep(2)
    
    # 4. Simulate SessionEnd
    print("  → Simulating SessionEnd...")
    result = subprocess.run(
        [sys.executable, os.path.join(hooks_dir, "telegram_session_end.py")],
        input=json.dumps({
            "session_id": "e2e-test-001",
            "reason": "prompt_input_exit"
        }).encode(),
        capture_output=True,
        env={**os.environ, "FACTORY_PROJECT_DIR": "C:/projects/e2e-test"}
    )
    assert result.returncode == 0
    print("  ✅ Session ended")
    
    return True

def test_web_ui_shows_updates():
    """Test 10.2: Web UI reflects all changes"""
    print("Test 10.2: Web UI updates...")
    
    response = requests.get(WEB_URL)
    assert response.status_code == 200
    print("  ✅ Web UI accessible")
    print("  👀 MANUAL: Verify Web UI shows real-time updates during test 10.1")
    
    return True

def test_telegram_receives_all():
    """Test 10.3: Telegram receives all notifications"""
    print("Test 10.3: Telegram notifications...")
    
    response = requests.get(f"{API_URL}/health")
    data = response.json()
    assert data.get("bot_connected") == True
    print("  ✅ Telegram bot connected")
    print("  📱 MANUAL: Verify all notifications received in Telegram")
    
    return True

def test_response_flow():
    """Test 10.4: Response flows back to hook"""
    print("Test 10.4: Response flow...")
    print("  📋 MANUAL TEST:")
    print("     1. Start a real Droid session")
    print("     2. Wait for Droid to stop (triggers Stop hook)")
    print("     3. Reply via Telegram with a command")
    print("     4. Verify Droid receives and executes the command")
    print("     5. Try the same via Web UI")
    
    return True

def run_all_tests():
    print("\n" + "="*60)
    print("MILESTONE 10: Full Integration Test")
    print("="*60 + "\n")
    
    tests = [
        test_full_droid_flow,
        test_web_ui_shows_updates,
        test_telegram_receives_all,
        test_response_flow,
    ]
    
    passed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
    
    print(f"\n{'='*60}")
    print(f"Results: {passed}/{len(tests)} automated tests passed")
    print("="*60)
    
    print("\n" + "="*60)
    print("FINAL VERIFICATION CHECKLIST")
    print("="*60)
    print("""
    Telegram:
    [ ] Bot responds to /start
    [ ] Bot responds to /sessions
    [ ] Bot responds to /status
    [ ] Notifications appear with correct session labels
    [ ] Inline buttons (Approve/Deny) work
    [ ] Text replies are delivered to Droid
    
    Web UI:
    [ ] Dashboard loads correctly
    [ ] Sessions appear with correct status
    [ ] Real-time updates work (no refresh needed)
    [ ] Approve/Deny buttons work
    [ ] Text input delivers to Droid
    [ ] Connection indicator shows status
    
    Multi-Session:
    [ ] Can run 2+ Droid instances
    [ ] Each session clearly labeled
    [ ] Responses go to correct session
    [ ] Sessions don't interfere with each other
    
    Docker:
    [ ] Containers start successfully
    [ ] Services communicate correctly
    [ ] Data persists across restarts
    [ ] Logs show no errors
    
    Cloudflare (if configured):
    [ ] Public URL works
    [ ] Auth protects access
    [ ] WebSocket works through tunnel
    """)
    
    print("="*60)
    print("🎉 PROJECT COMPLETE! 🎉" if passed == len(tests) else "❌ Some tests failed")
    print("="*60)
    
    return passed == len(tests)

if __name__ == "__main__":
    run_all_tests()
```

### ✅ Milestone 10 Final Checklist
- [ ] All automated tests pass
- [ ] Telegram bot fully functional
- [ ] Web UI fully functional
- [ ] Multi-session works correctly
- [ ] Docker deployment stable
- [ ] Cloudflare tunnel works (if used)
- [ ] Hook scripts integrate with real Droid
- [ ] End-to-end flow works: Droid → Hook → Bridge → Telegram/Web → User → Bridge → Hook → Droid

---

## Testing Summary

| Milestone | Focus | Key Tests |
|-----------|-------|-----------|
| 1 | Telegram Bot | Connection, send message, commands |
| 2 | Bridge Server | Health, CRUD, endpoints |
| 3 | Hook Scripts | Syntax, execution, library |
| 4 | Telegram Integration | Notifications, buttons, commands |
| 5 | Web UI Core | TypeScript, ESLint, build, pages |
| 6 | Web UI Real-time | WebSocket, events, actions |
| 7 | Multi-Session | Concurrent sessions, isolation |
| 8 | Docker | Build, run, networking |
| 9 | Cloudflare | Tunnel, public access |
| 10 | Full Integration | End-to-end flow |

**Remember**: Never skip tests. Each milestone builds on the previous one. A bug in Milestone 2 will cause cascading failures in later milestones.

## Target Environment

- **OS**: Windows 11
- **Antivirus**: AVG (consider exclusions if needed)
- **Runtime**: Python 3.11+
- **Droid**: Factory.ai Droid CLI

## Why Python

- **Fast startup**: Hook scripts execute on every Droid action, Python has minimal cold start
- **Simple scripts**: Single-file scripts with no package.json or bundling needed
- **Windows native**: Better path handling and process management on Windows
- **Excellent library**: `python-telegram-bot` is mature and well-documented
- **Unified stack**: Same language for hooks and bridge server simplifies maintenance

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Telegram App  │◄───►│  Telegram Bot    │◄───►│  Hook Scripts   │
│   (on Phone)    │     │  (Bot API)       │     │  (Local Machine)│
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
        ┌──────────────────┐                              │
        │   Web Browser    │◄─── Cloudflare Tunnel ───────┤
        │   (anywhere)     │                              │
        └──────────────────┘                              │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │   Droid CLI     │
                                                 │   (Factory.ai)  │
                                                 └─────────────────┘
```

## Control Options

| Method | Use Case | Pros | Cons |
|--------|----------|------|------|
| **Telegram** | Quick responses, mobile | Fast, notifications, offline messages | Limited UI |
| **Web UI** | Complex tasks, monitoring | Rich interface, dashboard | Needs browser |
| **Both** | Best of both worlds | Flexibility | - |

## Components to Build

### 1. Telegram Bot Setup

Create a Telegram bot using BotFather with these capabilities:
- Receive messages from authorized user only (security)
- Send formatted notifications (markdown support)
- Handle inline keyboards for quick actions (approve/deny/continue)

### 2. Local Bridge Server (FastAPI)

A persistent process that:
- Listens for incoming Telegram messages
- Provides REST API for hook scripts
- Provides Socket.IO server for real-time Web UI updates
- Stores pending responses for hook scripts to retrieve
- Manages state between Droid sessions

### 3. Web UI (Next.js 15)

A browser-based dashboard that:
- Shows all active Droid sessions
- Displays real-time activity feed via WebSocket
- Allows sending commands/responses
- Handles permission approvals with modal dialogs
- Works on desktop and mobile browsers
- Server-side rendering for fast initial load
- Can run as standalone container or integrated with bridge

### 4. Cloudflare Tunnel (Optional)

Secure public access:
- Exposes local server to internet
- Handles SSL/TLS automatically
- Works with Cloudflare Access for authentication

### 5. Hook Scripts

Create hook scripts for these Droid events:

| Hook Event | Purpose |
|------------|---------|
| `Notification` | Send Telegram message when Droid needs permission or is waiting |
| `Stop` | Notify completion, optionally wait for next instruction |
| `SubagentStop` | Notify when sub-droid tasks complete |
| `PreToolUse` | (Optional) Ask approval before dangerous operations |
| `PostToolUse` | (Optional) Report tool execution results |
| `SessionStart` | Notify when Droid session begins |
| `SessionEnd` | Notify when Droid session ends |

## Detailed Implementation

### Part 1: Configuration Files

#### 1.1 Environment Variables (.env)

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
TELEGRAM_ALLOWED_USERS=123456789,987654321
WEBHOOK_SECRET=random_secret_string
LOCAL_SERVER_PORT=8765
RESPONSE_TIMEOUT_SECONDS=300
```

#### 1.2 Droid Settings (~/.factory/settings.json)

```json
{
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python \"C:/Users/USERNAME/.factory/hooks/telegram_notify.py\"",
            "timeout": 10
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python \"C:/Users/USERNAME/.factory/hooks/telegram_stop.py\"",
            "timeout": 300
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python \"C:/Users/USERNAME/.factory/hooks/telegram_subagent_stop.py\"",
            "timeout": 300
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "python \"C:/Users/USERNAME/.factory/hooks/telegram_pre_tool.py\"",
            "timeout": 120
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "python \"C:/Users/USERNAME/.factory/hooks/telegram_session_start.py\"",
            "timeout": 10
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python \"C:/Users/USERNAME/.factory/hooks/telegram_session_end.py\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Part 2: Local Bridge Server

Create a local HTTP server using Python `aiohttp` or `FastAPI`:

```
telegram_bridge_server.py
├── Connects to Telegram Bot API (polling mode recommended for simplicity)
├── Maintains message queue for pending responses
├── Provides local API for hook scripts:
│   ├── POST /notify - Send notification to Telegram
│   ├── POST /ask - Send message and wait for reply
│   ├── GET /response/{id} - Get response for a specific request
│   └── POST /quick-action - Handle inline keyboard callbacks
└── Runs as background service (Windows Task Scheduler or pythonw.exe)
```

#### Server Requirements:

1. **Authentication**: Only accept requests from localhost
2. **Message Queue**: Store pending responses with unique IDs
3. **Timeout Handling**: Return timeout error if no response within limit
4. **Inline Keyboards**: Support quick action buttons
5. **Message Formatting**: Convert Droid JSON to readable Telegram messages
6. **Rate Limiting**: Respect Telegram API limits (30 msg/sec)

#### Telegram Message Formats:

**Notification Message:**
```
🔔 *Droid Notification*

{notification_message}

Session: `{session_id}`
Time: {timestamp}
```

**Permission Request:**
```
⚠️ *Permission Required*

Droid wants to execute:
Tool: `{tool_name}`
```
Input:
{formatted_tool_input}
```

[✅ Approve] [❌ Deny] [👁 View More]
```

**Stop/Completion Message:**
```
✅ *Droid Stopped*

{summary_of_what_was_done}

Reply with your next instruction or /done to end session.
```

### Part 3: Hook Scripts

#### 3.1 telegram_notify.py

```python
"""
Notification Hook Script

Receives: JSON via stdin with notification details
Action: Sends Telegram notification
Output: Exit code 0 (success)
"""

# Implementation requirements:
# 1. Read JSON from stdin
# 2. Parse notification message and metadata
# 3. Format message for Telegram (markdown)
# 4. Send via local bridge server API
# 5. Exit with code 0
```

#### 3.2 telegram_stop.py

```python
"""
Stop Hook Script

Receives: JSON via stdin with session/transcript info
Action: 
  1. Send completion notification to Telegram
  2. Wait for user response (with timeout)
  3. If user sends new instruction, return it to Droid
Output: 
  - JSON with decision: "block" + reason (to continue with new instruction)
  - Exit code 0 (to let Droid stop normally)
"""

# Implementation requirements:
# 1. Read JSON from stdin (includes stop_hook_active flag)
# 2. Check stop_hook_active to prevent infinite loops
# 3. Send completion summary to Telegram
# 4. Wait for response via bridge server
# 5. If response received:
#    - Output JSON: {"decision": "block", "reason": "User instruction: {response}"}
# 6. If timeout or /done command:
#    - Exit code 0 (allow stop)
```

#### 3.3 telegram_pre_tool.py

```python
"""
PreToolUse Hook Script

Receives: JSON via stdin with tool_name and tool_input
Action:
  1. Send approval request to Telegram with tool details
  2. Wait for user response (approve/deny)
Output:
  - JSON with permissionDecision: "allow" or "deny"
"""

# Implementation requirements:
# 1. Read JSON from stdin
# 2. Extract tool_name and tool_input
# 3. Format readable message showing what Droid wants to do
# 4. Send to Telegram with inline keyboard [Approve] [Deny]
# 5. Wait for callback response
# 6. Return JSON:
#    Approved: {"hookSpecificOutput": {"permissionDecision": "allow"}}
#    Denied: {"hookSpecificOutput": {"permissionDecision": "deny", "permissionDecisionReason": "User denied via Telegram"}}
```

#### 3.4 telegram_session_start.py

```python
"""
SessionStart Hook Script

Receives: JSON via stdin with session info
Action: Send notification that Droid session started
Output: Exit code 0, optional context in stdout
"""
```

#### 3.5 telegram_session_end.py

```python
"""
SessionEnd Hook Script

Receives: JSON via stdin with session info and end reason
Action: Send notification that Droid session ended
Output: Exit code 0
"""
```

### Part 4: Telegram Bot Commands

Implement these bot commands:

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot, verify user authorization |
| `/status` | Check if Droid is running, show current session |
| `/done` | Signal that you're done, let Droid stop |
| `/cancel` | Cancel current operation/waiting |
| `/approve` | Quick approve pending permission |
| `/deny` | Quick deny pending permission |
| `/history` | Show recent Droid actions |
| `/help` | Show available commands |

### Part 5: Security Requirements

1. **User Authentication**
   - Whitelist Telegram user IDs in config
   - Reject messages from unauthorized users
   - Log unauthorized access attempts

2. **Local Server Security**
   - Bind to localhost only (127.0.0.1)
   - Use secret token for hook-to-server communication
   - No external network exposure

3. **Input Sanitization**
   - Sanitize all user input before passing to Droid
   - Escape special characters
   - Limit message length

4. **Sensitive Data Handling**
   - Don't log full tool inputs (may contain secrets)
   - Mask file paths in notifications (optional)
   - Don't send .env contents or credentials

## File Structure

```
C:\Users\USERNAME\.factory\
├── settings.json                      # Droid hooks configuration
├── hooks/
│   ├── telegram_notify.py             # Notification hook
│   ├── telegram_stop.py               # Stop hook (wait for next instruction)
│   ├── telegram_pre_tool.py           # PreToolUse approval hook
│   ├── telegram_subagent_stop.py      # SubagentStop hook
│   ├── telegram_session_start.py      # Session start notification
│   ├── telegram_session_end.py        # Session end cleanup
│   └── lib/
│       ├── __init__.py
│       ├── bridge_client.py           # HTTP client for bridge server
│       ├── formatters.py              # Format Droid data for Telegram
│       └── config.py                  # Load .env and constants
│
└── telegram-bridge/
    ├── .env                           # Environment variables (secrets)
    ├── requirements.txt               # Python dependencies
    ├── Dockerfile                     # Combined Docker image
    ├── Dockerfile.api                 # API-only Docker image
    ├── docker-compose.yml             # Docker Compose configuration
    ├── docker-entrypoint.sh           # Startup script
    ├── .dockerignore                  # Files to exclude from Docker build
    ├── server.py                      # Main entry point (FastAPI + Socket.IO)
    ├── bot/
    │   ├── __init__.py
    │   ├── telegram_bot.py            # Telegram bot handlers
    │   ├── commands.py                # /start, /sessions, /switch, etc.
    │   └── keyboards.py               # Inline keyboard builders
    ├── core/
    │   ├── __init__.py
    │   ├── session_registry.py        # Track active Droid sessions
    │   ├── message_queue.py           # Async queues per session
    │   └── models.py                  # Pydantic models
    ├── api/
    │   ├── __init__.py
    │   ├── routes.py                  # FastAPI REST routes
    │   └── socketio_handlers.py       # Socket.IO event handlers
    ├── logs/                          # Log files (Docker volume)
    │   └── bridge.log
    ├── utils/
    │   ├── __init__.py
    │   └── logging_config.py          # Logging setup
    │
    └── web/                           # Next.js 15 Web UI
        ├── .env.local                 # Frontend environment variables
        ├── .eslintrc.config.mjs       # ESLint 9 flat config
        ├── .prettierrc                # Prettier config
        ├── tsconfig.json              # TypeScript strict config
        ├── tailwind.config.ts         # Tailwind configuration
        ├── next.config.ts             # Next.js configuration
        ├── package.json               # Node.js dependencies
        ├── Dockerfile                 # Standalone Next.js Docker
        │
        └── src/
            ├── app/                   # Next.js App Router
            │   ├── layout.tsx
            │   ├── page.tsx
            │   ├── providers.tsx
            │   ├── globals.css
            │   ├── login/
            │   │   └── page.tsx
            │   └── sessions/
            │       └── [id]/
            │           └── page.tsx
            │
            ├── components/            # React components
            │   ├── ui/                # Shadcn/ui base
            │   ├── layout/            # Layout components
            │   ├── sessions/          # Session components
            │   ├── activity/          # Activity feed
            │   └── modals/            # Modal dialogs
            │
            ├── features/              # Feature modules
            │   ├── sessions/
            │   │   ├── hooks/
            │   │   ├── services/
            │   │   └── types.ts
            │   ├── auth/
            │   └── notifications/
            │
            ├── lib/                   # Shared utilities
            │   ├── api-client.ts
            │   ├── socket.ts
            │   ├── utils.ts
            │   └── constants.ts
            │
            ├── types/                 # Global TypeScript types
            │   └── index.ts
            │
            └── schemas/               # Zod validation schemas
                ├── session.schema.ts
                └── auth.schema.ts
```

### .dockerignore

```
__pycache__
*.pyc
*.pyo
.env.local
.git
.gitignore
*.md
venv/
.venv/
data/
logs/
web/node_modules/
web/.next/
```

## Dependencies

### requirements.txt

```txt
# Telegram Bot
python-telegram-bot>=20.0

# HTTP Server & Client
aiohttp>=3.9.0
fastapi>=0.109.0
uvicorn>=0.27.0

# Utilities
python-dotenv>=1.0.0
pydantic>=2.5.0
```

### Installation

```bash
# Create virtual environment (recommended)
python -m venv ~/.factory/telegram-bridge/venv

# Activate (Windows)
~/.factory/telegram-bridge/venv/Scripts/activate

# Install dependencies
pip install -r ~/.factory/telegram-bridge/requirements.txt
```

### AVG Antivirus Exclusions

Add these to AVG exclusions to prevent interference:

1. Python executable: `C:\Users\USERNAME\AppData\Local\Programs\Python\Python311\python.exe`
2. Hook scripts folder: `C:\Users\USERNAME\.factory\hooks\`
3. Bridge server folder: `C:\Users\USERNAME\.factory\telegram-bridge\`

## Running the System

### Startup Sequence

1. Start the bridge server (runs in background)
   ```powershell
   # Option 1: Run in terminal (for testing)
   python C:\Users\USERNAME\.factory\telegram-bridge\server.py
   
   # Option 2: Run hidden (no console window)
   pythonw C:\Users\USERNAME\.factory\telegram-bridge\server.py
   ```

2. Start Droid normally
   ```powershell
   droid
   ```

3. Receive notifications on Telegram and respond

### Windows Auto-Start Options

#### Option A: Startup Folder (Simplest)

1. Press `Win + R`, type `shell:startup`, press Enter
2. Create a shortcut to a batch file:

```batch
@echo off
REM start_telegram_bridge.bat
cd /d C:\Users\USERNAME\.factory\telegram-bridge
pythonw server.py
```

#### Option B: Task Scheduler (Recommended)

1. Open Task Scheduler
2. Create Basic Task:
   - Name: "Telegram Droid Bridge"
   - Trigger: "When I log on"
   - Action: Start a program
   - Program: `pythonw.exe`
   - Arguments: `C:\Users\USERNAME\.factory\telegram-bridge\server.py`
   - Start in: `C:\Users\USERNAME\.factory\telegram-bridge\`
3. In Properties, check "Run whether user is logged on or not" (optional)

#### Option C: Windows Service with NSSM

```powershell
# Download NSSM from https://nssm.cc/
# Install as service:
nssm install TelegramDroidBridge "C:\Python311\pythonw.exe" "C:\Users\USERNAME\.factory\telegram-bridge\server.py"
nssm set TelegramDroidBridge AppDirectory "C:\Users\USERNAME\.factory\telegram-bridge"
nssm set TelegramDroidBridge DisplayName "Telegram Droid Bridge"
nssm set TelegramDroidBridge Start SERVICE_AUTO_START

# Start the service
nssm start TelegramDroidBridge

# Check status
nssm status TelegramDroidBridge
```

---

## Docker Deployment (Recommended)

Running the bridge server in Docker while Droid runs on the host is a clean, isolated setup.

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port for hook scripts to connect
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8765/health')" || exit 1

# Run server
CMD ["python", "server.py"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  telegram-bridge:
    build: .
    container_name: telegram-droid-bridge
    restart: unless-stopped
    ports:
      - "127.0.0.1:8765:8765"  # Only expose to localhost
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
      - TELEGRAM_ALLOWED_USERS=${TELEGRAM_ALLOWED_USERS}
      - BRIDGE_SECRET=${BRIDGE_SECRET}
    volumes:
      - ./logs:/app/logs  # Persist logs only
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### .env file (same directory as docker-compose.yml)

```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=your_user_id
TELEGRAM_ALLOWED_USERS=your_user_id
BRIDGE_SECRET=generate_random_string_here
```

### Docker Commands

```powershell
# Navigate to telegram-bridge directory
cd C:\Users\USERNAME\.factory\telegram-bridge

# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Restart
docker-compose restart

# Stop
docker-compose down

# Update and restart
docker-compose pull
docker-compose up -d --build
```

### Auto-Start Docker Container on Windows Boot

#### Option 1: Docker Desktop Settings
1. Open Docker Desktop
2. Go to Settings → General
3. Enable "Start Docker Desktop when you log in"
4. The container with `restart: unless-stopped` will auto-start

#### Option 2: Windows Task Scheduler (if not using Docker Desktop)
```powershell
# Create scheduled task to start container on login
$action = New-ScheduledTaskAction -Execute "docker-compose" -Argument "up -d" -WorkingDirectory "C:\Users\USERNAME\.factory\telegram-bridge"
$trigger = New-ScheduledTaskTrigger -AtLogon
Register-ScheduledTask -TaskName "TelegramDroidBridge" -Action $action -Trigger $trigger
```

### Hook Scripts Configuration for Docker

The hook scripts on the host connect to the same `localhost:8765` - no changes needed!

```python
# hooks/lib/bridge_client.py - same config works
BRIDGE_URL = os.getenv("BRIDGE_URL", "http://127.0.0.1:8765")
```

### Docker vs Native Comparison

| Aspect | Docker | Native Python |
|--------|--------|---------------|
| **Isolation** | ✅ Fully isolated | ❌ Shares host Python |
| **Setup** | ✅ One command | ❌ venv, pip install |
| **Updates** | ✅ Rebuild image | ❌ Manual pip update |
| **Auto-start** | ✅ Built-in restart | ⚠️ Needs Task Scheduler |
| **Resource usage** | ⚠️ ~50-100MB RAM | ✅ ~30-50MB RAM |
| **Debugging** | ⚠️ docker logs | ✅ Direct access |
| **AVG conflicts** | ✅ Less likely | ⚠️ May need exclusions |

### Troubleshooting Docker Setup

**Container won't start:**
```powershell
# Check logs
docker-compose logs telegram-bridge

# Check if port is in use
netstat -ano | findstr :8765
```

**Hook scripts can't connect:**
```powershell
# Verify container is running
docker ps

# Test connection from host
curl http://127.0.0.1:8765/health

# Check port mapping
docker port telegram-droid-bridge
```

**Telegram bot not responding:**
```powershell
# Check bot token is correct
docker-compose exec telegram-bridge env | findstr TELEGRAM

# Restart container
docker-compose restart
```

---

## Web UI Implementation (Next.js 15)

### Tech Stack

```
Framework: Next.js 15 (App Router)
├── TypeScript 5.x (strict mode)
├── Tailwind CSS 4.x
├── Socket.io (real-time WebSocket)
├── Zod (runtime validation)
├── React Query / TanStack Query (data fetching)
└── Shadcn/ui (accessible components)

Code Quality:
├── ESLint 9 (flat config)
├── Prettier
├── Husky + lint-staged
└── SOLID, DRY, KISS principles
```

### Project Structure (Feature-Based)

```
web/
├── .env.local                     # Environment variables
├── .eslintrc.config.mjs           # ESLint flat config
├── tsconfig.json                  # TypeScript strict config
├── tailwind.config.ts             # Tailwind configuration
├── next.config.ts                 # Next.js configuration
├── package.json
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Dashboard page
│   │   ├── login/
│   │   │   └── page.tsx           # Login page
│   │   ├── sessions/
│   │   │   ├── page.tsx           # Sessions list
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Session detail
│   │   └── api/                   # API routes (proxy to bridge)
│   │       ├── sessions/
│   │       │   └── route.ts
│   │       └── auth/
│   │           └── route.ts
│   │
│   ├── components/                # UI Components
│   │   ├── ui/                    # Shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── input.tsx
│   │   ├── layout/                # Layout components
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── nav-link.tsx
│   │   ├── sessions/              # Session feature components
│   │   │   ├── session-card.tsx
│   │   │   ├── session-list.tsx
│   │   │   ├── session-detail.tsx
│   │   │   └── session-input.tsx
│   │   ├── activity/              # Activity feature components
│   │   │   ├── activity-feed.tsx
│   │   │   └── activity-item.tsx
│   │   └── modals/                # Modal components
│   │       ├── permission-modal.tsx
│   │       └── confirm-modal.tsx
│   │
│   ├── features/                  # Feature modules (business logic)
│   │   ├── sessions/
│   │   │   ├── hooks/
│   │   │   │   ├── use-sessions.ts
│   │   │   │   ├── use-session.ts
│   │   │   │   └── use-session-actions.ts
│   │   │   ├── services/
│   │   │   │   └── session-service.ts
│   │   │   └── types.ts
│   │   ├── auth/
│   │   │   ├── hooks/
│   │   │   │   └── use-auth.ts
│   │   │   ├── services/
│   │   │   │   └── auth-service.ts
│   │   │   ├── context/
│   │   │   │   └── auth-context.tsx
│   │   │   └── types.ts
│   │   └── notifications/
│   │       ├── hooks/
│   │       │   └── use-notifications.ts
│   │       └── types.ts
│   │
│   ├── lib/                       # Shared utilities
│   │   ├── api-client.ts          # HTTP client wrapper
│   │   ├── socket.ts              # WebSocket client
│   │   ├── utils.ts               # General utilities
│   │   └── constants.ts           # App constants
│   │
│   ├── types/                     # Global types
│   │   ├── index.ts
│   │   ├── session.ts
│   │   ├── notification.ts
│   │   └── api.ts
│   │
│   └── schemas/                   # Zod validation schemas
│       ├── session.schema.ts
│       ├── notification.schema.ts
│       └── auth.schema.ts
│
└── public/
    └── favicon.ico
```

### Design Principles Implementation

#### SOLID Principles

```typescript
// ============================================
// S - Single Responsibility Principle
// Each module/class has ONE reason to change
// ============================================

// ❌ BAD: Component does too much
function SessionCard({ session }) {
  const [data, setData] = useState()
  // fetching, formatting, rendering, actions all in one
}

// ✅ GOOD: Separated concerns
// hooks/use-session.ts - data fetching
// services/session-service.ts - API calls
// components/session-card.tsx - rendering only

// ============================================
// O - Open/Closed Principle  
// Open for extension, closed for modification
// ============================================

// ✅ GOOD: Extensible via props/composition
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

// ============================================
// L - Liskov Substitution Principle
// Subtypes must be substitutable for base types
// ============================================

// ✅ GOOD: All notification types work with base handler
interface BaseNotification {
  id: string
  sessionId: string
  message: string
  timestamp: Date
}

interface PermissionNotification extends BaseNotification {
  type: 'permission'
  toolName: string
  toolInput: Record<string, unknown>
}

interface StopNotification extends BaseNotification {
  type: 'stop'
  summary: string
}

type Notification = PermissionNotification | StopNotification

// ============================================
// I - Interface Segregation Principle
// Many specific interfaces > one general interface
// ============================================

// ❌ BAD: Fat interface
interface SessionOperations {
  getSession(): Session
  updateSession(): void
  deleteSession(): void
  sendMessage(): void
  approve(): void
  deny(): void
}

// ✅ GOOD: Segregated interfaces
interface Readable<T> {
  get(id: string): Promise<T>
  getAll(): Promise<T[]>
}

interface Writable<T> {
  create(data: Partial<T>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}

interface SessionActions {
  sendMessage(sessionId: string, message: string): Promise<void>
  approve(sessionId: string, requestId: string): Promise<void>
  deny(sessionId: string, requestId: string): Promise<void>
}

// ============================================
// D - Dependency Inversion Principle
// Depend on abstractions, not concretions
// ============================================

// ✅ GOOD: Inject dependencies
// services/session-service.ts
export function createSessionService(apiClient: ApiClient): SessionService {
  return {
    async getSessions() {
      return apiClient.get<Session[]>('/sessions')
    },
    async getSession(id: string) {
      return apiClient.get<Session>(`/sessions/${id}`)
    }
  }
}

// Usage with dependency injection
const apiClient = createApiClient({ baseUrl: process.env.API_URL })
const sessionService = createSessionService(apiClient)
```

#### DRY Principle (Don't Repeat Yourself)

```typescript
// ============================================
// Reusable hooks for common patterns
// ============================================

// src/lib/hooks/use-async.ts
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: DependencyList = []
) {
  const [state, setState] = useState<{
    data: T | null
    error: Error | null
    loading: boolean
  }>({
    data: null,
    error: null,
    loading: true
  })

  useEffect(() => {
    let mounted = true
    
    setState(prev => ({ ...prev, loading: true }))
    
    asyncFn()
      .then(data => mounted && setState({ data, error: null, loading: false }))
      .catch(error => mounted && setState({ data: null, error, loading: false }))
    
    return () => { mounted = false }
  }, deps)

  return state
}

// ============================================
// Reusable API client factory
// ============================================

// src/lib/api-client.ts
interface ApiClientConfig {
  baseUrl: string
  headers?: Record<string, string>
}

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, headers = {} } = config

  async function request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new ApiError(response.status, await response.text())
    }

    return response.json()
  }

  return {
    get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
    post: <T>(endpoint: string, data: unknown) => 
      request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    put: <T>(endpoint: string, data: unknown) => 
      request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' })
  }
}

// ============================================
// Reusable component patterns
// ============================================

// src/components/ui/status-badge.tsx
const statusConfig = {
  running: { color: 'bg-yellow-500', label: 'Running' },
  waiting: { color: 'bg-green-500', label: 'Waiting' },
  stopped: { color: 'bg-red-500', label: 'Stopped' }
} as const

type Status = keyof typeof statusConfig

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium`}>
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      {config.label}
    </span>
  )
}
```

#### KISS Principle (Keep It Simple, Stupid)

```typescript
// ============================================
// Simple, readable code over clever code
// ============================================

// ❌ BAD: Overly clever
const getStatus = (s: Session) => 
  s.pending ? (s.pending.type === 'permission' ? 'awaiting-approval' : 
  s.pending.type === 'stop' ? 'awaiting-input' : 'waiting') : 
  s.active ? 'running' : 'stopped'

// ✅ GOOD: Clear and readable
function getSessionStatus(session: Session): SessionStatus {
  if (!session.active) {
    return 'stopped'
  }
  
  if (!session.pendingRequest) {
    return 'running'
  }
  
  return 'waiting'
}

// ============================================
// Prefer composition over inheritance
// ============================================

// ✅ GOOD: Simple composition
function SessionCard({ session, children }: SessionCardProps) {
  return (
    <Card>
      <CardHeader>
        <StatusBadge status={session.status} />
        <span>{session.name}</span>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}

// Usage - compose what you need
<SessionCard session={session}>
  <SessionActions session={session} />
</SessionCard>

<SessionCard session={session}>
  <SessionDetail session={session} />
</SessionCard>
```

### Configuration Files

#### tsconfig.json (Strict TypeScript)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    // Type Checking - Maximum strictness
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "exactOptionalPropertyTypes": true,
    
    // Modules
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    
    // Emit
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    
    // JavaScript Support
    "allowJs": true,
    "checkJs": true,
    
    // Interop
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    
    // Language and Environment
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "preserve",
    
    // Path Mapping
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/features/*": ["./src/features/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"],
      "@/schemas/*": ["./src/schemas/*"]
    },
    
    // Projects
    "incremental": true,
    
    // Plugins
    "plugins": [
      { "name": "next" }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    ".next",
    "out",
    "dist"
  ]
}
```

#### eslint.config.mjs (ESLint 9 Flat Config)

```javascript
// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import importPlugin from 'eslint-plugin-import'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'out/**',
      '*.config.{js,mjs,ts}',
    ],
  },

  // Base ESLint recommended
  eslint.configs.recommended,

  // TypeScript strict configs
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // TypeScript parser options
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React configuration
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Next.js configuration
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },

  // Import configuration
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Import ordering
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          pathGroups: [
            {
              pattern: 'react',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: 'next/**',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['react', 'next'],
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off', // TypeScript handles this
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
    },
  },

  // Custom rules
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TypeScript specific
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE'],
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      
      // React specific
      'react/prop-types': 'off', // TypeScript handles this
      'react/jsx-no-leaked-render': 'error',
      'react/jsx-curly-brace-presence': ['error', 'never'],
      'react/self-closing-comp': 'error',
      'react/jsx-sort-props': [
        'error',
        {
          callbacksLast: true,
          shorthandFirst: true,
          reservedFirst: true,
        },
      ],
      
      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // General best practices
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },

  // Disable rules that conflict with Prettier
  prettierConfig
)
```

#### next.config.ts

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,
  
  // Optimize for production
  poweredByHeader: false,
  
  // TypeScript and ESLint checks during build
  typescript: {
    // Don't ignore build errors in production
    ignoreBuildErrors: false,
  },
  eslint: {
    // Run ESLint on these directories during build
    dirs: ['src'],
    ignoreDuringBuilds: false,
  },
  
  // Environment variables validation
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
  
  // Rewrites for API proxy (to bridge server)
  async rewrites() {
    return [
      {
        source: '/api/bridge/:path*',
        destination: `${process.env.BRIDGE_URL ?? 'http://localhost:8765'}/:path*`,
      },
    ]
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

#### package.json

```json
{
  "name": "droid-control-web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings 0",
    "lint:fix": "eslint . --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "validate": "npm run type-check && npm run lint && npm run format:check",
    "prepare": "husky"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.62.0",
    "socket.io-client": "^4.8.1",
    "zod": "^3.24.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5",
    "lucide-react": "^0.468.0",
    "class-variance-authority": "^0.7.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.2",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "eslint": "^9.16.0",
    "@eslint/js": "^9.16.0",
    "typescript-eslint": "^8.17.0",
    "@next/eslint-plugin-next": "^15.1.0",
    "eslint-plugin-react": "^7.37.2",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-import": "^2.31.0",
    "eslint-plugin-jsx-a11y": "^6.10.2",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.4.2",
    "prettier-plugin-tailwindcss": "^0.6.9",
    "husky": "^9.1.7",
    "lint-staged": "^15.2.10"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --max-warnings 0",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

#### .prettierrc

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindFunctions": ["clsx", "cn", "cva"]
}
```

#### tailwind.config.ts

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
```

### Core Implementation Files

#### src/lib/utils.ts

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 60) {
    return 'just now'
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`
  }
  if (diffHour < 24) {
    return `${diffHour}h ago`
  }
  return formatDate(d)
}

/**
 * Safely parse JSON with type validation
 */
export function safeJsonParse<T>(
  json: string,
  validator: (data: unknown) => data is T
): T | null {
  try {
    const parsed: unknown = JSON.parse(json)
    return validator(parsed) ? parsed : null
  } catch {
    return null
  }
}
```

#### src/lib/api-client.ts

```typescript
import { z } from 'zod'

// API Error class
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// API Client configuration
interface ApiClientConfig {
  baseUrl: string
  headers?: Record<string, string>
}

// Response wrapper with validation
interface ApiResponse<T> {
  data: T
  status: number
}

/**
 * Create type-safe API client
 * Follows Single Responsibility - only handles HTTP communication
 */
export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, headers: defaultHeaders = {} } = config

  async function request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema<T>
  ): Promise<ApiResponse<T>> {
    const url = `${baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...defaultHeaders,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new ApiError(response.status, errorText)
    }

    const data: unknown = await response.json()

    // Validate response if schema provided
    if (schema) {
      const parsed = schema.safeParse(data)
      if (!parsed.success) {
        throw new ApiError(500, 'Invalid response format', parsed.error)
      }
      return { data: parsed.data, status: response.status }
    }

    return { data: data as T, status: response.status }
  }

  return {
    get: <T>(endpoint: string, schema?: z.ZodSchema<T>) =>
      request<T>(endpoint, { method: 'GET' }, schema),

    post: <T>(endpoint: string, body: unknown, schema?: z.ZodSchema<T>) =>
      request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }, schema),

    put: <T>(endpoint: string, body: unknown, schema?: z.ZodSchema<T>) =>
      request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }, schema),

    delete: <T>(endpoint: string, schema?: z.ZodSchema<T>) =>
      request<T>(endpoint, { method: 'DELETE' }, schema),
  }
}

// Default client instance
export const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/bridge',
})
```

#### src/lib/socket.ts

```typescript
'use client'

import { io, type Socket } from 'socket.io-client'

import type { Notification, Session } from '@/types'

// Event types for type safety
interface ServerToClientEvents {
  sessions_update: (sessions: Session[]) => void
  notification: (notification: Notification) => void
  session_status: (data: { sessionId: string; status: Session['status'] }) => void
  activity: (data: { sessionId: string; action: string; timestamp: string }) => void
  error: (message: string) => void
}

interface ClientToServerEvents {
  subscribe: (data: { sessionId: string }) => void
  unsubscribe: (data: { sessionId: string }) => void
  respond: (data: { sessionId: string; requestId: string; response: string }) => void
  approve: (data: { sessionId: string; requestId: string }) => void
  deny: (data: { sessionId: string; requestId: string }) => void
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

// Singleton socket instance
let socket: TypedSocket | null = null

/**
 * Get or create WebSocket connection
 * Follows Single Responsibility - only handles WebSocket connection
 */
export function getSocket(): TypedSocket {
  if (!socket) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8765'

    socket = io(wsUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
  }

  return socket
}

/**
 * Connect to WebSocket server
 */
export function connectSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = getSocket()

    if (sock.connected) {
      resolve()
      return
    }

    sock.on('connect', () => {
      resolve()
    })

    sock.on('connect_error', (error) => {
      reject(error)
    })

    sock.connect()
  })
}

/**
 * Disconnect from WebSocket server
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
  }
}

/**
 * Check if socket is connected
 */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false
}
```

#### src/schemas/session.schema.ts

```typescript
import { z } from 'zod'

// Session status enum
export const SessionStatusSchema = z.enum(['running', 'waiting', 'stopped'])

// Pending request schema
export const PendingRequestSchema = z.object({
  id: z.string(),
  type: z.enum(['permission', 'stop', 'input']),
  message: z.string(),
  toolName: z.string().optional(),
  toolInput: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
})

// Session schema
export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectDir: z.string(),
  status: SessionStatusSchema,
  startedAt: z.string().datetime(),
  lastActivity: z.string().datetime(),
  pendingRequest: PendingRequestSchema.nullable(),
})

// Sessions array schema
export const SessionsArraySchema = z.array(SessionSchema)

// Type inference from schemas
export type SessionStatus = z.infer<typeof SessionStatusSchema>
export type PendingRequest = z.infer<typeof PendingRequestSchema>
export type Session = z.infer<typeof SessionSchema>
```

#### src/features/sessions/hooks/use-sessions.ts

```typescript
'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { apiClient } from '@/lib/api-client'
import { getSocket } from '@/lib/socket'
import { SessionsArraySchema, type Session } from '@/schemas/session.schema'

const SESSIONS_QUERY_KEY = ['sessions'] as const

/**
 * Hook for fetching and subscribing to sessions
 * Follows Single Responsibility - only manages session list state
 */
export function useSessions() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get('/sessions', SessionsArraySchema)
      return response.data
    },
    staleTime: 10_000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true,
  })

  // Subscribe to real-time updates
  useEffect(() => {
    const socket = getSocket()

    const handleSessionsUpdate = (sessions: Session[]) => {
      queryClient.setQueryData(SESSIONS_QUERY_KEY, sessions)
    }

    const handleSessionStatus = (data: { sessionId: string; status: Session['status'] }) => {
      queryClient.setQueryData<Session[]>(SESSIONS_QUERY_KEY, (old) =>
        old?.map((session) =>
          session.id === data.sessionId ? { ...session, status: data.status } : session
        )
      )
    }

    socket.on('sessions_update', handleSessionsUpdate)
    socket.on('session_status', handleSessionStatus)

    return () => {
      socket.off('sessions_update', handleSessionsUpdate)
      socket.off('session_status', handleSessionStatus)
    }
  }, [queryClient])

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
```

#### src/features/sessions/hooks/use-session-actions.ts

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { apiClient } from '@/lib/api-client'
import { getSocket } from '@/lib/socket'

interface RespondParams {
  sessionId: string
  requestId: string
  response: string
}

interface ApproveParams {
  sessionId: string
  requestId: string
}

/**
 * Hook for session actions (respond, approve, deny)
 * Follows Interface Segregation - separate actions interface
 */
export function useSessionActions() {
  const queryClient = useQueryClient()
  const socket = getSocket()

  // Send message/response via WebSocket (real-time)
  const respond = useCallback(
    ({ sessionId, requestId, response }: RespondParams) => {
      socket.emit('respond', { sessionId, requestId, response })
    },
    [socket]
  )

  // Approve via WebSocket
  const approve = useCallback(
    ({ sessionId, requestId }: ApproveParams) => {
      socket.emit('approve', { sessionId, requestId })
    },
    [socket]
  )

  // Deny via WebSocket
  const deny = useCallback(
    ({ sessionId, requestId }: ApproveParams) => {
      socket.emit('deny', { sessionId, requestId })
    },
    [socket]
  )

  // Send message via REST API (fallback)
  const sendMessageMutation = useMutation({
    mutationFn: async (params: RespondParams) => {
      const response = await apiClient.post(`/sessions/${params.sessionId}/respond`, {
        requestId: params.requestId,
        response: params.response,
      })
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  return {
    respond,
    approve,
    deny,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
  }
}
```

#### src/components/sessions/session-card.tsx

```typescript
'use client'

import { Clock, Folder, Terminal } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSessionActions } from '@/features/sessions/hooks/use-session-actions'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Session } from '@/schemas/session.schema'

interface SessionCardProps {
  session: Session
}

const STATUS_CONFIG = {
  running: {
    color: 'bg-yellow-500',
    label: 'Running',
    icon: '🔄',
  },
  waiting: {
    color: 'bg-green-500',
    label: 'Waiting',
    icon: '⏳',
  },
  stopped: {
    color: 'bg-red-500',
    label: 'Stopped',
    icon: '⏹️',
  },
} as const

/**
 * Session card component
 * Follows Single Responsibility - only renders session UI
 */
export function SessionCard({ session }: SessionCardProps) {
  const [message, setMessage] = useState('')
  const { respond, approve, deny } = useSessionActions()

  const statusConfig = STATUS_CONFIG[session.status]
  const hasPendingRequest = session.pendingRequest !== null

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!message.trim() || !session.pendingRequest) {
      return
    }

    respond({
      sessionId: session.id,
      requestId: session.pendingRequest.id,
      response: message,
    })
    setMessage('')
  }

  const handleApprove = () => {
    if (session.pendingRequest) {
      approve({
        sessionId: session.id,
        requestId: session.pendingRequest.id,
      })
    }
  }

  const handleDeny = () => {
    if (session.pendingRequest) {
      deny({
        sessionId: session.id,
        requestId: session.pendingRequest.id,
      })
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', statusConfig.color)} />
          <span className="font-semibold">{session.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {statusConfig.icon} {statusConfig.label}
        </span>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Meta info */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Folder className="h-3 w-3" />
            {session.projectDir}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(session.lastActivity)}
          </span>
        </div>

        {/* Pending request */}
        {hasPendingRequest && session.pendingRequest && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm">{session.pendingRequest.message}</p>

            {session.pendingRequest.toolName && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Terminal className="h-3 w-3" />
                <code>{session.pendingRequest.toolName}</code>
              </div>
            )}

            {/* Approval buttons for permission requests */}
            {session.pendingRequest.type === 'permission' && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="default" onClick={handleApprove}>
                  ✅ Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={handleDeny}>
                  ❌ Deny
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Input form for waiting sessions */}
        {session.status === 'waiting' && (
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Input
              className="flex-1"
              placeholder="Send instruction..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button disabled={!message.trim()} type="submit">
              Send
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
```

#### src/app/page.tsx (Dashboard)

```typescript
import { Suspense } from 'react'

import { SessionList } from '@/components/sessions/session-list'
import { ActivityFeed } from '@/components/activity/activity-feed'

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">🤖 Droid Control</h1>
        <p className="text-muted-foreground">Manage your Factory.ai Droid sessions</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sessions list */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Active Sessions</h2>
          <Suspense fallback={<SessionListSkeleton />}>
            <SessionList />
          </Suspense>
        </div>

        {/* Activity feed */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Activity</h2>
          <Suspense fallback={<ActivityFeedSkeleton />}>
            <ActivityFeed />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function SessionListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}
```

#### src/app/layout.tsx

```typescript
import './globals.css'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Droid Control',
  description: 'Control your Factory.ai Droid sessions remotely',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

#### src/app/providers.tsx

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, useEffect, type ReactNode } from 'react'

import { connectSocket, disconnectSocket } from '@/lib/socket'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  )

  // Connect WebSocket on mount
  useEffect(() => {
    void connectSocket()

    return () => {
      disconnectSocket()
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

---

## Cloudflare Tunnel Setup

Expose your local bridge server to the internet securely via Cloudflare Tunnel.

### Prerequisites

1. Cloudflare account (free)
2. Domain added to Cloudflare (or use `*.trycloudflare.com` for testing)
3. `cloudflared` CLI installed

### Install cloudflared on Windows

```powershell
# Option 1: Winget
winget install Cloudflare.cloudflared

# Option 2: Download manually
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

### Quick Test (No domain required)

```powershell
# Temporary public URL (changes each time)
cloudflared tunnel --url http://localhost:8765

# Output:
# Your quick Tunnel has been created! Visit it at:
# https://random-words-here.trycloudflare.com
```

### Production Setup with Custom Domain

#### Step 1: Login to Cloudflare
```powershell
cloudflared tunnel login
# Opens browser for authentication
```

#### Step 2: Create Tunnel
```powershell
cloudflared tunnel create droid-control
# Outputs: Created tunnel droid-control with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

#### Step 3: Create Config File

```yaml
# C:\Users\USERNAME\.cloudflared\config.yml

tunnel: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # Your tunnel ID
credentials-file: C:\Users\USERNAME\.cloudflared\xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json

ingress:
  - hostname: droid.yourdomain.com
    service: http://localhost:8765
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

#### Step 4: Create DNS Record
```powershell
cloudflared tunnel route dns droid-control droid.yourdomain.com
```

#### Step 5: Run Tunnel
```powershell
# Foreground (for testing)
cloudflared tunnel run droid-control

# Or install as Windows service
cloudflared service install
net start cloudflared
```

### Docker Compose with Cloudflare Tunnel

Add cloudflared to your docker-compose:

```yaml
version: '3.8'

services:
  telegram-bridge:
    build: .
    container_name: telegram-droid-bridge
    restart: unless-stopped
    ports:
      - "127.0.0.1:8765:8765"
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
      - TELEGRAM_ALLOWED_USERS=${TELEGRAM_ALLOWED_USERS}
      - BRIDGE_SECRET=${BRIDGE_SECRET}
      - WEB_AUTH_USERNAME=${WEB_AUTH_USERNAME}
      - WEB_AUTH_PASSWORD=${WEB_AUTH_PASSWORD}
    volumes:
      - ./logs:/app/logs

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - telegram-bridge
```

### Getting Cloudflare Tunnel Token

1. Go to Cloudflare Zero Trust Dashboard
2. Navigate to Networks → Tunnels
3. Create a new tunnel or select existing
4. Copy the tunnel token
5. Add to `.env`:
   ```env
   CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...very-long-token
   ```

---

## Web Authentication (Required for Public Access)

Since the Web UI is exposed to the internet, authentication is **critical**.

### Authentication Options

| Method | Security | Ease of Use | Recommended |
|--------|----------|-------------|-------------|
| **Cloudflare Access** | ✅ High | ✅ Easy | ✅ Best |
| **Basic Auth** | ⚠️ Medium | ✅ Easy | For testing |
| **JWT Tokens** | ✅ High | ⚠️ Complex | For apps |
| **OAuth (Google/GitHub)** | ✅ High | ⚠️ Medium | Good option |

### Option 1: Cloudflare Access (Recommended)

Cloudflare Access adds authentication before traffic reaches your server.

1. Go to Cloudflare Zero Trust Dashboard
2. Navigate to Access → Applications
3. Add Application → Self-hosted
4. Configure:
   - Application name: "Droid Control"
   - Domain: `droid.yourdomain.com`
   - Identity providers: Email OTP, Google, GitHub, etc.
5. Create Access Policy:
   - Allow: Your email address
   - Or: Specific email domain

**Benefits:**
- Auth happens at Cloudflare edge (before reaching your server)
- No code changes needed
- Multiple auth methods (email, Google, GitHub)
- Free for up to 50 users

### Option 2: Basic Auth in FastAPI

```python
# api/auth.py
import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import os

security = HTTPBasic()

def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(
        credentials.username.encode("utf8"),
        os.getenv("WEB_AUTH_USERNAME", "admin").encode("utf8")
    )
    correct_password = secrets.compare_digest(
        credentials.password.encode("utf8"),
        os.getenv("WEB_AUTH_PASSWORD", "changeme").encode("utf8")
    )
    
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


# In server.py - protect routes
from api.auth import verify_credentials

@app.get("/api/sessions", dependencies=[Depends(verify_credentials)])
async def get_sessions():
    ...
```

### Option 3: JWT Authentication

```python
# api/auth.py
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
import os

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception


# Login endpoint
@app.post("/api/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Verify against env vars or database
    if form_data.username != os.getenv("WEB_AUTH_USERNAME"):
        raise HTTPException(status_code=400, detail="Incorrect username")
    if not pwd_context.verify(form_data.password, os.getenv("WEB_AUTH_PASSWORD_HASH")):
        raise HTTPException(status_code=400, detail="Incorrect password")
    
    access_token = create_access_token(data={"sub": form_data.username})
    return {"access_token": access_token, "token_type": "bearer"}
```

### Environment Variables for Auth

```env
# .env additions for authentication
WEB_AUTH_USERNAME=admin
WEB_AUTH_PASSWORD=your-secure-password-here

# For JWT (generate with: openssl rand -hex 32)
JWT_SECRET_KEY=your-random-secret-key-here
```

---

## Updated Dockerfile (with Next.js Web UI build)

```dockerfile
# ================================
# Stage 1: Build Next.js frontend
# ================================
FROM node:20-slim AS frontend-builder

WORKDIR /app/web

# Install dependencies
COPY web/package*.json ./
RUN npm ci

# Copy source and build
COPY web/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ================================
# Stage 2: Production image
# ================================
FROM python:3.11-slim

WORKDIR /app

# Install Node.js for Next.js server
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .
RUN rm -rf web/

# Copy built Next.js app
COPY --from=frontend-builder /app/web/.next /app/web/.next
COPY --from=frontend-builder /app/web/public /app/web/public
COPY --from=frontend-builder /app/web/package*.json /app/web/
COPY --from=frontend-builder /app/web/node_modules /app/web/node_modules

# Expose ports
EXPOSE 8765 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8765/health')" || exit 1

# Start script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

CMD ["docker-entrypoint.sh"]
```

### docker-entrypoint.sh

```bash
#!/bin/bash
set -e

# Start Next.js frontend in background
cd /app/web
npm start &

# Start FastAPI backend
cd /app
python server.py
```

### Alternative: docker-compose with separate services

```yaml
version: '3.8'

services:
  # FastAPI Backend + Telegram Bot
  bridge-api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: droid-bridge-api
    restart: unless-stopped
    ports:
      - "127.0.0.1:8765:8765"
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
      - TELEGRAM_ALLOWED_USERS=${TELEGRAM_ALLOWED_USERS}
      - BRIDGE_SECRET=${BRIDGE_SECRET}
    volumes:
      - ./logs:/app/logs

  # Next.js Web UI
  web-ui:
    build:
      context: ./web
      dockerfile: Dockerfile
    container_name: droid-web-ui
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://bridge-api:8765
      - NEXT_PUBLIC_WS_URL=ws://bridge-api:8765
    depends_on:
      - bridge-api

  # Cloudflare Tunnel
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - web-ui
      - bridge-api
```

### web/Dockerfile (Standalone Next.js)

```dockerfile
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### next.config.ts (with standalone output)

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone', // Enable standalone build for Docker
  
  // ... rest of config
}

export default nextConfig
```

### Updated requirements.txt

```txt
# Telegram Bot
python-telegram-bot>=20.0

# HTTP Server & Client
aiohttp>=3.9.0
fastapi>=0.109.0
uvicorn>=0.27.0

# WebSocket / Socket.IO
python-socketio>=5.11.0
websockets>=12.0

# Authentication
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.6

# Utilities
python-dotenv>=1.0.0
pydantic>=2.5.0

# CORS
fastapi-cors>=0.0.6

# NOTE: No database needed!
# Sessions are transient - stored in-memory
# If you need persistence later, add: aiosqlite>=0.19.0
```

---

## Complete .env File

```env
# ================================
# Telegram Configuration
# ================================
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=your_user_id
TELEGRAM_ALLOWED_USERS=your_user_id

# ================================
# Bridge Server
# ================================
BRIDGE_SECRET=generate-random-string-here
BRIDGE_PORT=8765
BRIDGE_URL=http://localhost:8765

# ================================
# Web Authentication
# ================================
WEB_AUTH_USERNAME=admin
WEB_AUTH_PASSWORD=your-secure-password

# JWT (generate with: openssl rand -hex 32)
JWT_SECRET_KEY=generate-with-openssl-rand-hex-32

# ================================
# Cloudflare Tunnel (if using Docker)
# ================================
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...

# ================================
# Logging
# ================================
LOG_LEVEL=INFO
```

### web/.env.local (Next.js Frontend)

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8765
NEXT_PUBLIC_WS_URL=ws://localhost:8765

# For production with Cloudflare
# NEXT_PUBLIC_API_URL=https://droid.yourdomain.com
# NEXT_PUBLIC_WS_URL=wss://droid.yourdomain.com

# Build Configuration
NEXT_TELEMETRY_DISABLED=1
```

---

### Verifying the Server is Running

```python
# health_check.py - Run to verify server is up
import requests

try:
    response = requests.get("http://127.0.0.1:8765/health")
    if response.status_code == 200:
        print("✅ Bridge server is running")
        print(response.json())
    else:
        print("❌ Server returned error:", response.status_code)
except requests.ConnectionError:
    print("❌ Bridge server is not running")
```

## Testing Checklist

- [ ] Bot responds to /start from authorized user
- [ ] Bot ignores messages from unauthorized users
- [ ] Notification hook sends message to Telegram
- [ ] Stop hook waits for response correctly
- [ ] Stop hook respects timeout
- [ ] PreToolUse approval flow works
- [ ] Inline keyboard callbacks work
- [ ] Bridge server handles concurrent requests
- [ ] System recovers from Telegram API errors
- [ ] No infinite loops in stop hook (check stop_hook_active)
- [ ] Windows paths handled correctly (backslashes)
- [ ] AVG antivirus doesn't block the scripts

## Error Handling

1. **Telegram API Errors**: Retry with exponential backoff
2. **Bridge Server Down**: Hook scripts should fail gracefully (exit 0)
3. **Timeout**: Return appropriate default (deny for PreToolUse, allow stop for Stop)
4. **Invalid JSON**: Log error, return safe default
5. **Network Issues**: Cache messages and retry

## Multi-Session Support (Required Feature)

### Overview

The system MUST support running multiple Droid instances simultaneously, each controllable via Telegram. Users should be able to:
- Run multiple Droid sessions in different project directories
- Receive notifications from all sessions with clear identification
- Respond to specific sessions
- Switch context between sessions easily

### Session Identification

Each Droid session provides these identifiers in hook JSON input:
- `session_id`: Unique session identifier
- `FACTORY_PROJECT_DIR`: Environment variable with project path

Use these to create a friendly session name:
```
Session: backend-api (~/projects/backend-api)
Session: frontend-app (~/projects/frontend-app)
```

### Architecture for Multi-Session

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Bot                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Active Sessions:                                    │    │
│  │  [1] 🟢 backend-api    - Waiting for input          │    │
│  │  [2] 🟡 frontend-app   - Running task               │    │
│  │  [3] 🔴 data-pipeline  - Stopped                    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Bridge Server                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  Session 1   │ │  Session 2   │ │  Session 3   │        │
│  │  Queue       │ │  Queue       │ │  Queue       │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Droid 1    │      │   Droid 2    │      │   Droid 3    │
│  backend-api │      │ frontend-app │      │data-pipeline │
└──────────────┘      └──────────────┘      └──────────────┘
```

### Session Registry

The bridge server must maintain a session registry:

```python
# session_registry.py

class SessionRegistry:
    """
    Tracks all active Droid sessions
    """
    
    sessions = {
        "session_id_abc123": {
            "id": "session_id_abc123",
            "name": "backend-api",           # Derived from project dir
            "project_dir": "C:/projects/backend-api",
            "status": "waiting",             # waiting | running | stopped
            "started_at": "2024-01-15T10:30:00Z",
            "last_activity": "2024-01-15T11:45:00Z",
            "pending_request": {
                "type": "stop",              # notification | permission | stop
                "request_id": "req_xyz789",
                "message": "Task completed",
                "created_at": "2024-01-15T11:45:00Z"
            }
        },
        # ... more sessions
    }
    
    def register_session(self, session_id, project_dir): ...
    def update_status(self, session_id, status): ...
    def get_active_sessions(self): ...
    def get_session_by_name(self, name): ...
    def get_session_by_index(self, index): ...
    def remove_session(self, session_id): ...
```

### Telegram Commands for Multi-Session

| Command | Description |
|---------|-------------|
| `/sessions` | List all active sessions with status |
| `/switch <name\|number>` | Set active session for subsequent messages |
| `/status [name]` | Show status of specific or all sessions |
| `/broadcast <message>` | Send same instruction to all waiting sessions |
| `/stop <name\|number>` | Signal specific session to stop |
| `/stopall` | Signal all sessions to stop |

### Message Routing

#### Option A: Explicit Session Selection (Recommended)

User must specify which session to respond to:

```
🔔 *[backend-api] Permission Required*

Droid wants to execute:
Tool: `Bash`
Command: `npm install`

Reply: /1 approve or /1 deny
```

User responds with session prefix:
```
/1 approve
/2 continue with the tests
/3 deny
```

#### Option B: Active Session Mode

User sets an "active" session, all messages go there:

```
You: /switch backend-api
Bot: ✅ Active session: backend-api

You: approve
Bot: ✅ Approved Bash command in backend-api

You: /switch frontend-app  
Bot: ✅ Active session: frontend-app
```

#### Option C: Smart Context (Advanced)

Bot infers which session based on:
- Most recent notification
- Keywords in message matching project
- If ambiguous, ask user to clarify

### Multi-Session Message Formats

**Session List:**
```
📋 *Active Sessions*

1. 🟢 `backend-api`
   └─ Waiting for input (2m ago)
   
2. 🟡 `frontend-app`
   └─ Running: "Add unit tests"
   
3. 🔴 `data-pipeline`
   └─ Stopped (15m ago)

Use /switch <name> or reply with /<number> <message>
```

**Multi-Session Notification:**
```
🔔 *[backend-api]* Session Started

Project: C:/projects/backend-api
Time: 2024-01-15 10:30:00

---

🔔 *[frontend-app]* Permission Required

Tool: `Write`
File: `src/components/Button.tsx`

Reply: /2 approve or /2 deny
```

**Inline Keyboards with Session Context:**
```
⚠️ *[backend-api] Permission Required*

Droid wants to run:
`rm -rf node_modules && npm install`

[✅ Approve] [❌ Deny]
     ↓
(callback_data includes session_id)
```

### Hook Script Updates for Multi-Session

All hook scripts must include session identification:

```python
# In every hook script

import os
import sys
import json

def main():
    # Read hook input
    input_data = json.load(sys.stdin)
    
    # Extract session identifiers
    session_id = input_data.get("session_id", "unknown")
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", "unknown")
    
    # Derive friendly name from project directory
    session_name = os.path.basename(project_dir)
    
    # Register/update session in bridge server
    bridge_client.register_session(
        session_id=session_id,
        project_dir=project_dir,
        session_name=session_name
    )
    
    # Send notification with session context
    bridge_client.notify(
        session_id=session_id,
        session_name=session_name,
        message="...",
        # ... other params
    )
    
    # Wait for response for THIS specific session
    response = bridge_client.wait_for_response(
        session_id=session_id,
        timeout=300
    )
```

### Bridge Server API Updates

```
POST /sessions/register
  Body: { session_id, project_dir, session_name }
  
GET /sessions
  Response: [{ id, name, status, last_activity, pending_request }, ...]

GET /sessions/{session_id}
  Response: { id, name, status, ... }

DELETE /sessions/{session_id}
  (Called by SessionEnd hook)

POST /sessions/{session_id}/notify
  Body: { type, message, buttons }
  
POST /sessions/{session_id}/wait
  Body: { request_id, timeout }
  Response: { response_text } or { timeout: true }

POST /sessions/{session_id}/respond
  Body: { request_id, response_text }
  (Called by Telegram bot when user responds)
```

### Handling Concurrent Requests

When multiple sessions need attention simultaneously:

1. **Queue Management**: Each session has its own response queue
2. **Priority**: Show all pending requests, let user choose order
3. **Timeouts**: Each session's timeout is independent
4. **Default Actions**: Configure default action if user doesn't respond in time

```python
# Bridge server handles concurrent waits

class MultiSessionQueue:
    def __init__(self):
        self.queues = {}  # session_id -> asyncio.Queue
        self.pending = {}  # session_id -> PendingRequest
    
    async def wait_for_response(self, session_id, timeout):
        """Each session waits on its own queue"""
        queue = self.queues.setdefault(session_id, asyncio.Queue())
        try:
            response = await asyncio.wait_for(queue.get(), timeout=timeout)
            return response
        except asyncio.TimeoutError:
            return None
    
    def deliver_response(self, session_id, response):
        """Telegram bot calls this when user responds"""
        if session_id in self.queues:
            self.queues[session_id].put_nowait(response)
```

### Session Storage (In-Memory)

Sessions are stored in-memory using a simple Python dict. This is intentional:

```python
# core/session_registry.py

from typing import Dict, Optional
from datetime import datetime
from pydantic import BaseModel

class Session(BaseModel):
    id: str
    name: str
    project_dir: str
    status: str = "running"  # running | waiting | stopped
    started_at: datetime
    last_activity: datetime
    pending_request: Optional[dict] = None

class SessionRegistry:
    """
    In-memory session storage.
    
    Why no database?
    - Sessions are transient (tied to Droid lifetime)
    - Hooks re-register on every event anyway
    - Simpler = more reliable
    - If bridge restarts, Droid hooks will re-register
    """
    
    def __init__(self):
        self._sessions: Dict[str, Session] = {}
    
    def register(self, session_id: str, project_dir: str, name: str) -> Session:
        now = datetime.utcnow()
        session = Session(
            id=session_id,
            name=name,
            project_dir=project_dir,
            started_at=now,
            last_activity=now
        )
        self._sessions[session_id] = session
        return session
    
    def get(self, session_id: str) -> Optional[Session]:
        return self._sessions.get(session_id)
    
    def get_all(self) -> list[Session]:
        return list(self._sessions.values())
    
    def update(self, session_id: str, **kwargs) -> Optional[Session]:
        if session := self._sessions.get(session_id):
            for key, value in kwargs.items():
                if hasattr(session, key):
                    setattr(session, key, value)
            session.last_activity = datetime.utcnow()
            return session
        return None
    
    def remove(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

# Global instance
session_registry = SessionRegistry()
```

**Future Enhancement (Optional):** If you later need persistence (e.g., activity history, analytics), add SQLite:

```python
# Optional: Add to requirements.txt
# aiosqlite>=0.19.0

# Then create a DatabaseSessionRegistry that implements the same interface
```

### Testing Multi-Session

- [ ] Start 3 Droid instances in different directories
- [ ] All 3 register with bridge server
- [ ] /sessions shows all 3
- [ ] Notification from session 1 shows correct label
- [ ] Can respond to session 2 while session 1 is waiting
- [ ] Session timeouts are independent
- [ ] /broadcast sends to all waiting sessions
- [ ] SessionEnd properly removes from registry
- [ ] Inline keyboard callbacks route to correct session

---

## Python Code Templates

### Bridge Server Entry Point (server.py)

```python
"""
Telegram-Droid Bridge Server
Main entry point - runs FastAPI server and Telegram bot concurrently
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from dotenv import load_dotenv

from bot.telegram_bot import TelegramBotManager
from api.routes import router
from core.session_registry import SessionRegistry
from utils.logging_config import setup_logging

load_dotenv()
setup_logging()
logger = logging.getLogger(__name__)

# Global instances
session_registry = SessionRegistry()
bot_manager: TelegramBotManager = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global bot_manager
    
    # Startup
    logger.info("Starting Telegram-Droid Bridge Server...")
    bot_manager = TelegramBotManager(session_registry)
    asyncio.create_task(bot_manager.start())
    logger.info("Bridge server started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    if bot_manager:
        await bot_manager.stop()


app = FastAPI(title="Telegram-Droid Bridge", lifespan=lifespan)
app.include_router(router)

# Make registry available to routes
app.state.session_registry = session_registry
app.state.bot_manager = lambda: bot_manager


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_sessions": len(session_registry.get_active_sessions()),
        "bot_connected": bot_manager.is_connected if bot_manager else False
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)
```

### Hook Client Library (hooks/lib/bridge_client.py)

```python
"""
Bridge Client - Used by hook scripts to communicate with bridge server
"""
import os
import json
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

BRIDGE_URL = os.getenv("BRIDGE_URL", "http://127.0.0.1:8765")
BRIDGE_SECRET = os.getenv("BRIDGE_SECRET", "")


def _make_request(endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Make HTTP POST request to bridge server"""
    url = f"{BRIDGE_URL}{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "X-Bridge-Secret": BRIDGE_SECRET
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as e:
        return {"error": str(e), "success": False}


def register_session(session_id: str, project_dir: str, session_name: str) -> bool:
    """Register or update a Droid session"""
    result = _make_request("/sessions/register", {
        "session_id": session_id,
        "project_dir": project_dir,
        "session_name": session_name
    })
    return result.get("success", False)


def notify(
    session_id: str,
    session_name: str,
    message: str,
    notification_type: str = "info",
    buttons: Optional[list] = None
) -> bool:
    """Send notification to Telegram"""
    result = _make_request(f"/sessions/{session_id}/notify", {
        "session_name": session_name,
        "message": message,
        "type": notification_type,
        "buttons": buttons or []
    })
    return result.get("success", False)


def wait_for_response(
    session_id: str,
    request_id: str,
    timeout: int = 300
) -> Optional[str]:
    """Wait for user response from Telegram (blocking)"""
    result = _make_request(f"/sessions/{session_id}/wait", {
        "request_id": request_id,
        "timeout": timeout
    })
    
    if result.get("timeout"):
        return None
    return result.get("response_text")


def unregister_session(session_id: str) -> bool:
    """Remove session from registry"""
    req = urllib.request.Request(
        f"{BRIDGE_URL}/sessions/{session_id}",
        method="DELETE",
        headers={"X-Bridge-Secret": BRIDGE_SECRET}
    )
    try:
        with urllib.request.urlopen(req, timeout=5):
            return True
    except:
        return False
```

### Example Hook Script (hooks/telegram_stop.py)

```python
#!/usr/bin/env python3
"""
Stop Hook Script
Notifies user when Droid stops, waits for next instruction
"""
import os
import sys
import json
import uuid

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, wait_for_response


def main():
    # Read hook input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)  # Fail gracefully
    
    # Check if we're already in a stop hook loop
    if input_data.get("stop_hook_active", False):
        # Prevent infinite loop - let Droid stop
        sys.exit(0)
    
    # Extract session info
    session_id = input_data.get("session_id", "unknown")
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", os.getcwd())
    session_name = os.path.basename(project_dir)
    
    # Register/update session
    register_session(session_id, project_dir, session_name)
    
    # Send stop notification
    notify(
        session_id=session_id,
        session_name=session_name,
        message="✅ Droid has stopped.\n\nReply with your next instruction or /done to end.",
        notification_type="stop",
        buttons=[
            {"text": "✅ Done", "callback": "done"},
            {"text": "📋 Status", "callback": "status"}
        ]
    )
    
    # Wait for user response
    request_id = str(uuid.uuid4())
    response = wait_for_response(
        session_id=session_id,
        request_id=request_id,
        timeout=300  # 5 minutes
    )
    
    if response is None or response.lower() in ["/done", "done"]:
        # User wants to stop or timeout - allow Droid to stop
        sys.exit(0)
    else:
        # User sent new instruction - block stop and continue
        output = {
            "decision": "block",
            "reason": f"User instruction: {response}"
        }
        print(json.dumps(output))
        sys.exit(0)


if __name__ == "__main__":
    main()
```

### Example Hook Script (hooks/telegram_pre_tool.py)

```python
#!/usr/bin/env python3
"""
PreToolUse Hook Script
Asks for approval before executing potentially dangerous tools
"""
import os
import sys
import json
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from bridge_client import register_session, notify, wait_for_response


def format_tool_input(tool_name: str, tool_input: dict) -> str:
    """Format tool input for readable Telegram message"""
    if tool_name == "Bash":
        return f"```\n{tool_input.get('command', 'N/A')}\n```"
    elif tool_name in ["Write", "Edit"]:
        path = tool_input.get("path", "N/A")
        return f"File: `{path}`"
    else:
        return f"```json\n{json.dumps(tool_input, indent=2)[:500]}\n```"


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        # Fail open - allow tool to proceed
        print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
        sys.exit(0)
    
    session_id = input_data.get("session_id", "unknown")
    project_dir = os.environ.get("FACTORY_PROJECT_DIR", os.getcwd())
    session_name = os.path.basename(project_dir)
    tool_name = input_data.get("tool_name", "Unknown")
    tool_input = input_data.get("tool_input", {})
    
    register_session(session_id, project_dir, session_name)
    
    # Format message
    formatted_input = format_tool_input(tool_name, tool_input)
    message = f"⚠️ *Permission Required*\n\nTool: `{tool_name}`\n{formatted_input}"
    
    # Send approval request
    notify(
        session_id=session_id,
        session_name=session_name,
        message=message,
        notification_type="permission",
        buttons=[
            {"text": "✅ Approve", "callback": "approve"},
            {"text": "❌ Deny", "callback": "deny"}
        ]
    )
    
    # Wait for response
    request_id = str(uuid.uuid4())
    response = wait_for_response(
        session_id=session_id,
        request_id=request_id,
        timeout=120  # 2 minutes
    )
    
    if response and response.lower() in ["approve", "yes", "y", "ok"]:
        output = {"hookSpecificOutput": {"permissionDecision": "allow"}}
    else:
        output = {
            "hookSpecificOutput": {
                "permissionDecision": "deny",
                "permissionDecisionReason": f"User denied via Telegram: {response or 'timeout'}"
            }
        }
    
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
```

---

## Optional Enhancements

1. **Voice Messages**: Convert voice to text for hands-free control
2. **File Sharing**: Send/receive files through Telegram
3. **Rich Previews**: Send code snippets with syntax highlighting
4. **Progress Updates**: Periodic updates during long operations
5. **Mobile Notifications**: Use Telegram's notification priority settings
6. **Session Groups**: Group related sessions (e.g., "microservices" group)
7. **Quick Templates**: Save common responses as templates
8. **Session Aliases**: Custom names instead of directory-based names

---

## Quick Start Summary

### Step 1: Create Telegram Bot
```
1. Open Telegram, search for @BotFather
2. Send /newbot
3. Choose a name and username
4. Save the bot token
```

### Step 2: Get Your Chat ID
```
1. Search for @userinfobot in Telegram
2. Send /start
3. Copy your user ID number
```

### Step 3: Configure Environment
```env
# C:\Users\USERNAME\.factory\telegram-bridge\.env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=your_user_id
TELEGRAM_ALLOWED_USERS=your_user_id
BRIDGE_SECRET=generate_random_string_here

# For Web UI auth
WEB_AUTH_USERNAME=admin
WEB_AUTH_PASSWORD=your-secure-password
```

### Step 4: Create Hook Scripts
Copy the Python hook scripts to `C:\Users\USERNAME\.factory\hooks\`

### Step 5: Configure Droid
Update `C:\Users\USERNAME\.factory\settings.json` with hook configurations

### Step 6: Start Bridge Server

```powershell
cd C:\Users\USERNAME\.factory\telegram-bridge
docker-compose up -d --build

# Verify
docker-compose ps
curl http://127.0.0.1:8765/health
```

### Step 7: Expose via Cloudflare Tunnel (Optional - for Web UI access)

**Quick test (temporary URL):**
```powershell
cloudflared tunnel --url http://localhost:8765
```

**Production setup:**
```powershell
# Create tunnel
cloudflared tunnel login
cloudflared tunnel create droid-control
cloudflared tunnel route dns droid-control droid.yourdomain.com

# Run tunnel
cloudflared tunnel run droid-control
```

### Step 8: Test

**Telegram:**
```powershell
cd C:\projects\my-project
droid
# You should receive a Telegram notification!
```

**Web UI:**
```
Open https://droid.yourdomain.com in browser
Or http://localhost:8765 for local access
```

---

## Summary: Access Methods

| Method | URL | Auth | Use Case |
|--------|-----|------|----------|
| **Local Web** | `http://localhost:8765` | Basic Auth | Local development |
| **Cloudflare Web** | `https://droid.yourdomain.com` | Cloudflare Access | Remote access |
| **Telegram** | Telegram App | Bot + User ID | Mobile, quick responses |

---

Good luck! 🚀
