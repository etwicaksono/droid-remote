"""
Telegram-Droid Bridge Server
Main entry point - runs FastAPI server with Socket.IO and Telegram bot
"""
import os
import sys
import asyncio
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Add project root to path for config imports
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Load environment variables from project root first, then fallback to local
env_file = PROJECT_ROOT / ".env"
if env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv()  # Fallback to telegram-bridge/.env

from bot.telegram_bot import TelegramBotManager
from api.routes import router
from api.socketio_handlers import create_socketio_server, create_socketio_app
from api.auth import verify_token, verify_api_key, PUBLIC_ROUTES, log_auth_config
from core.session_registry import session_registry
from core.database import get_db, migrate_tasks_cascade_delete, migrate_chat_messages_source, migrate_session_settings_autonomy
from utils.logging_config import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Global instances
bot_manager: TelegramBotManager = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global bot_manager
    
    # Startup
    logger.info("Starting Telegram-Droid Bridge Server...")
    
    # Log auth config for debugging
    log_auth_config()
    
    # Initialize database
    try:
        db = get_db()
        logger.info(f"Database initialized at {db.db_path}")
        
        # Run migrations
        migrate_tasks_cascade_delete()
        migrate_chat_messages_source()
        migrate_session_settings_autonomy()
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
    
    # Initialize Telegram bot
    try:
        bot_manager = TelegramBotManager(session_registry)
        asyncio.create_task(bot_manager.start())
        logger.info("Telegram bot initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Telegram bot: {e}")
        bot_manager = None
    
    logger.info("Bridge server started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    if bot_manager:
        await bot_manager.stop()
    
    # Close database connections
    try:
        db = get_db()
        db.close_all()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error closing database: {e}")
    
    logger.info("Bridge server stopped")


# Create FastAPI app
app = FastAPI(
    title="Telegram-Droid Bridge",
    description="Bridge server for controlling Factory.ai Droid via Telegram",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Auth middleware
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Check authentication for protected routes"""
    path = request.url.path
    method = request.method
    
    # Allow CORS preflight requests (OPTIONS)
    if method == "OPTIONS":
        return await call_next(request)
    
    # Allow public routes
    if any(path.startswith(route) for route in PUBLIC_ROUTES):
        return await call_next(request)
    
    # Allow root endpoint
    if path == "/":
        return await call_next(request)
    
    # Allow socket.io paths
    if path.startswith("/socket.io"):
        return await call_next(request)
    
    # Check for API key (used by hooks)
    api_key = request.headers.get("X-API-Key") or request.headers.get("X-Bridge-Secret")
    if api_key and verify_api_key(api_key):
        return await call_next(request)
    
    # Check for Bearer token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        if verify_token(token):
            return await call_next(request)
    
    # Check for token in query params (for some clients)
    token = request.query_params.get("token")
    if token and verify_token(token):
        return await call_next(request)
    
    # Not authenticated
    return JSONResponse(
        status_code=401,
        content={"detail": "Not authenticated"}
    )


# Include API routes
app.include_router(router)

# Create Socket.IO server
sio = create_socketio_server()
app.state.sio = sio

# Make bot_manager available to routes
app.state.bot_manager = lambda: bot_manager
app.state.session_registry = session_registry

# Create combined ASGI app
combined_app = create_socketio_app(sio, app)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Telegram-Droid Bridge",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "sessions": "/sessions",
            "docs": "/docs"
        }
    }


def main():
    """Main entry point"""
    import uvicorn
    
    host = os.getenv("BRIDGE_HOST", "0.0.0.0")
    port = int(os.getenv("BRIDGE_PORT", "8765"))
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        combined_app,
        host=host,
        port=port,
        log_level="info"
    )


if __name__ == "__main__":
    main()
