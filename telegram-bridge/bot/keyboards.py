"""
Inline keyboard builders for Telegram bot
"""
from typing import List, Optional
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from core.models import Button


def build_inline_keyboard(
    buttons: List[Button],
    session_id: str,
    request_id: Optional[str] = None
) -> InlineKeyboardMarkup:
    """
    Build an inline keyboard from a list of buttons.
    Callback data format: {action}:{session_id}:{request_id}
    """
    keyboard_buttons = []
    row = []
    
    for button in buttons:
        callback_data = f"{button.callback}:{session_id}"
        if request_id:
            callback_data += f":{request_id}"
        
        row.append(InlineKeyboardButton(
            text=button.text,
            callback_data=callback_data[:64]  # Telegram limit
        ))
        
        # Max 3 buttons per row
        if len(row) >= 3:
            keyboard_buttons.append(row)
            row = []
    
    if row:
        keyboard_buttons.append(row)
    
    return InlineKeyboardMarkup(keyboard_buttons)


def build_permission_keyboard(
    session_id: str,
    request_id: str
) -> InlineKeyboardMarkup:
    """Build standard permission request keyboard"""
    # Use short IDs to fit within 64-byte callback_data limit
    sid = session_id[:8] if len(session_id) > 8 else session_id
    rid = request_id[:8] if len(request_id) > 8 else request_id
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("Approve", callback_data=f"approve:{sid}:{rid}"),
            InlineKeyboardButton("Deny", callback_data=f"deny:{sid}:{rid}")
        ],
        [
            InlineKeyboardButton("Approve All", callback_data=f"approve_all:{sid}:{rid}")
        ]
    ])


def build_stop_keyboard(
    session_id: str,
    request_id: str
) -> InlineKeyboardMarkup:
    """Build keyboard for stop notification"""
    # Use short IDs to fit within 64-byte callback_data limit
    sid = session_id[:8] if len(session_id) > 8 else session_id
    rid = request_id[:8] if len(request_id) > 8 else request_id
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("Done", callback_data=f"done:{sid}:{rid}"),
            InlineKeyboardButton("Status", callback_data=f"status:{sid}:{rid}")
        ]
    ])


def build_session_keyboard(sessions: list) -> InlineKeyboardMarkup:
    """Build keyboard for session selection"""
    buttons = []
    
    for i, session in enumerate(sessions[:10], 1):  # Limit to 10 sessions
        status_emoji = {
            "running": "🟡",
            "waiting": "🟢",
            "stopped": "🔴"
        }.get(session.status, "⚪")
        
        buttons.append([
            InlineKeyboardButton(
                f"{status_emoji} {session.name}",
                callback_data=f"select:{session.id}"
            )
        ])
    
    return InlineKeyboardMarkup(buttons)


def build_confirm_keyboard(
    action: str,
    session_id: str
) -> InlineKeyboardMarkup:
    """Build confirmation keyboard"""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Confirm", callback_data=f"confirm_{action}:{session_id}"),
            InlineKeyboardButton("❌ Cancel", callback_data=f"cancel_{action}:{session_id}")
        ]
    ])
