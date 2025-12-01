# Image Support Implementation Plan

**Date:** 2025-12-01  
**Branch:** To be created after mobile view completion  
**Goal:** Add image upload support with URL-based delivery to droid exec

**Status:** ✅ Confirmed working - User tested image URLs with droid exec successfully

---

## 1. Overview

After user testing, **droid exec supports image URLs** when using vision-capable models. This plan outlines adding image upload functionality to the web UI with Cloudinary cloud hosting.

---

## 2. Confirmed Working

**User Test Results:**
```
✅ Sending public image URLs to droid exec works perfectly
✅ Vision models process images correctly
✅ No special flags needed in droid exec
❌ Localhost URLs do NOT work (droid exec times out)
```

**Example that works:**
```bash
droid exec "Analyze this screenshot: https://example.com/image.png" --model gpt-5.1
```

**Why not localhost:**
- Testing showed droid exec **cannot access localhost URLs**
- Security restriction prevents accessing internal network
- Need public URLs accessible from internet

---

## 3. Architecture Choice

**Selected: Cloudinary (Cloud Storage)**

**Why Cloudinary:**
- ✅ Public URLs that droid exec can access (localhost blocked)
- ✅ Free tier: 25GB storage, 25GB bandwidth/month
- ✅ Reliable CDN delivery
- ✅ Automatic image optimization
- ✅ No local storage cleanup needed
- ✅ Works from any device (not just local network)
- ✅ Simple API integration

**Cloudinary Free Tier:**
- 25 GB storage
- 25 GB monthly bandwidth
- 25k transformations/month
- Perfect for this use case

---

## 4. System Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                          Web UI                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User selects image (file input / drag & drop)            │
│     ↓                                                         │
│  2. Frontend uploads via POST /api/upload-image               │
│     ↓                                                         │
│  3. Backend uploads to Cloudinary API                         │
│     POST https://api.cloudinary.com/v1_1/{cloud}/upload      │
│     ↓                                                         │
│  4. Cloudinary returns public URL:                            │
│     https://res.cloudinary.com/{cloud}/image/upload/...      │
│     ↓                                                         │
│  5. Backend saves URL to database (optional)                  │
│     ↓                                                         │
│  6. Backend returns: { url: "https://res.cloudinary..." }    │
│     ↓                                                         │
│  7. Frontend shows preview                                    │
│     ↓                                                         │
│  8. User sends message with image URL                         │
│     ↓                                                         │
│  9. Backend executes:                                         │
│     droid exec "prompt\nImage: https://res.cloudinary..."    │
│     ↓                                                         │
│  10. Droid fetches image from Cloudinary CDN                  │
│     ↓                                                         │
│  11. Vision model processes image                             │
│     ↓                                                         │
│  12. Response displayed in chat                               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. File Structure

```
droid-remote/
├── telegram-bridge/
│   ├── .env                              # Add Cloudinary credentials
│   │
│   ├── api/
│   │   ├── routes.py                     # Add /api/upload-image endpoint
│   │   └── cloudinary_handler.py         # New: Cloudinary upload utils
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
│       │   └── image-preview.tsx         # New: Preview component (optional)
│       │
│       └── lib/
│           └── api.ts                    # Add uploadImage function
│
└── docs/
    └── 04-image-support-plan.md          # This document
```

---

## 6. Implementation Steps

### Step 1: Cloudinary Account Setup

**Create Cloudinary account:**
1. Go to https://cloudinary.com/users/register_free
2. Sign up for free account
3. Get credentials from dashboard:
   - Cloud name
   - API key
   - API secret

**Add to `.env` file:**
```bash
# telegram-bridge/.env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Install Cloudinary SDK:**
```bash
cd telegram-bridge
pip install cloudinary
```

---

### Step 2: Backend - Cloudinary Handler

**File:** `telegram-bridge/api/cloudinary_handler.py`

**Create Cloudinary upload utility:**
```python
import os
import cloudinary
import cloudinary.uploader
from werkzeug.utils import secure_filename

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
    secure=True
)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def upload_to_cloudinary(file, session_id):
    """
    Upload file to Cloudinary and return public URL
    
    Args:
        file: Flask request.files object
        session_id: Session ID for organizing uploads
        
    Returns:
        dict: {
            'url': 'https://res.cloudinary.com/...',
            'public_id': 'droid-remote/session-abc123-...',
            'width': 1920,
            'height': 1080,
            'format': 'png'
        }
        
    Raises:
        ValueError: If file is invalid
    """
    # Validate file exists
    if not file or file.filename == '':
        raise ValueError("No file provided")
    
    # Validate file type
    if not allowed_file(file.filename):
        raise ValueError(f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Validate file size
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    
    if size > MAX_FILE_SIZE:
        raise ValueError(f"File too large. Max size: {MAX_FILE_SIZE // 1024 // 1024}MB")
    
    # Upload to Cloudinary
    try:
        result = cloudinary.uploader.upload(
            file,
            folder=f"droid-remote",  # Organize by folder
            public_id=f"session-{session_id}-{secure_filename(file.filename)}",
            resource_type="image",
            overwrite=False,
            unique_filename=True,  # Add unique suffix if file exists
            # Optional: Add transformations
            # transformation=[
            #     {'quality': 'auto'},  # Auto quality
            #     {'fetch_format': 'auto'}  # Auto format (WebP when supported)
            # ]
        )
        
        return {
            'url': result['secure_url'],
            'public_id': result['public_id'],
            'width': result.get('width'),
            'height': result.get('height'),
            'format': result.get('format'),
            'size': result.get('bytes')
        }
    
    except cloudinary.exceptions.Error as e:
        raise ValueError(f"Cloudinary upload failed: {str(e)}")

def delete_from_cloudinary(public_id):
    """Delete image from Cloudinary by public_id"""
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type="image")
        return result.get('result') == 'ok'
    except Exception as e:
        print(f"Failed to delete image {public_id}: {e}")
        return False
```

---

### Step 3: Backend - API Routes

**File:** `telegram-bridge/api/routes.py`

**Add upload endpoint:**
```python
from flask import request, jsonify
from .cloudinary_handler import upload_to_cloudinary, delete_from_cloudinary

# Add after existing routes

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """Upload image to Cloudinary and return public URL"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        session_id = request.form.get('session_id', 'unknown')
        
        # Upload to Cloudinary
        result = upload_to_cloudinary(file, session_id)
        
        # Return public URL and metadata
        return jsonify({
            'success': True,
            'url': result['url'],
            'public_id': result['public_id'],
            'width': result.get('width'),
            'height': result.get('height'),
            'format': result.get('format'),
            'size': result.get('size')
        })
    
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'error': 'Upload failed'}), 500

@app.route('/api/delete-image', methods=['POST'])
def delete_image():
    """Delete image from Cloudinary (optional endpoint)"""
    try:
        data = request.json
        public_id = data.get('public_id')
        
        if not public_id:
            return jsonify({'error': 'public_id required'}), 400
        
        success = delete_from_cloudinary(public_id)
        
        return jsonify({
            'success': success
        })
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
    if images and len(images) > 0:
        # Append image URLs to prompt
        # Cloudinary URLs are already full public URLs
        full_prompt += "\n\nImages:"
        for img_url in images:
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
): Promise<{
  url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
}> {
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
  
  const data = await response.json();
  return data;  // Returns Cloudinary public URL and metadata
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
      const result = await uploadImage(file, session.session_id);
      
      // Cloudinary returns full public URL
      setUploadedImages([...uploadedImages, result.url]);
      
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

**File:** `telegram-bridge/.env`

```bash
# Cloudinary Configuration (required)
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here

# Upload Settings (optional)
MAX_UPLOAD_SIZE_MB=10
```

**Get Cloudinary credentials:**
1. Login to https://cloudinary.com/console
2. Copy Cloud name, API Key, API Secret from dashboard
3. Add to `.env` file

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
- [ ] Uploads to Cloudinary successfully
- [ ] Returns public URL from Cloudinary
- [ ] Cloudinary credentials loaded from .env
- [ ] Error handling for invalid uploads
- [ ] Error handling for Cloudinary API failures

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

### Phase 2: Advanced Features

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
# Validate file extension
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Cloudinary also validates file type on their end
```

**File Size Validation:**
```python
# Check size before uploading to Cloudinary
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

file.seek(0, os.SEEK_END)
size = file.tell()
file.seek(0)

if size > MAX_FILE_SIZE:
    raise ValueError(f"File too large. Max size: 10MB")
```

**Cloudinary Security:**
- Cloudinary provides built-in access control
- Public URLs are unique and unguessable
- Can configure signed URLs for extra security
- Automatic malware scanning available
- DDoS protection via CDN

**Rate Limiting:**
```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=get_remote_address)

@app.route('/api/upload-image', methods=['POST'])
@limiter.limit("10 per minute")  # Max 10 uploads per minute
def upload_image():
    # ...
```

**Optional: Signed URLs for extra security:**
```python
# Generate signed upload URL (prevents unauthorized uploads)
cloudinary.uploader.upload(
    file,
    folder="droid-remote",
    type="authenticated",  # Requires signed URL to access
    access_mode="authenticated"
)
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

1. ✅ **Step 1:** Cloudinary account setup (15 minutes)
   - Create free account
   - Get credentials
   - Add to .env file

2. ✅ **Step 2-3:** Backend foundation (2 hours)
   - Install Cloudinary SDK
   - Cloudinary handler module
   - Upload API endpoint

3. ✅ **Step 4-5:** Backend integration (1 hour)
   - Task executor updates
   - API endpoint updates

4. ✅ **Step 6-7:** Frontend components (2 hours)
   - API client updates
   - Image upload component

5. ✅ **Step 8-9:** UI integration (2 hours)
   - Session card integration
   - Compact paperclip UI

6. ✅ **Step 10-12:** Polish (1 hour)
   - Database schema (optional)
   - Environment config
   - Vision model indicators

7. ✅ **Testing:** (1.5 hours)
   - All checklist items
   - Mobile testing
   - Edge cases

**Total Estimate:** 9.5 hours (1-2 days)

---

## 14. Success Criteria

✅ Users can upload images via web UI
✅ Images upload to Cloudinary successfully
✅ Public Cloudinary URLs returned to frontend
✅ Images display as previews before sending
✅ Images sent to droid exec with vision models
✅ Droid processes and responds to image content
✅ Mobile-friendly upload UI
✅ Error handling for all failure cases
✅ Works from any device (public URLs)
✅ No local storage management needed

---

## 15. Notes

**Confirmed Working:**
- ✅ Droid exec accepts public image URLs
- ✅ Vision models process images correctly
- ✅ No special flags needed in droid exec
- ❌ Localhost URLs do NOT work (tested and confirmed)

**Why Cloudinary:**
- Testing proved local Flask hosting doesn't work
- Droid exec cannot access localhost URLs (security restriction)
- Cloudinary provides public URLs that work perfectly
- Free tier is sufficient (25GB storage/bandwidth)
- No cleanup needed, handled by Cloudinary

**Approach:**
- Cloud-first implementation (not optional upgrade)
- Simple Cloudinary SDK integration
- Public URLs accessible from anywhere
- Automatic CDN delivery and optimization

**Priority:**
- Implement after mobile view tasks complete
- Should take ~9.5 hours total
- Free Cloudinary account required

---

**Ready for implementation after mobile view completion!** 🎉
