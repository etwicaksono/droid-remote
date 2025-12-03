"""
Milestone 3 Tests: Hook Scripts
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import subprocess
import json
import os

HOOKS_DIR = os.path.expanduser("~/.factory/hooks")


def run_hook_with_input(hook_name: str, input_data: dict) -> tuple:
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


def test_bridge_client_library():
    """Test 3.1: Bridge client library functions work"""
    print("Test 3.1: Bridge client library...")
    
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


def test_notify_hook():
    """Test 3.2: Notification hook sends to bridge"""
    print("Test 3.2: Notification hook...")
    
    input_data = {
        "session_id": "test-session-notify",
        "message": "🧪 Milestone 3: Hook notification test!",
        "type": "info"
    }
    
    returncode, stdout, stderr = run_hook_with_input("telegram_notify", input_data)
    
    assert returncode == 0, f"Hook should exit 0, got {returncode}. Stderr: {stderr}"
    print("  ✅ Notification hook executed successfully")
    print("  📱 CHECK TELEGRAM: You should see the hook notification!")
    return True


def test_session_start_hook():
    """Test 3.3: Session start hook registers session"""
    print("Test 3.3: Session start hook...")
    
    input_data = {
        "session_id": "test-session-start",
        "trigger": "startup"
    }
    
    returncode, stdout, stderr = run_hook_with_input("telegram_session_start", input_data)
    
    assert returncode == 0, f"Hook should exit 0, got {returncode}. Stderr: {stderr}"
    print("  ✅ Session start hook executed successfully")
    return True


def test_session_end_hook():
    """Test 3.4: Session end hook unregisters session"""
    print("Test 3.4: Session end hook...")
    
    input_data = {
        "session_id": "test-session-end",
        "reason": "prompt_input_exit"
    }
    
    returncode, stdout, stderr = run_hook_with_input("telegram_session_end", input_data)
    
    assert returncode == 0, f"Hook should exit 0, got {returncode}. Stderr: {stderr}"
    print("  ✅ Session end hook executed successfully")
    return True


def test_hook_syntax():
    """Test 3.5: All hook scripts have valid Python syntax"""
    print("Test 3.5: Hook syntax check...")
    
    hooks = [
        "telegram_notify.py",
        "telegram_stop.py",
        "telegram_pre_tool.py",
        "telegram_session_start.py",
        "telegram_session_end.py",
        "telegram_subagent_stop.py",
    ]
    
    for hook in hooks:
        hook_path = os.path.join(HOOKS_DIR, hook)
        if os.path.exists(hook_path):
            result = subprocess.run(
                [sys.executable, "-m", "py_compile", hook_path],
                capture_output=True
            )
            assert result.returncode == 0, f"Syntax error in {hook}: {result.stderr.decode()}"
    
    print("  ✅ All hook scripts have valid syntax")
    return True


def test_stop_hook_prevents_loop():
    """Test 3.6: Stop hook respects stop_hook_active flag"""
    print("Test 3.6: Stop hook loop prevention...")
    
    input_data = {
        "session_id": "test-session-stop",
        "stop_hook_active": True  # Should exit immediately
    }
    
    returncode, stdout, stderr = run_hook_with_input("telegram_stop", input_data)
    
    assert returncode == 0, f"Hook should exit 0 when stop_hook_active=True"
    
    # Should NOT output any blocking JSON
    if stdout.strip():
        try:
            output = json.loads(stdout)
            assert "decision" not in output or output.get("decision") != "block", \
                "Should not block when stop_hook_active=True"
        except json.JSONDecodeError:
            pass  # Empty or non-JSON output is fine
    
    print("  ✅ Stop hook respects stop_hook_active flag")
    return True


def run_all_tests():
    print("\n" + "="*50)
    print("MILESTONE 3: Hook Scripts")
    print("="*50 + "\n")
    
    tests = [
        test_bridge_client_library,
        test_hook_syntax,
        test_notify_hook,
        test_session_start_hook,
        test_session_end_hook,
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
