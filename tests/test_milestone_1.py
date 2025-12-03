"""
Milestone 1 Tests: Telegram Bot Setup
"""
import os
import sys
import asyncio

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8')

# Load .env from telegram-bridge directory
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'telegram-bridge', '.env'))

from telegram import Bot, BotCommand
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
    
    if not BOT_TOKEN:
        print("❌ TELEGRAM_BOT_TOKEN not set in .env")
        return False
    
    if not CHAT_ID:
        print("❌ TELEGRAM_CHAT_ID not set in .env")
        return False
    
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
