"""
Cloudinary Image Upload Handler

Handles image uploads to Cloudinary cloud storage and local reference files.
- Cloudinary URLs for chat history display
- Local files for droid exec vision processing
"""
import os
import re
import logging
import time
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
MAX_FILE_SIZE = int(os.getenv('MAX_UPLOAD_SIZE_MB', '10')) * 1024 * 1024

# Reference directory for local image files (relative to project_dir)
REFERENCE_DIR = "reference"


def configure_cloudinary() -> bool:
    """Configure Cloudinary with credentials from environment"""
    try:
        import cloudinary
        
        cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
        api_key = os.getenv('CLOUDINARY_API_KEY')
        api_secret = os.getenv('CLOUDINARY_API_SECRET')
        
        if not all([cloud_name, api_key, api_secret]):
            logger.warning("Cloudinary credentials not configured")
            return False
        
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
        
        logger.info(f"Cloudinary configured: {cloud_name}")
        return True
    except ImportError:
        logger.error("cloudinary package not installed")
        return False
    except Exception as e:
        logger.error(f"Failed to configure Cloudinary: {e}")
        return False


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    if not filename or '.' not in filename:
        return False
    return filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def secure_filename(filename: str) -> str:
    """Sanitize filename for safe storage"""
    filename = os.path.basename(filename)
    filename = filename.replace(' ', '_')
    filename = re.sub(r'[^\w\.-]', '', filename)
    return filename


def validate_file(content: bytes, filename: str) -> Optional[str]:
    """Validate file before upload. Returns error message or None if valid."""
    if not content:
        return "No file content"
    
    if not allowed_file(filename):
        return f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
    
    if len(content) > MAX_FILE_SIZE:
        max_mb = MAX_FILE_SIZE // 1024 // 1024
        return f"File too large. Max size: {max_mb}MB"
    
    return None


def upload_to_cloudinary(content: bytes, filename: str, session_id: str) -> Dict[str, Any]:
    """
    Upload file to Cloudinary and return public URL
    
    Args:
        content: File bytes
        filename: Original filename
        session_id: Session ID for organizing uploads
        
    Returns:
        dict with url, public_id, width, height, format, size
        
    Raises:
        ValueError: If file is invalid or upload fails
    """
    try:
        import cloudinary.uploader
    except ImportError:
        raise ValueError("Cloudinary package not installed")
    
    error = validate_file(content, filename)
    if error:
        raise ValueError(error)
    
    try:
        import io
        import time
        from datetime import datetime
        
        safe_filename = secure_filename(filename)
        
        # Remove extension from filename (Cloudinary adds it automatically)
        name_without_ext = safe_filename.rsplit('.', 1)[0] if '.' in safe_filename else safe_filename
        
        # Add timestamp to ensure unique public_id for each upload
        timestamp = int(time.time() * 1000)
        unique_id = f"session-{session_id}-{name_without_ext}-{timestamp}"
        
        # Organize by date (YYYY-MM-DD)
        date_folder = datetime.now().strftime('%Y-%m-%d')
        
        result = cloudinary.uploader.upload(
            io.BytesIO(content),
            folder=f"droid-remote/{date_folder}",
            public_id=unique_id,
            resource_type="image",
            overwrite=True,  # Allow overwrite since we have unique timestamp
        )
        
        logger.info(f"Uploaded to Cloudinary: {result['secure_url']}")
        
        return {
            'url': result['secure_url'],
            'public_id': result['public_id'],
            'width': result.get('width'),
            'height': result.get('height'),
            'format': result.get('format'),
            'size': result.get('bytes')
        }
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        raise ValueError(f"Upload failed: {str(e)}")


def delete_from_cloudinary(public_id: str) -> bool:
    """Delete image from Cloudinary by public_id"""
    try:
        import cloudinary.uploader
        
        result = cloudinary.uploader.destroy(public_id, resource_type="image")
        success = result.get('result') == 'ok'
        
        if success:
            logger.info(f"Deleted from Cloudinary: {public_id}")
        else:
            logger.warning(f"Failed to delete: {public_id}")
        
        return success
    except Exception as e:
        logger.error(f"Error deleting {public_id}: {e}")
        return False


def save_image_record(session_id: str, public_id: str, url: str) -> bool:
    """Save image record to database for tracking"""
    try:
        from core.database import get_db
        db = get_db()
        
        # Check if session exists (foreign key constraint)
        cursor = db.execute("SELECT 1 FROM sessions WHERE id = ?", (session_id,))
        if not cursor.fetchone():
            logger.debug(f"Session {session_id} not found, skipping image record")
            return False
        
        db.execute(
            "INSERT INTO session_images (session_id, public_id, url) VALUES (?, ?, ?)",
            (session_id, public_id, url)
        )
        db.commit()
        logger.info(f"Saved image record: {public_id} for session {session_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to save image record: {e}")
        return False


def get_session_images(session_id: str) -> list:
    """Get all images for a session"""
    try:
        from core.database import get_db
        db = get_db()
        cursor = db.execute(
            "SELECT public_id, url FROM session_images WHERE session_id = ?",
            (session_id,)
        )
        return [{"public_id": row[0], "url": row[1]} for row in cursor.fetchall()]
    except Exception as e:
        logger.error(f"Failed to get session images: {e}")
        return []


def delete_session_images(session_id: str) -> int:
    """Delete all images for a session from Cloudinary and database"""
    images = get_session_images(session_id)
    deleted_count = 0
    
    for img in images:
        if delete_from_cloudinary(img["public_id"]):
            deleted_count += 1
    
    # Delete records from database (CASCADE will handle this, but be explicit)
    try:
        from core.database import get_db
        db = get_db()
        db.execute("DELETE FROM session_images WHERE session_id = ?", (session_id,))
        db.commit()
    except Exception as e:
        logger.error(f"Failed to delete image records: {e}")
    
    logger.info(f"Deleted {deleted_count}/{len(images)} images for session {session_id}")
    return deleted_count


def save_to_local(content: bytes, filename: str, project_dir: str) -> str:
    """
    Save image to local reference directory for droid exec.
    
    Args:
        content: File bytes
        filename: Original filename
        project_dir: Project directory path
        
    Returns:
        Relative path to saved file (e.g., ./reference/image_1234567890.png)
    """
    error = validate_file(content, filename)
    if error:
        raise ValueError(error)
    
    safe_filename = secure_filename(filename)
    
    # Add timestamp to ensure unique filename
    timestamp = int(time.time() * 1000)
    name_parts = safe_filename.rsplit('.', 1)
    if len(name_parts) == 2:
        unique_filename = f"{name_parts[0]}_{timestamp}.{name_parts[1]}"
    else:
        unique_filename = f"{safe_filename}_{timestamp}"
    
    # Create reference directory in project_dir
    ref_dir = Path(project_dir) / REFERENCE_DIR
    ref_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_path = ref_dir / unique_filename
    file_path.write_bytes(content)
    
    # Return relative path for use in prompt
    relative_path = f"./{REFERENCE_DIR}/{unique_filename}"
    logger.info(f"Saved local reference: {relative_path}")
    
    return relative_path


def cleanup_local_file(local_path: str, project_dir: str) -> bool:
    """
    Delete local reference file after task execution.
    
    Args:
        local_path: Relative path (e.g., ./reference/image.png)
        project_dir: Project directory path
        
    Returns:
        True if deleted, False otherwise
    """
    try:
        # Convert relative path to absolute
        if local_path.startswith("./"):
            local_path = local_path[2:]
        
        full_path = Path(project_dir) / local_path
        
        if full_path.exists():
            full_path.unlink()
            logger.info(f"Cleaned up local file: {full_path}")
            return True
        else:
            logger.debug(f"Local file not found: {full_path}")
            return False
    except Exception as e:
        logger.error(f"Failed to cleanup local file: {e}")
        return False


def cleanup_local_files(local_paths: List[str], project_dir: str) -> int:
    """
    Delete multiple local reference files.
    
    Returns:
        Number of files deleted
    """
    deleted = 0
    for path in local_paths:
        if cleanup_local_file(path, project_dir):
            deleted += 1
    return deleted


# Initialize on module load
configure_cloudinary()
