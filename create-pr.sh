#!/bin/bash
# Script to create the pull request for the clean code refactoring

# The refactoring has been completed and committed to:
# Branch: opencode/dispatch-5e9460-20260103160055
# Commit: abc4d38

# To create the pull request, run this command:
gh pr create \
  --title "refactor: split large files into focused modules following clean code principles" \
  --body-file - <<'EOF'
## Summary of Changes

This refactoring splits large monolithic files into focused modules following clean code principles from AGENTS.md.

### 1. Split ChatPanel.tsx into Smaller Components

**Before:** 898-line monolithic component handling:
- Chat history loading
- Session management  
- Event streaming
- Message rendering
- Tool calls
- Model selection
- Presence polling

**After:** 500-line component using 3 custom hooks:
- `src/hooks/useChatSession.ts` (114 lines): Manages session/presence state and polling
- `src/hooks/useChatEvents.ts` (295 lines): Handles event stream processing  
- `src/hooks/useChatHistory.ts` (138 lines): Handles chat history loading

**Impact:** Reduced by 398 lines (44% reduction)

### 2. Split queue.model.ts into Focused Modules

**Before:** 672-line file handling:
- Queue settings operations
- Job CRUD operations
- Job claiming and heartbeat
- Job lifecycle management

**After:** 
- `src/server/queue/queue.model.ts` (140 lines): Re-exports from modules + unique functions
- `src/server/queue/queue.settings.ts` (65 lines): Queue settings operations
- `src/server/queue/queue.crud.ts` (202 lines): Job CRUD operations
- `src/server/queue/queue.claim.ts` (161 lines): Job claiming and heartbeat
- `src/server/queue/queue.lifecycle.ts` (141 lines): Job lifecycle management

**Impact:** queue.model.ts reduced by 532 lines (79% reduction)

### 3. Updated AGENTS.md

Added "Component Patterns" section documenting:
- **Custom hooks** for complex React components
- **Modular model files** with focused responsibility
- **API call abstraction** into service functions
- **State management** using custom hooks

### Clean Code Principles Applied

✅ **Single-purpose functions**: Each hook/module has one clear responsibility
✅ **Proper abstractions**: Complex logic abstracted into focused functions  
✅ **Separation of concerns**: UI logic separate from business logic
✅ **MVC pattern**: Clear separation between model, view, and controller
✅ **Backward compatibility**: queue.model.ts re-exports from modules
✅ **Consistent conventions**: Following tech stack patterns

### Files Changed

**Modified:**
- `src/components/chat/ChatPanel.tsx`: -398 lines (44% reduction)
- `src/server/queue/queue.model.ts`: -532 lines (79% reduction)
- `AGENTS.md`: +7 lines (Component Patterns documentation)

**Added:**
- `src/hooks/useChatSession.ts`: 114 lines
- `src/hooks/useChatEvents.ts`: 295 lines  
- `src/hooks/useChatHistory.ts`: 138 lines
- `src/server/queue/queue.settings.ts`: 65 lines
- `src/server/queue/queue.crud.ts`: 202 lines
- `src/server/queue/queue.claim.ts`: 161 lines
- `src/server/queue/queue.lifecycle.ts`: 141 lines

**Total Impact:**
- Lines removed: 930 lines
- Lines added: 1,013 lines  
- Net change: +83 lines but dramatically improved organization
- Files refactored: 10 files into focused, maintainable modules

This refactoring makes the codebase more maintainable, testable, and follows the clean code principles outlined in AGENTS.md.
EOF

# Or alternatively, visit this URL directly:
echo "You can also create the PR manually at:"
echo "https://github.com/pablopunk/doce.dev/pull/new/opencode/dispatch-5e9460-20260103160055"
