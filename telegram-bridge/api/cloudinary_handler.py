"""
Cloudinary Image Upload Handler

Handles image uploads to Cloudinary cloud storage.
Returns public URLs that can be accessed by droid exec.
"""
import os
import re
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
MAX_FILE_SIZE = int(os.getenv('MAX_UPLOAD_SIZE_MB', '10')) * 1024 * 1024


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
        safe_filename = secure_filename(filename)
        
        result = cloudinary.uploader.upload(
            io.BytesIO(content),
            folder="droid-remote",
            public_id=f"session-{session_id}-{safe_filename}",
            resource_type="image",
            overwrite=False,
            unique_filename=True,
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


# Initialize on module load
configure_cloudinary()
