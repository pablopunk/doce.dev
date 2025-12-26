# Image Input Handling - Current Implementation Analysis

## Executive Summary

The codebase has **comprehensive image input support** already implemented across the frontend, with proper handling for upload, storage, display, and transmission to the OpenCode API. However, there are **no model capability checks** currently in place to validate whether the selected AI model supports image inputs before allowing users to attach or send images.

---

## Part 1: Current Image Input Implementation

### 1.1 Image Upload & Input Methods

**File:** `src/components/chat/ChatInput.tsx` (lines 1-279)

#### Supported Image Formats
- **Accepted MIME types:** `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- **Defined in:** `src/types/message.ts` (lines 182-187)

#### Upload Methods (3 ways)
1. **File Picker** - Click attachment button → file dialog
   - Lines 231-238: Hidden file input
   - Lines 240-254: Attachment button with counter

2. **Paste from Clipboard** - Copy/paste image directly
   - Lines 101-117: `handlePaste()` function
   - Checks clipboard items for image types

3. **Drag & Drop** - Drag image files onto input area
   - Lines 119-146: `handleDragOver/handleDragLeave/handleDrop()`
   - Filters to image files only

#### File Processing
- **Function:** `processFiles()` (lines 61-91)
- **Steps:**
  1. Validates MIME type
  2. Checks file size (5MB max)
  3. Reads file as base64 data URL via `createImagePartFromFile()`
  4. Stores in state array `selectedImages`

#### Constraints Applied
- **Maximum images per message:** 5 (const `MAX_IMAGES_PER_MESSAGE`)
- **Maximum file size:** 5MB (const `MAX_IMAGE_FILE_SIZE`)
- **UI enforcement:** Yes (button disabled at max, error messages displayed)

---

### 1.2 Image Data Structure

**File:** `src/types/message.ts` (lines 12-19)

```typescript
export interface ImagePart {
  type: "image";
  id: string;           // Unique identifier
  filename: string;     // Original filename
  mime: string;         // e.g., "image/png"
  dataUrl: string;      // Base64 data URL (data:image/png;base64,...)
  size?: number;        // Optional file size in bytes
}
```

**Storage:** Component state in `ChatInput.tsx`
- `selectedImages: ImagePart[]` (line 40)
- Images stored as base64 data URLs (in-memory, no backend storage)

---

### 1.3 Image Preview & Display

#### In ChatInput (Before Sending)
**File:** `src/components/chat/ImagePreview.tsx` (lines 1-50)

- Displays thumbnail grid of selected images
- Shows file size at bottom of each thumbnail
- Hover overlay with delete (X) button
- Max dimensions: 20px × 20px per thumbnail
- Border and styling applied

#### In Chat History (After Sending)
**File:** `src/components/chat/ChatMessage.tsx` (lines 119-135)

```typescript
if (part.type === "image") {
  const imagePart = part as ImagePart;
  return (
    <div key={part.id || idx} className="my-2">
      <img
        src={imagePart.dataUrl}
        alt={imagePart.filename || "Image attachment"}
        className="max-w-sm max-h-96 rounded-lg border border-input object-contain"
      />
      {imagePart.filename && (
        <p className="text-xs text-muted-foreground mt-1">
          {imagePart.filename}
        </p>
      )}
    </div>
  );
}
```

**Display characteristics:**
- Max width: 100% up to `sm` breakpoint
- Max height: 96 units (384px)
- Rounded borders, object-fit: contain
- Filename displayed below as caption

---

### 1.4 Sending Images in Messages

**File:** `src/components/chat/ChatPanel.tsx` (lines 541-641)

#### Message Part Construction (Lines 541-570)
```typescript
const handleSend = async (content: string, images?: ImagePart[]) => {
  const messageParts: MessagePart[] = [];
  
  // Add images first (displayed above text)
  if (images && images.length > 0) {
    for (const img of images) {
      messageParts.push(createImagePart(
        img.dataUrl, 
        img.filename, 
        img.mime, 
        img.size, 
        img.id
      ));
    }
  }
  
  // Add text part
  if (content) {
    messageParts.push(createTextPart(content));
  }
  // ... rest of message handling
}
```

#### API Format (Lines 595-613)
```typescript
// Build parts for API (following OpenCode pattern: images as "file" type)
const apiParts: Array<{ type: string; text?: string; mime?: string; url?: string; filename?: string }> = [];

// Add text part first for API
if (content) {
  apiParts.push({ type: "text", text: content });
}

// Add images as file parts (OpenCode pattern)
if (images && images.length > 0) {
  for (const img of images) {
    apiParts.push({
      type: "file",
      mime: img.mime,
      url: img.dataUrl,
      filename: img.filename,
    });
  }
}
```

**Transmission endpoint:** `POST /api/projects/[id]/opencode/session/[sessionId]/prompt_async`

---

## Part 2: Message Flow & OpenCode Integration

### 2.1 API Endpoint: OpenCode Proxy

**File:** `src/pages/api/projects/[id]/opencode/[...path].ts` (lines 1-200)

#### Key points:
- Proxies all OpenCode requests (session, message, event APIs)
- **Message endpoint timeout:** 300 seconds (5 minutes) for LLM responses
- Request body size limit: 5MB
- No image validation at API layer (delegated to OpenCode)

---

### 2.2 Message Streaming & Event Handling

**File:** `src/components/chat/ChatPanel.tsx` (lines 279-311, 313-539)

- Connects to SSE event stream: `/api/projects/[id]/opencode/event`
- Handles event normalization via `normalizeEvent()` 
- Events processed in `handleEvent()` (lines 313-539)

**Message parts handled:**
- `chat.message.part.added` - New text parts with delta
- `chat.message.delta` - Backward compatibility for old-style deltas
- `chat.message.final` - Mark message as complete
- `chat.tool.start/finish/error` - Tool executions
- `chat.reasoning.part` - Extended thinking output

**Note:** No special handling for image parts in streaming (images not streamed)

---

## Part 3: Model Selection & Capability Context

### 3.1 Current Model System

**File:** `src/server/settings/openrouter.ts` (lines 1-138)

#### Available Models (Lines 6-48)
```typescript
export const AVAILABLE_MODELS = [
  { id: "openai/gpt-5.2", name: "GPT-5.2", provider: "OpenAI", tier: "top" },
  { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "OpenAI", tier: "fast" },
  { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5", provider: "Anthropic", tier: "top" },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", provider: "Anthropic", tier: "fast" },
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro", provider: "Google", tier: "top" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", tier: "fast" },
]
```

**Default model:** `anthropic/claude-haiku-4.5`
**Fast model:** `google/gemini-2.5-flash`

### 3.2 Model Storage & Selection

**Files:**
- Database schema: `src/server/db/schema.ts` (line 49: `model: text("model")`)
- Model update: `src/server/projects/projects.model.ts` (lines 76-82)
- UI selector: `src/components/dashboard/ModelSelector.tsx`

#### Model Selection Flow
1. User selects model in ChatInput (ModelSelector component)
2. Model change triggers `onModelChange()` callback
3. Server updates project model via `actions.projects.updateModel()`
4. Model persisted in database and opencode.json

**Current behavior:** ✅ All models can be selected without restriction

---

## Part 4: Absence of Model Capability Checks

### 4.1 What's Missing

**No validation exists for:**
- ❌ Model vision/image support capabilities
- ❌ Checking if selected model supports images before enabling upload
- ❌ Preventing image submission with models that don't support them
- ❌ Feature flags for vision-capable models
- ❌ Model metadata about supported features
- ❌ Runtime warnings about incompatible combinations

### 4.2 Specific Gaps

#### In ChatInput Component
- No check before allowing image attachment based on model
- No validation against current model selection
- No error messaging about model incompatibility

#### In ChatPanel Component  
- No capability check before sending images with message
- No model validation in `handleSend()` function
- Images sent regardless of model's actual support

#### In Model Selector
- No capability indicators (badges/warnings)
- No "vision capable" label on models
- All models presented equally

#### In Message Types
- `ImagePart` interface lacks capability metadata
- No way to track which models can/cannot use images

---

## Part 5: Related Systems & Dependencies

### 5.1 Database Schema

**File:** `src/server/db/schema.ts`

```typescript
export const projects = pgTable("projects", {
  // ... other fields ...
  model: text("model"),  // Currently just stores model ID string
});

export const users = pgTable("users", {
  // ... other fields ...
  defaultModel: text("default_model"),  // No capability metadata
});
```

**Issue:** Model stored as simple string ID, no capability metadata tracked

### 5.2 OpenCode Integration

**File:** `src/server/opencode/normalize.ts` (lines 1-439)

- Normalizes OpenCode SSE events into doce.dev format
- No image-specific event handling
- No model capability information passed

### 5.3 Queue System & Initial Prompt

**File:** `src/server/queue/handlers/opencodeSessionInit.ts` (lines 1-150)

```typescript
// Line 60-70: Model loading
const config = loadOpencodeJson(projectPath);
if (!config || !config.model) {
  throw new Error("No model configured in opencode.json");
}
const modelID = config.model;
```

- Model passed to OpenCode during session init
- No capability validation before passing
- OpenCode itself may have image support checks (but we don't leverage them)

---

## Part 6: Validation & Error Handling

### 6.1 Existing Validations

**Image file validation (implemented):**
- ✅ MIME type check (`validateImageFile()`)
- ✅ File size check (5MB limit)
- ✅ Count check (5 images max per message)
- ✅ UI feedback for validation errors

**Image storage validation:**
- ✅ Base64 data URL format verification

**What's NOT validated:**
- ❌ Model image support
- ❌ API-specific image constraints
- ❌ Provider-specific MIME type support

---

## Part 7: Frontend Components & State Management

### 7.1 Component Tree

```
ChatPanel (main orchestrator)
├── ChatInput (user input)
│   ├── ModelSelector (model choice)
│   ├── textarea (message text)
│   └── ImagePreview (image thumbnails)
├── ChatMessage (display sent messages)
│   └── PartRenderer (individual parts)
└── ToolCallGroup (tool execution display)
```

### 7.2 State Management

**ChatInput state:**
- `message` - Text input
- `selectedImages` - Array of ImagePart objects
- `imageError` - Error message display
- `isDragging` - Visual feedback for drag-over

**ChatPanel state:**
- `items` - Array of ChatItem (messages + tool calls)
- `currentModel` - Currently selected model ID
- `isStreaming` - Message in progress
- No "capabilityState" or "modelCapabilities"

---

## Summary Table

| Aspect | Status | Implementation |
|--------|--------|-----------------|
| Image upload (file picker) | ✅ Complete | ChatInput.tsx |
| Image upload (paste) | ✅ Complete | ChatInput.tsx |
| Image upload (drag-drop) | ✅ Complete | ChatInput.tsx |
| Image preview (pre-send) | ✅ Complete | ImagePreview.tsx |
| Image display (chat history) | ✅ Complete | ChatMessage.tsx |
| Image transmission to API | ✅ Complete | ChatPanel.tsx |
| Image file validation | ✅ Complete | types/message.ts |
| Model selection | ✅ Complete | ModelSelector.tsx |
| Model persistence | ✅ Complete | projects.model.ts |
| Model capability metadata | ❌ Missing | - |
| Model image support check | ❌ Missing | - |
| Image compatibility validation | ❌ Missing | - |
| Capability-based UI gating | ❌ Missing | - |
| Feature flags for models | ❌ Missing | - |

---

## Recommendations for Model Capability Support

### Short Term (MVP)
1. Create model capability metadata structure
2. Mark which models support images
3. Add UI validation to prevent image upload with unsupported models
4. Show model capability indicators in selector

### Medium Term
1. Implement server-side capability checks
2. Add API error handling for unsupported image requests
3. Create capability system for extensibility

### Long Term
1. Query model capabilities from OpenRouter API
2. Build dynamic capability system
3. Support additional features (vision, reasoning, etc.)

