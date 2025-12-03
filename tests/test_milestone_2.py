"""
Milestone 2 Tests: Bridge Server Core
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import requests
import json

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
        "message": "🧪 Milestone 2 Test: Bridge server notification working!",
        "type": "info"
    }
    response = requests.post(
        f"{BASE_URL}/sessions/test-session-001/notify",
        json=notification,
        timeout=5
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print("  ✅ Notification accepted")
    print("  📱 CHECK TELEGRAM: You should see a test notification!")
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
