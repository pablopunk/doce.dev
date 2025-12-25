# OpenCode Image Input Handling Analysis

## Overview
OpenCode implements a comprehensive image attachment system for chat messages, supporting image uploads, display in message history, and transmission to AI APIs with format conversion.

---

## 1. Image Input Format & Upload

### Accepted Image Types
- **PNG** (`image/png`)
- **JPEG** (`image/jpeg`)
- **GIF** (`image/gif`)
- **WebP** (`image/webp`)
- **PDF** (`application/pdf`) - treated as attachment, not image

**File:** `/packages/app/src/components/prompt-input.tsx` (lines 27-28)

### Upload Methods
Three ways to attach images:

1. **File Input** - Click attachment button → file dialog
2. **Paste** - Copy/paste image directly from clipboard
3. **Drag & Drop** - Drag image file onto input area

**Implementation:**
```typescript
// File reading to data URL
const reader = new FileReader()
reader.readAsDataURL(file)  // Converts to base64 data URL
```

---

## 2. Image Data Structure (In-Memory)

### ImageAttachmentPart Interface
```typescript
interface ImageAttachmentPart {
  type: "image"
  id: string                 // UUID (crypto.randomUUID())
  filename: string          // Original filename
  mime: string              // e.g., "image/png"
  dataUrl: string           // Base64 data URL: "data:image/png;base64,..."
}
```

**File:** `/packages/app/src/context/prompt.tsx` (lines 24-30)

### Storage & Management
- Images stored in component state: `store.imageAttachments: ImageAttachmentPart[]`
- Each image gets unique UUID for tracking
- Data URLs allow immediate display without backend
- Maximum number of attachments: Not enforced in UI (no size limit enforcement visible)

---

## 3. Image Display in Chat History

### User Message Display
**File:** `/packages/ui/src/components/message-part.tsx` (lines 224-276)

```typescript
// In UserMessageDisplay:
const attachments = createMemo(() =>
  files()?.filter((f) => {
    const mime = f.mime
    return mime.startsWith("image/") || mime === "application/pdf"
  })
)
```

**Display Logic:**
- Attachments are separated from text content
- Images displayed with `<img>` tags using `file.url`
- PDFs shown with folder icon (not image preview)
- Container: `data-component="user-message-attachments"`
- Each attachment: `data-slot="user-message-attachment"`

**Visual Hierarchy:**
1. Attachment container (displays all images)
2. Text message content (below attachments)
3. Inline file references (highlighted in text)

---

## 4. Image Transmission to API

### Message Part Construction
**File:** `/packages/app/src/components/prompt-input.tsx` (lines 780-786)

```typescript
const imageAttachmentParts = store.imageAttachments.map((attachment) => ({
  id: Identifier.ascending("part"),
  type: "file" as const,           // Treated as file part, not text
  mime: attachment.mime,            // Original MIME type
  url: attachment.dataUrl,          // Base64 data URL sent directly
  filename: attachment.filename,
}))
```

### Message Sending
- Images sent alongside text and file attachments in `requestParts` array
- Each part has: `id`, `type: "file"`, `mime`, `url`, `filename`
- All parts (text + files + images) grouped together

**File:** `/packages/app/src/components/prompt-input.tsx` (lines 833-854)

---

## 5. API Format Conversion

### Message Format Handling
OpenCode acts as a **format bridge** between multiple AI API formats:

**Supported Formats:**
- **Anthropic** - Native format
- **OpenAI** - Standard chat completion format
- **OpenAI-Compatible** - Generic OpenAI-like APIs
- **Google** (Gemini)

### Image URL Handling in Request Conversion

#### Anthropic Format (`toAnthropicRequest`)
**File:** `/packages/console/app/src/routes/zen/util/provider/anthropic.ts` (lines 227-238)

```typescript
const toSrc = (p: any) => {
  if (p.type === "image_url" && p.image_url) {
    const u = p.image_url.url ?? p.image_url
    
    // If data URL (base64), extract media type and data
    if (typeof u === "string" && u.startsWith("data:")) {
      const m = u.match(/^data:([^;]+);base64,(.*)$/)
      if (m) return { type: "base64", media_type: m[1], data: m[2] }
    }
    
    // Otherwise, send as URL
    if (typeof u === "string") return { type: "url", url: u }
  }
  return undefined
}
```

**Anthropic API Message Structure:**
```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "...", "cache_control": { "type": "ephemeral" } },
    { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "..." } }
  ]
}
```

#### Common Message Format (Internal)
**File:** `/packages/console/app/src/routes/zen/util/provider/provider.ts` (lines 56-60)

```typescript
export interface CommonContentPart {
  type: "text" | "image_url"
  text?: string
  image_url?: { url: string }
}
```

### Conversion Flow
1. **Client** → Sends base64 data URLs
2. **Server Zen Handler** → Converts to provider-specific format
   - Anthropic: Separates base64 from URL, wraps in `source` object
   - OpenAI: Keeps as `image_url` with base64 or URL
   - Others: Format-specific conversions
3. **API Provider** → Receives properly formatted request

---

## 6. Size & Format Constraints

### Explicit Constraints (Frontend)
- **Accepted MIME types:** PNG, JPEG, GIF, WebP, PDF
- **No maximum file size** enforced in UI code
- **No maximum number** of attachments enforced

### Implicit Constraints (Likely API-Side)
- Total message size limits (inherited from provider APIs)
- Anthropic: ~5GB limit per message (image data URLs subject to overall limit)
- OpenAI: 20MB per image, varies by model
- Base64 encoding adds ~33% size overhead

### Optimization Opportunities (Not Implemented)
- No image compression
- No automatic format conversion (e.g., PNG → WebP)
- No dimension resizing
- Full base64 sent even for small thumbnails

---

## 7. File Structure & Code Patterns

### Frontend Architecture
```
packages/app/src/
├── components/
│   └── prompt-input.tsx          # Main UI component, image upload/paste/drag
├── context/
│   └── prompt.tsx                 # Data structures, image part definition
└── utils/
    └── prompt.ts                  # Utility functions
```

### Backend Architecture (Zen API)
```
packages/console/app/src/routes/zen/
├── v1/
│   └── messages.ts                # Entry point
└── util/
    ├── handler.ts                 # Main request router
    ├── provider/
    │   ├── provider.ts            # Common format definitions
    │   ├── anthropic.ts           # Anthropic conversion
    │   ├── openai.ts              # OpenAI conversion
    │   ├── openai-compatible.ts   # Generic conversion
    │   └── google.ts              # Google conversion
```

### UI Display Architecture
```
packages/ui/src/components/
├── message-part.tsx               # Message rendering with image display
└── ...
```

---

## 8. Comparison with doce.dev

### Similarities to Build On
1. ✅ Both use **data URLs for images** in state
2. ✅ Both need **multiple attachment types** (files, images, etc.)
3. ✅ Both need **drag-and-drop + paste** support
4. ✅ Both need to **convert formats** for API transmission

### Key Differences in OpenCode
1. **Format bridge pattern** - Converts between Anthropic/OpenAI/Google formats
2. **Data URL → Provider-native format** - Processes before sending
3. **Separation of concerns** - Frontend data vs. API format conversion
4. **No compression** - Base64 data sent as-is
5. **Lazy format conversion** - Only converts when sending to API

### Recommendations for doce.dev
1. Use **data URLs** for in-memory image storage (proven approach)
2. **Don't enforce size limits** in UI - let API handle (cleaner separation)
3. **Store attachment metadata** separately (filename, mime, dimensions)
4. **Implement format converters** early if supporting multiple APIs
5. **Separate render logic** - attachment display ≠ transmission format
6. Consider **image optimization** at upload (compression, format conversion)

---

## 9. API Integration Patterns

### Message Structure Sent to AI API

**Anthropic Example:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "What's in this image?" },
        { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "iVBORw0KG..." } }
      ]
    }
  ]
}
```

**OpenAI Example:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "What's in this image?" },
        { "type": "image_url", "image_url": { "url": "data:image/png;base64,iVBORw0KG..." } }
      ]
    }
  ]
}
```

---

## Summary

**Image Input:** PNG, JPEG, GIF, WebP + PDF via file input, paste, or drag-drop

**Format:** Base64 data URLs in-memory, provider-native format on transmission

**Display:** Separate container above message text, uses `<img src>` tags

**Transmission:** Sent as `file` parts with MIME type and base64 data URL

**Constraints:** No explicit UI limits; API provider limits apply server-side

**Pattern:** Format-agnostic internal representation → provider-specific conversion at transmission time
