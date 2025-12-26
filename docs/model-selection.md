# Model Selection

Users can select and change the AI model used for code generation.

## Where Models Can Be Changed

**Project Creation**: Users select a model when creating a new project via the ModelSelector component.

**During Chat**: Users can switch models mid-conversation using the ModelSelector in the ChatInput footer.

## Data Flow

```
User selects model
        │
        ▼
Astro Action (updateProjectModel)
        │
        ├── Update projects.model in database
        │
        └── Update opencode.json on disk (best-effort)
```

## Storage

**Database**: Model ID stored in `projects.model` column.

**Disk**: Model ID also written to `opencode.json` in the project directory. This ensures OpenCode reads the correct model on container restart.

## Prompt Behavior

When sending prompts, the model is passed explicitly:

```
prompt_async({ ..., providerID: "openrouter", modelID: "selected-model" })
```

This allows mid-conversation model switching without affecting previous messages.

## UI Components

**ModelSelector**: Reusable component showing available models from OpenRouter. Used in both CreateProjectForm and ChatInput.

**State Management**: Current model is fetched from the presence API and maintained in ChatPanel state.

## Error Handling

- Optimistic UI updates with revert on failure
- Disk file updates are best-effort (don't block DB updates)
- Invalid model selections fall back to user's default model
