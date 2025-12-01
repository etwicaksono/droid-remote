# Image Support Implementation Plan

**Date:** 2025-12-01  
**Branch:** To be created after mobile view completion  
**Goal:** Add image upload support with URL-based delivery to droid exec

**Status:** ✅ Confirmed working - User tested image URLs with droid exec successfully

---

## 1. Overview

After user testing, **droid exec supports image URLs** when using vision-capable models. This plan outlines adding image upload functionality to the web UI, with local hosting for simplicity.

---

## 2. Confirmed Working

**User Test Result:**
```
✅ Sending image URLs to droid exec works
✅ Vision models can process images
✅ No special flags needed in droid exec
```

**Example that works:**
```bash
droid exec "Analyze this screenshot: https://example.com/image.png" --model gpt-5-2025-08-07
```

---

## 3. Architecture Choice

**Selected: Local Flask Hosting (Option 2)**

**Reasons:**
- ✅ Self-contained - no external dependencies
- ✅ Works on local network (already required)
- ✅ No API keys or cloud accounts needed
- ✅ Simple to implement
- ✅ User controls data (privacy)

**Future upgrade path to Cloudinary available**

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Web UI                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. User selects image (file input / drag & drop)      │
│     ↓                                                   │
│  2. Frontend uploads via POST /api/upload-image         │
│     ↓                                                   │
│  3. Backend saves to /uploads/session-{id}-{hash}.png  │
│     ↓                                                   │
│  4. Backend returns: { url: "/uploads/..." }           │
│     ↓                                                   │
│  5. Frontend shows preview                              │
│     ↓                                                   │
│  6. User sends message with image URL                   │
│     ↓                                                   │
│  7. Backend executes:                                   │
│     droid exec "prompt\nImage: http://host/uploads/..." │
│     ↓                                                   │
│  8. Droid processes image with vision model             │
│     ↓                                                   │
│  9. Response displayed in chat                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. File Structure

```
droid-remote/
├── telegram-bridge/
│   ├── uploads/                          # New directory
│   │   ├── .gitignore                    # Ignore all uploads
│   │   └── session-abc123-img1.png       # Uploaded images
│   │
│   ├── api/
│   │   ├── routes.py                     # Add upload & static endpoints
│   │   └── image_handler.py              # New: Image processing utils
│   │
│   ├── core/
│   │   └── task_executor.py              # Update to include image URLs
│   │
│   └── web/src/
│       ├── components/sessions/
│       │   └── session-card.tsx          # Add image upload UI
│       │
│       ├── components/ui/
│       │   ├── image-upload.tsx          # New: Upload component
│       │   └── image-preview.tsx         # New: Preview component
│       │
│       └── lib/
│           └── api.ts                    # Add uploadImage function
│
└── docs/
    └── 04-image-support-plan.md          # This document
```

---

## 6. Implementation Steps

### Step 1: Backend - Upload Directory Setup

**Create uploads directory:**
```bash
mkdir telegram-bridge/uploads
echo "*" > telegram-bridge/uploads/.gitignore
echo "!.gitignore" >> telegram-bridge/uploads/.gitignore
```

**Purpose:** Store uploaded images (excluded from git)

---

### Step 2: Backend - Image Upload Endpoint

**File:** `telegram-bridge/api/image_handler.py`

**Create new utility module:**
```python
import os
import hashlib
import uuid
from pathlib import Path
from datetime import datetime
from werkzeug.utils import secure_filename

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_filename(session_id, original_filename):
    """Generate unique filename: session-{id}-{timestamp}-{hash}.{ext}"""
    ext = original_filename.rsplit('.', 1)[1].lower()
    timestamp = int(datetime.now().timestamp())
    hash_str = hashlib.md5(f"{session_id}{timestamp}{uuid.uuid4()}".encode()).hexdigest()[:8]
    return f"session-{session_id}-{timestamp}-{hash_str}.{ext}"

def save_upload(file, session_id):
    """Save uploaded file and return filename"""
    if not file or file.filename == '':
        raise ValueError("No file provided")
    
    if not allowed_file(file.filename):
        raise ValueError(f"File type not allowed. Allowed: {ALLOWED_EXTENSIONS}")
    
    # Check file size
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    
    if size > MAX_FILE_SIZE:
        raise ValueError(f"File too large. Max size: {MAX_FILE_SIZE // 1024 // 1024}MB")
    
    # Generate filename and save
    filename = generate_filename(session_id, secure_filename(file.filename))
    filepath = UPLOAD_DIR / filename
    
    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(exist_ok=True)
    
    file.save(filepath)
    return filename

def cleanup_old_images(max_age_hours=24):
    """Delete images older than max_age_hours"""
    import time
    now = time.time()
    cutoff = now - (max_age_hours * 3600)
    
    for filepath in UPLOAD_DIR.glob("session-*"):
        if filepath.stat().st_mtime < cutoff:
            filepath.unlink()
            print(f"Deleted old image: {filepath.name}")
```

---

### Step 3: Backend - API Routes

**File:** `telegram-bridge/api/routes.py`

**Add new endpoints:**
```python
from flask import request, jsonify, send_from_directory
from .image_handler import save_upload, cleanup_old_images, UPLOAD_DIR

# Add after existing routes

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """Upload image and return URL"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        session_id = request.form.get('session_id', 'unknown')
        
        filename = save_upload(file, session_id)
        
        # Return URL (client will prepend host)
        return jsonify({
            'success': True,
            'filename': filename,
            'url': f'/uploads/{filename}'
        })
    
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'error': 'Upload failed'}), 500

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """Serve uploaded images"""
    return send_from_directory(UPLOAD_DIR, filename)

@app.route('/api/cleanup-images', methods=['POST'])
def cleanup_images():
    """Cleanup old images (called by cron or manually)"""
    try:
        max_age = request.json.get('max_age_hours', 24)
        cleanup_old_images(max_age)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

---

### Step 4: Backend - Task Executor Integration

**File:** `telegram-bridge/core/task_executor.py`

**Update execute_task to handle images:**
```python
async def execute_task(
    prompt: str, 
    model: str = "gpt-5-codex",
    reasoning_effort: str = "medium",
    images: list[str] = None,  # New parameter
    session_id: str = None
):
    """Execute task with droid exec, optionally including images"""
    
    # Build prompt with images
    full_prompt = prompt
    if images:
        # Get base URL from config or environment
        base_url = os.getenv('BASE_URL', 'http://localhost:5000')
        
        # Append image URLs to prompt
        full_prompt += "\n\nImages:"
        for img_url in images:
            # Convert relative URL to absolute
            if img_url.startswith('/uploads/'):
                img_url = f"{base_url}{img_url}"
            full_prompt += f"\n{img_url}"
    
    # Rest of existing code...
    cmd = [
        "droid", "exec",
        "-m", model,
        "-r", reasoning_effort,
        "-o", "json",
        full_prompt
    ]
    
    # Execute command...
```

---

### Step 5: Backend - Task Execution API Update

**File:** `telegram-bridge/api/routes.py`

**Update /api/tasks/execute endpoint:**
```python
@app.route('/api/tasks/execute', methods=['POST'])
def execute_task_endpoint():
    data = request.json
    prompt = data.get('prompt')
    model = data.get('model', 'gpt-5-codex')
    reasoning_effort = data.get('reasoning_effort', 'medium')
    images = data.get('images', [])  # New: Array of image URLs
    
    if not prompt:
        return jsonify({'error': 'Prompt required'}), 400
    
    result = asyncio.run(task_executor.execute_task(
        prompt=prompt,
        model=model,
        reasoning_effort=reasoning_effort,
        images=images  # Pass images
    ))
    
    return jsonify(result)
```

---

### Step 6: Frontend - API Client

**File:** `web/src/lib/api.ts`

**Add upload function:**
```typescript
export async function uploadImage(
  file: File, 
  sessionId: string
): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('session_id', sessionId);
  
  const response = await fetch(`${API_BASE_URL}/upload-image`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }
  
  return response.json();
}

// Update executeTask to accept images
export async function executeTask(
  prompt: string,
  model: string,
  reasoningEffort: string,
  images?: string[]  // New parameter
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/tasks/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      prompt, 
      model, 
      reasoning_effort: reasoningEffort,
      images  // Include images
    }),
  });
  
  if (!response.ok) throw new Error('Task execution failed');
  return response.json();
}
```

---

### Step 7: Frontend - Image Upload Component

**File:** `web/src/components/ui/image-upload.tsx`

**Create reusable upload component:**
```typescript
'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from './button';

interface ImageUploadProps {
  onUpload: (file: File) => void;
  onRemove?: () => void;
  preview?: string;
  maxSize?: number; // MB
}

export function ImageUpload({ 
  onUpload, 
  onRemove, 
  preview,
  maxSize = 10 
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };
  
  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    
    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File too large. Max size: ${maxSize}MB`);
      return;
    }
    
    onUpload(file);
  };
  
  const handleClick = () => {
    inputRef.current?.click();
  };
  
  return (
    <div className="relative">
      {preview ? (
        // Preview mode
        <div className="relative inline-block">
          <img 
            src={preview} 
            alt="Upload preview" 
            className="max-h-32 rounded border border-gray-700"
          />
          {onRemove && (
            <button
              onClick={onRemove}
              className="absolute top-1 right-1 p-1 bg-black/60 rounded-full hover:bg-black/80"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          )}
        </div>
      ) : (
        // Upload mode
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
            transition-colors
            ${dragActive 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-gray-700 hover:border-gray-600'
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
          />
          
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-500" />
          <p className="text-sm text-gray-400">
            Drag & drop or click to upload
          </p>
          <p className="text-xs text-gray-600 mt-1">
            PNG, JPG, GIF up to {maxSize}MB
          </p>
        </div>
      )}
    </div>
  );
}
```

---

### Step 8: Frontend - Session Card Integration

**File:** `web/src/components/sessions/session-card.tsx`

**Add image upload to session card:**
```typescript
import { ImageUpload } from '@/components/ui/image-upload';
import { uploadImage } from '@/lib/api';

export function SessionCard({ session }: SessionCardProps) {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const { url } = await uploadImage(file, session.session_id);
      
      // Store full URL with host
      const fullUrl = `${window.location.origin}${url}`;
      setUploadedImages([...uploadedImages, fullUrl]);
      
      toast.success('Image uploaded');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploadingImage(false);
    }
  };
  
  const handleRemoveImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };
  
  const handleSendMessage = async () => {
    // ... existing code ...
    
    await executeTask(
      message,
      selectedModel,
      thinkingMode,
      uploadedImages  // Pass images
    );
    
    // Clear images after sending
    setUploadedImages([]);
  };
  
  return (
    <Card>
      {/* ... existing code ... */}
      
      {isRemoteControlled && (
        <div className="space-y-3">
          {/* Model selector */}
          {/* ... existing code ... */}
          
          {/* Image upload section */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Attach Images (Optional)</Label>
            
            {/* Upload previews */}
            {uploadedImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedImages.map((url, index) => (
                  <div key={index} className="relative">
                    <img 
                      src={url} 
                      alt={`Upload ${index + 1}`}
                      className="h-20 w-20 object-cover rounded border border-gray-700"
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Upload button */}
            {uploadedImages.length < 5 && (
              <ImageUpload
                onUpload={handleImageUpload}
                maxSize={10}
              />
            )}
            
            {uploadingImage && (
              <p className="text-xs text-gray-500">Uploading...</p>
            )}
          </div>
          
          {/* Text input */}
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message..."
          />
          
          {/* Send button */}
          <Button onClick={handleSendMessage}>
            Send
          </Button>
        </div>
      )}
    </Card>
  );
}
```

---

### Step 9: Frontend - Compact Image Attachment (Alternative)

**Option B: Paperclip button instead of drag & drop**

```typescript
// Simpler UI - just a button next to text input

<div className="flex items-end gap-2">
  {/* Image attachment button */}
  <button
    onClick={() => inputRef.current?.click()}
    className="p-2 rounded hover:bg-gray-800"
    title="Attach image"
  >
    <Paperclip className="h-5 w-5" />
  </button>
  
  <input
    ref={inputRef}
    type="file"
    accept="image/*"
    onChange={handleImageUpload}
    className="hidden"
  />
  
  {/* Text input */}
  <Textarea value={message} onChange={...} />
  
  {/* Send button */}
  <Button onClick={handleSend}>→</Button>
</div>

{/* Show thumbnails below */}
{uploadedImages.length > 0 && (
  <div className="flex gap-2 mt-2">
    {uploadedImages.map((url, i) => (
      <div key={i} className="relative group">
        <img src={url} className="h-16 w-16 object-cover rounded" />
        <button 
          onClick={() => removeImage(i)}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ))}
  </div>
)}
```

---

### Step 10: Database Schema Update (Optional)

**If you want to track uploaded images:**

**File:** `telegram-bridge/core/database.py`

```python
# Add new table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS uploaded_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_in_task_id INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id),
        FOREIGN KEY (used_in_task_id) REFERENCES tasks(id)
    )
""")
```

**Benefit:** Track which images were uploaded, cleanup unused images, show image history

---

### Step 11: Environment Configuration

**File:** `telegram-bridge/.env` (or config)

```bash
# Base URL for image serving (used in task_executor.py)
BASE_URL=http://localhost:5000

# Or for network access:
# BASE_URL=http://192.168.1.100:5000

# Upload settings
MAX_UPLOAD_SIZE_MB=10
UPLOAD_CLEANUP_HOURS=24
```

---

### Step 12: Vision Model Selection

**Update model list to indicate vision support:**

**File:** `web/src/components/sessions/session-card.tsx`

```typescript
const MODELS = [
  { id: 'gpt-5-2025-08-07', name: 'GPT-5', vision: true },
  { id: 'gpt-5-codex', name: 'GPT-5 Codex', vision: false },
  { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', vision: true },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', vision: true },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', vision: true },
];

// Show warning if images attached but model doesn't support vision
{uploadedImages.length > 0 && !selectedModel.vision && (
  <p className="text-xs text-yellow-500">
    ⚠️ Selected model may not support images
  </p>
)}
```

---

## 7. UI Design Options

### Option A: Drag & Drop Zone

```
┌────────────────────────────────────────────┐
│ 📎 Attach Images (Optional)                │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  📷                                   │ │
│  │  Drag & drop or click to upload      │ │
│  │  PNG, JPG, GIF up to 10MB            │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  [Thumbnail 1] [Thumbnail 2] [Thumbnail 3]│
│                                            │
│  [Model ▼] Message...              [→]    │
│                                            │
└────────────────────────────────────────────┘
```

### Option B: Paperclip Button (Compact)

```
┌────────────────────────────────────────────┐
│                                            │
│  [📎] [Model ▼] Message...          [→]   │
│   ↑                                        │
│  Click                                     │
│                                            │
│  [img1.png ×] [img2.jpg ×]                │
│   ↑ Thumbnails appear after upload        │
│                                            │
└────────────────────────────────────────────┘
```

**Recommendation:** Option B (paperclip) for mobile-friendly UI

---

## 8. Testing Checklist

**Backend:**
- [ ] Upload endpoint accepts images
- [ ] Validates file types (png, jpg, gif, etc.)
- [ ] Validates file size (< 10MB)
- [ ] Generates unique filenames
- [ ] Saves to /uploads directory
- [ ] Returns correct URL
- [ ] Static file serving works
- [ ] Cleanup removes old images
- [ ] Error handling for invalid uploads

**Frontend:**
- [ ] File input accepts images
- [ ] Drag & drop works (if implemented)
- [ ] Upload progress indicator
- [ ] Preview shows uploaded images
- [ ] Can remove images before sending
- [ ] Multiple images supported (up to 5)
- [ ] Images included in task execution
- [ ] Error messages for upload failures
- [ ] Mobile responsive upload UI

**Integration:**
- [ ] Images sent to droid exec correctly
- [ ] Vision models process images
- [ ] Non-vision models ignore images gracefully
- [ ] Image URLs accessible from droid exec process
- [ ] Chat displays results correctly
- [ ] Images cleared after sending

**Edge Cases:**
- [ ] Upload while offline → error message
- [ ] Upload huge file → rejected
- [ ] Upload non-image → rejected
- [ ] Send without model selected → validation
- [ ] Multiple rapid uploads → queued correctly
- [ ] Session ends → images cleaned up

---

## 9. Future Enhancements

### Phase 2: Cloud Storage (Cloudinary)

**When local storage becomes limiting:**

```python
# telegram-bridge/core/cloudinary_handler.py
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key = os.getenv('CLOUDINARY_API_KEY'),
    api_secret = os.getenv('CLOUDINARY_API_SECRET')
)

def upload_to_cloudinary(file):
    result = cloudinary.uploader.upload(
        file,
        folder="droid-remote",
        resource_type="image"
    )
    return result['secure_url']
```

**Benefits:**
- No local storage needed
- Automatic CDN delivery
- Image transformations
- 25GB free tier

### Phase 3: Advanced Features

**Image History:**
- Show all images used in session
- Reuse previously uploaded images
- Download/export images

**Image Editing:**
- Basic crop/resize before upload
- Annotation tools (draw, text)
- Screenshot capture from browser

**Batch Upload:**
- Multiple images at once
- ZIP file extraction
- Folder upload

**Smart Features:**
- Auto-detect vision models
- Image optimization (compress before upload)
- OCR preview (show text extracted from image)
- Image tagging/labeling

---

## 10. Security Considerations

**File Type Validation:**
```python
# Use python-magic for real file type detection
import magic

def validate_file_type(filepath):
    mime = magic.from_file(filepath, mime=True)
    return mime in ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
```

**Filename Sanitization:**
```python
# Use werkzeug.utils.secure_filename
from werkzeug.utils import secure_filename
safe_name = secure_filename(user_filename)
```

**Access Control:**
```python
# Only allow access to images from same session
@app.route('/uploads/<filename>')
def serve_upload(filename):
    # Extract session_id from filename
    session_id = filename.split('-')[1]
    
    # Verify user has access to this session
    if not has_access(current_user, session_id):
        abort(403)
    
    return send_from_directory(UPLOAD_DIR, filename)
```

**Rate Limiting:**
```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=get_remote_address)

@app.route('/api/upload-image', methods=['POST'])
@limiter.limit("10 per minute")  # Max 10 uploads per minute
def upload_image():
    # ...
```

---

## 11. Error Handling

**Common Errors:**

```typescript
// Frontend error messages
const ERROR_MESSAGES = {
  FILE_TOO_LARGE: 'Image too large. Maximum size is 10MB',
  INVALID_TYPE: 'Invalid file type. Please upload PNG, JPG, or GIF',
  UPLOAD_FAILED: 'Upload failed. Please try again',
  NETWORK_ERROR: 'Network error. Check your connection',
  NO_VISION_MODEL: 'Selected model does not support images',
};

// Show user-friendly error
try {
  await uploadImage(file, sessionId);
} catch (error) {
  if (error.message.includes('too large')) {
    toast.error(ERROR_MESSAGES.FILE_TOO_LARGE);
  } else if (error.message.includes('type')) {
    toast.error(ERROR_MESSAGES.INVALID_TYPE);
  } else {
    toast.error(ERROR_MESSAGES.UPLOAD_FAILED);
  }
}
```

---

## 12. Documentation Updates

**User Guide:**
```markdown
## Sending Images

1. Click the 📎 paperclip icon next to the message input
2. Select an image (PNG, JPG, GIF up to 10MB)
3. Preview appears below
4. Type your message
5. Click Send

**Vision Models:**
- ✅ GPT-5 (supports images)
- ✅ Claude Opus 4.1 (supports images)
- ✅ Claude Sonnet 4.5 (supports images)
- ✅ Gemini 3 Pro (supports images)
- ❌ GPT-5 Codex (text only)

**Tips:**
- Use clear, high-resolution images
- Add context in your message
- Multiple images supported (up to 5)
- Images auto-delete after 24 hours
```

---

## 13. Implementation Order

**After mobile view task completion:**

1. ✅ **Step 1-3:** Backend foundation (2 hours)
   - Upload directory
   - Image handler module
   - API endpoints

2. ✅ **Step 4-5:** Backend integration (1 hour)
   - Task executor updates
   - API endpoint updates

3. ✅ **Step 6-7:** Frontend components (2 hours)
   - API client updates
   - Image upload component

4. ✅ **Step 8-9:** UI integration (2 hours)
   - Session card integration
   - Compact paperclip UI

5. ✅ **Step 10-11:** Polish (1 hour)
   - Database schema (optional)
   - Environment config

6. ✅ **Testing:** (2 hours)
   - All checklist items
   - Mobile testing
   - Edge cases

**Total Estimate:** 10 hours (1-2 days)

---

## 14. Success Criteria

✅ Users can upload images via web UI
✅ Images display as previews before sending
✅ Images sent to droid exec with vision models
✅ Droid processes and responds to image content
✅ Mobile-friendly upload UI
✅ Error handling for all failure cases
✅ Old images cleaned up automatically
✅ Works on local network (existing setup)

---

## 15. Notes

**Confirmed Working:**
- ✅ Droid exec accepts image URLs
- ✅ Vision models process images correctly
- ✅ No special flags needed

**Approach:**
- Simple local file hosting
- No external dependencies
- Self-contained solution
- Easy upgrade path to cloud storage

**Priority:**
- Implement after mobile view tasks complete
- Focus on simple, working solution first
- Add advanced features later

---

**Ready for implementation after mobile view completion!** 🎉
