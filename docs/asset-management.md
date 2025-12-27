# Asset Management System

The asset management system handles file uploads and storage for projects, allowing users to attach images and other resources to their AI prompts.

## Overview

Assets are files uploaded by users that can be attached to project prompts, particularly for image inputs to AI models. Each project maintains its own asset directory within the project's filesystem.

## Architecture

### File Organization

```
project/
├── assets/          # User-uploaded files
│   ├── image1.jpg
│   ├── image2.png
│   └── ...
├── src/             # Project source code
└── ...
```

### Storage Location

Assets are stored in the project directory at `assets/`. For a project with slug `my-project`:
```
{PROJECT_ROOT}/my-project/assets/
```

## UI Components

The asset management UI is organized in a nested component structure:

### Component Hierarchy

```
AssetsTab (main tab component)
├── AssetsList (scrollable list of assets)
│   ├── AssetItem (individual asset preview)
│   │   ├── Image preview
│   │   ├── Filename
│   │   └── Delete button
│   └── ...more items...
└── AssetUploadZone (drag-drop upload area)
    ├── Upload input
    └── Drop target
```

**Files**:
- `src/components/assets/AssetsTab.tsx` - Tab container
- `src/components/assets/AssetsList.tsx` - List view
- `src/components/assets/AssetItem.tsx` - Individual item
- `src/components/assets/AssetUploadZone.tsx` - Upload area

### Features

- **List View**: Browse uploaded assets with image previews
- **Upload**: Drag-drop or click to select files
- **Delete**: Remove individual assets
- **Preview**: Image thumbnails for quick identification
- **Error Handling**: User-friendly error messages

## Upload Workflow

```
User selects/drags file
           ↓
AssetUploadZone processes
           ↓
assets.upload action (server call)
           ↓
Server validates file
           ↓
Create asset directory if needed
           ↓
Save file to disk
           ↓
Return file info to client
           ↓
UI updates AssetsList
           ↓
Asset available for attachment to prompts
```

## API

### assets.upload Action

**Location**: `src/actions/index.ts`

**Input**:
```typescript
{
  projectId: string;
  file: File;  // FormData file
}
```

**Process**:
1. Validate file (size, type)
2. Generate safe filename
3. Create `assets/` directory if needed
4. Write file to disk
5. Return file info

**Response**:
```typescript
{
  filename: string;
  path: string;     // Relative path in project
  size: number;     // Bytes
  url: string;      // Access URL
}
```

**Error Cases**:
- Invalid file type
- File too large
- Disk write failure
- Project not found

## Image Attachments in Prompts

### Integration with Chat

When uploading images:

1. **UI Side**: AssetsList shows uploaded images
2. **User Action**: User selects images to attach
3. **Chat Input**: Selected images appear in ChatInput
4. **Prompt Sending**: Images included in `parts` array
5. **Server Processing**: Images sent to OpenCode API

### Data Structure

Images in messages use the `ImagePart` type:

```typescript
interface ImagePart {
  type: "image";
  mimeType: string;  // "image/jpeg", "image/png", etc.
  data: string;      // Base64-encoded image data
  alt?: string;      // Optional alt text
}
```

### Model Support

Not all models support image inputs. Check model capabilities:
- OpenAI GPT-4: ✅ Images supported
- Anthropic Claude: ✅ Images supported
- Other models: Check documentation

The UI shows image support status and disables image selection for models that don't support images.

## File Organization Best Practices

### Supported File Types

Recommended for image inputs:
- `.jpg` / `.jpeg`
- `.png`
- `.gif`
- `.webp`

Other types may work depending on model support.

### File Size Limits

- **Recommended**: < 5MB per file
- **Maximum**: Depends on model (typically 10-20MB)
- **UI validation**: Client-side file size check

### Naming

Files are sanitized to prevent:
- Path traversal (`../`)
- Special characters
- Spaces and unicode

Original filenames preserved where possible for UX.

## Cleanup

### Automatic Cleanup

When a project is deleted:
1. Project delete handler initiated
2. Asset directory removed with project directory
3. All files permanently deleted

### Manual Cleanup

Users can delete individual assets via UI:
1. Click delete button on asset item
2. Asset removed from disk
3. UI updates immediately

## Example Workflow: Image Attachment

```
1. User navigates to Assets tab
2. Drags image file into upload zone
3. AssetUploadZone shows upload progress
4. assets.upload action called
5. Image file saved to {project}/assets/
6. AssetsTab refreshes, shows new image
7. User clicks image in AssetsList
8. Image selected for attachment
9. Image appears in ChatInput.images
10. User types prompt
11. On send:
    - Convert image to base64
    - Create ImagePart
    - Include in message.parts
    - Send to OpenCode API
12. Model processes image + text
13. Response shown in chat
```

## Configuration

### Environment Variables

No special configuration required. Assets use project filesystem.

### Limits (Configurable)

Located in `src/actions/index.ts`:

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
```

## Troubleshooting

### Upload Fails

**Check**:
- File size within limits
- File type supported
- Disk space available
- Project directory writable

**Solution**:
- Reduce file size or convert format
- Check server logs
- Verify filesystem permissions

### Images Not Attached to Prompt

**Possible Causes**:
- Model doesn't support images
- Images not selected in UI
- Image format unsupported by model

**Solution**:
- Check model capabilities in UI
- Ensure images selected (highlighted in AssetsList)
- Convert to standard format (JPEG/PNG)

### Asset List Not Updating

**Possible Causes**:
- Upload failed silently
- Cache not refreshed
- Network error

**Solution**:
- Check browser console for errors
- Refresh page
- Check network tab for failed requests
- Review server logs

## Future Enhancements

Potential improvements:
- Asset folders/organization
- Batch upload
- Asset compression
- Image resizing
- Asset sharing between projects
- Asset search/filter
- Storage quota management
- CDN/cloud storage integration
