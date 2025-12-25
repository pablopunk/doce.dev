# OpenCode Image Handling - Quick Reference

## Key Takeaways for doce.dev

### 1. Image Input Format (How Users Attach Images)
```
Accepted:     PNG, JPEG, GIF, WebP (+ PDF for documents)
Methods:      Click/Browse, Copy-Paste, Drag-Drop
In-Memory:    Base64 data URLs (e.g., "data:image/png;base64,iVBORw0KG...")
Storage:      Component state array: store.imageAttachments[]
```

### 2. Data Structure to Copy

```typescript
// In doce.dev/src/types/message.ts or similar
interface ImageAttachmentPart {
  type: "image"
  id: string                 // UUID for tracking
  filename: string          // Original filename
  mime: string              // "image/png" etc
  dataUrl: string           // Base64 data URL
}

// Usage in component state:
const [imageAttachments, setImageAttachments] = createSignal<ImageAttachmentPart[]>([])
```

### 3. Upload Implementation Pattern

```typescript
// File → Base64 Data URL
const addImageAttachment = async (file: File) => {
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string  // "data:image/png;base64,..."
    const attachment: ImageAttachmentPart = {
      type: "image",
      id: crypto.randomUUID(),
      filename: file.name,
      mime: file.type,
      dataUrl,
    }
    setImageAttachments([...imageAttachments(), attachment])
  }
  reader.readAsDataURL(file)
}

// Handle: File Input, Paste, Drag-Drop
// All convert to base64 data URL via FileReader.readAsDataURL()
```

### 4. Display in Chat History

```typescript
// In UserMessageDisplay component:
const attachments = createMemo(() =>
  files().filter((f) => f.mime.startsWith("image/") || f.mime === "application/pdf")
)

// Render:
<For each={attachments()}>
  {(file) => (
    <Show when={file.mime.startsWith("image/") && file.url}>
      <img src={file.url} alt={file.filename} />  {/* Uses data URL directly */}
    </Show>
  )}
</For>
```

### 5. Sending Images to API

**Two-Step Process:**

**Step 1: Build Message Parts (Client)**
```typescript
const imageAttachmentParts = store.imageAttachments.map((attachment) => ({
  id: Identifier.ascending("part"),
  type: "file",              // Images are "file" type in message parts
  mime: attachment.mime,     // Preserve original MIME type
  url: attachment.dataUrl,   // Send base64 data URL as-is
  filename: attachment.filename,
}))

// Combined: text + files + images all in requestParts array
const requestParts = [textPart, ...fileAttachmentParts, ...imageAttachmentParts]
```

**Step 2: Format Conversion (Server)**
```
Client sends:           data:image/png;base64,iVBORw0KG...
                        ↓
Server converts to:     Provider-specific format
                        ├─ Anthropic: { type: "base64", media_type: "image/png", data: "iVBORw0KG..." }
                        ├─ OpenAI: { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
                        └─ Others: Format-specific
```

### 6. File Structure Pattern to Follow

```
src/
├── components/
│   └── chat/
│       ├── ChatInput.tsx           # Add image attachment UI here
│       └── ChatMessage.tsx         # Add image display here
├── context/
│   └── message.ts                  # Define ImageAttachmentPart interface
└── actions/
    └── index.ts                    # Format conversion happens here
```

### 7. Size & Constraints

**No UI Enforcement:**
- OpenCode doesn't limit in frontend
- API providers enforce their own limits
- Base64 adds ~33% size overhead

**Recommendation for doce.dev:**
- Don't add UI size checks
- Let API handle limits
- Better UX: fail gracefully on oversized images

### 8. Avoided Patterns (Not Recommended)

❌ Image compression in browser (adds complexity)
❌ Image dimension resizing (unnecesary)
❌ Pre-validation of image contents (let API decide)
❌ Multiple format support on client (do on server if needed)
❌ Keeping original File objects (they're memory heavy)

### 9. Conversion Formula (For Reference)

```
Anthropic Format Conversion:
┌─────────────────────────────────────────┐
│ Input: { type: "image_url", image_url: { url: "data:image/png;base64,ABC..." } }
│                                         │
│ Parse: /^data:([^;]+);base64,(.*)$/     │
│        $1 = "image/png"                 │
│        $2 = "ABC..."                    │
│                                         │
│ Output: { type: "base64", media_type: "image/png", data: "ABC..." }
└─────────────────────────────────────────┘

OpenAI Format Conversion:
Keep image_url as-is, works with data: URLs natively
```

### 10. Best Practices Learned

1. **Use data URLs** - No temp file storage needed, works offline
2. **Separate concerns** - Upload != Display != Transmission format
3. **UUID per attachment** - Easy to track/remove in list
4. **Lazy conversion** - Convert format only when sending to API
5. **Preserve metadata** - Keep filename, MIME type for downstream
6. **Simple state management** - Just an array of attachments
7. **No validation on client** - Let server/API validate

---

## Related Files in OpenCode

| Component | Path | Purpose |
|-----------|------|---------|
| Image upload | `/packages/app/src/components/prompt-input.tsx` | File input, paste, drag-drop |
| Data structure | `/packages/app/src/context/prompt.tsx` | ImageAttachmentPart interface |
| Display | `/packages/ui/src/components/message-part.tsx` | Render images in chat |
| API format | `/packages/console/app/src/routes/zen/util/provider/anthropic.ts` | Convert to provider format |

---

## Implementation Checklist for doce.dev

- [ ] Define `ImageAttachmentPart` interface in types
- [ ] Add image input to ChatInput component (file + paste + drag-drop)
- [ ] Store image attachments in component state
- [ ] Display images in ChatMessage component
- [ ] Include images in message submission
- [ ] Add format conversion for chosen AI provider
- [ ] Test paste functionality
- [ ] Test drag-and-drop
- [ ] Test image display in message history
- [ ] Test transmission to API

