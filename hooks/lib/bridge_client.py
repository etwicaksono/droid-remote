"""
Bridge Client - Used by hook scripts to communicate with bridge server
"""
import os
import json
import urllib.request
import urllib.error
import urllib.parse
import logging
from typing import Optional, Dict, Any, List

# Import config - try relative first, then absolute
try:
    from .config import BRIDGE_URL, BRIDGE_SECRET, NOTIFY_TIMEOUT
except ImportError:
    from config import BRIDGE_URL, BRIDGE_SECRET, NOTIFY_TIMEOUT

logger = logging.getLogger(__name__)


class BridgeClientError(Exception):
    """Exception raised when bridge client fails"""
    pass


def _make_request(
    method: str,
    endpoint: str,
    data: Optional[Dict[str, Any]] = None,
    timeout: int = 10
) -> Dict[str, Any]:
    """Make HTTP request to bridge server with retry logic"""
    url = f"{BRIDGE_URL}{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "X-Bridge-Secret": BRIDGE_SECRET
    }
    
    body = json.dumps(data).encode("utf-8") if data else None
    
    req = urllib.request.Request(
        url,
        data=body,
        headers=headers,
        method=method
    )
    
    max_retries = 3
    last_error = None
    
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                response_data = response.read().decode("utf-8")
                if response_data:
                    return json.loads(response_data)
                return {"success": True}
        except urllib.error.HTTPError as e:
            last_error = f"HTTP {e.code}: {e.reason}"
            if e.code < 500:
                break  # Don't retry client errors
        except urllib.error.URLError as e:
            last_error = str(e.reason)
        except json.JSONDecodeError as e:
            last_error = f"Invalid JSON response: {e}"
            break
        except Exception as e:
            last_error = str(e)
        
        # Exponential backoff
        if attempt < max_retries - 1:
            import time
            time.sleep(0.5 * (2 ** attempt))
    
    logger.error(f"Bridge request failed: {last_error}")
    return {"error": last_error, "success": False}


def register_session(
    session_id: str,
    project_dir: str,
    session_name: Optional[str] = None
) -> bool:
    """Register or update a Droid session"""
    import os
    
    if not session_name:
        session_name = os.path.basename(project_dir)
    
    result = _make_request("POST", "/sessions/register", {
        "session_id": session_id,
        "project_dir": project_dir,
        "session_name": session_name
    })
    return result.get("success", False)


def update_session_status(session_id: str, status: str) -> bool:
    """Update session status"""
    result = _make_request("PATCH", f"/sessions/{session_id}", {
        "status": status
    })
    return result.get("success", False)


def notify(
    session_id: str,
    session_name: str,
    message: str,
    notification_type: str = "info",
    buttons: Optional[List[Dict[str, str]]] = None,
    tool_name: Optional[str] = None,
    tool_input: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Send notification to Telegram. Returns dict with success and request_id."""
    data = {
        "session_name": session_name,
        "message": message,
        "type": notification_type,
        "buttons": buttons or []
    }
    if tool_name:
        data["tool_name"] = tool_name
    if tool_input:
        data["tool_input"] = tool_input
    
    result = _make_request(
        "POST",
        f"/sessions/{session_id}/notify",
        data,
        timeout=NOTIFY_TIMEOUT
    )
    return result  # Returns {"success": bool, "request_id": str}


def wait_for_response(
    session_id: str,
    request_id: str,
    timeout: int = 300
) -> Optional[str]:
    """Wait for user response from Telegram (blocking)"""
    result = _make_request(
        "POST",
        f"/sessions/{session_id}/wait",
        {
            "request_id": request_id,
            "timeout": timeout
        },
        timeout=timeout + 5  # Add buffer for network latency
    )
    
    if result.get("error") or result.get("timeout"):
        return None
    return result.get("response")


def get_pending_response(session_id: str, request_id: str) -> Optional[str]:
    """Check for pending response without blocking"""
    result = _make_request(
        "GET",
        f"/sessions/{session_id}/response/{request_id}",
        timeout=5
    )
    
    if result.get("error") or not result.get("has_response"):
        return None
    return result.get("response")


def unregister_session(session_id: str) -> bool:
    """Remove session from registry"""
    result = _make_request("DELETE", f"/sessions/{session_id}")
    return result.get("success", False)


def check_bridge_health() -> bool:
    """Check if bridge server is healthy"""
    result = _make_request("GET", "/health", timeout=5)
    return result.get("status") == "healthy"


def add_chat_message(
    session_id: str,
    msg_type: str,  # 'user' or 'assistant'
    content: str,
    status: Optional[str] = None,
    duration_ms: Optional[int] = None,
    num_turns: Optional[int] = None,
    source: str = 'cli'
) -> bool:
    """Add a chat message to the database"""
    params = {
        "msg_type": msg_type,
        "content": content,
        "source": source
    }
    if status:
        params["status"] = status
    if duration_ms:
        params["duration_ms"] = str(duration_ms)
    if num_turns:
        params["num_turns"] = str(num_turns)
    
    # Build query string
    query = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
    
    result = _make_request(
        "POST",
        f"/sessions/{session_id}/chat?{query}",
        timeout=10
    )
    return result.get("success", False)


def emit_cli_thinking(session_id: str, prompt: str) -> bool:
    """Notify Web UI that CLI is processing a prompt (show thinking indicator)"""
    result = _make_request(
        "POST",
        f"/sessions/{session_id}/cli-thinking",
        {"prompt": prompt},
        timeout=5
    )
    return result.get("success", False)
