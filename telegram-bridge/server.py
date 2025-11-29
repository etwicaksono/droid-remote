"""
Telegram-Droid Bridge Server
Main entry point - runs FastAPI server with Socket.IO and Telegram bot
"""
import os
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from bot.telegram_bot import TelegramBotManager
from api.routes import router
from api.socketio_handlers import create_socketio_server, create_socketio_app
from core.session_registry import session_registry
from utils.logging_config import setup_logging

# Load environment variables
load_dotenv()

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
    
    host = os.getenv("BRIDGE_HOST", "127.0.0.1")
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
