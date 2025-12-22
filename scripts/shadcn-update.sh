#!/bin/bash

# ============================================================================
# Design System Update Script
# ============================================================================
# Updates the project's design system by pulling the latest shadcn/ui
# components with a configurable preset URL.
#
# Configuration: Edit PRESET_URL below to change the shadcn preset
# ============================================================================

set -e  # Exit on error

# ============================================================================
# CONFIGURATION - Edit these values to customize the update
# ============================================================================

PRESET_URL="https://ui.shadcn.com/init?base=base&style=nova&baseColor=gray&theme=gray&iconLibrary=lucide&font=inter&menuAccent=bold&menuColor=default&radius=default&template=vite"

# ============================================================================
# Internal variables (do not edit)
# ============================================================================

TEMP_DIR="/tmp/shadcn-nova-temp-$$"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_COMPONENTS_DIR="$PROJECT_ROOT/src/components/ui"
STYLES_FILE="$PROJECT_ROOT/src/styles/globals.css"
COMPONENTS_JSON="$PROJECT_ROOT/components.json"
BACKUP_TIMESTAMP=$(date +%s)
BACKUP_DIR="/tmp/shadcn-backup-$BACKUP_TIMESTAMP"

# ============================================================================
# Helper functions
# ============================================================================

log() {
  echo "▶ $1"
}

error() {
  echo "✗ Error: $1" >&2
  exit 1
}

success() {
  echo "✓ $1"
}

# ============================================================================
# Validation
# ============================================================================

log "Validating environment..."

if ! command -v pnpm &> /dev/null; then
  error "pnpm is not installed. Please install pnpm first."
fi
success "pnpm found"

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  error "Not in a valid project root. package.json not found."
fi
success "Project root verified: $PROJECT_ROOT"

if [ ! -d "$UI_COMPONENTS_DIR" ]; then
  error "UI components directory not found: $UI_COMPONENTS_DIR"
fi
success "UI components directory found"

# ============================================================================
# Backup current UI components
# ============================================================================

log "Backing up current UI components..."

mkdir -p "$BACKUP_DIR"
cp -r "$UI_COMPONENTS_DIR" "$BACKUP_DIR/ui"

success "Backup created at: $BACKUP_DIR/ui"
echo ""
echo "  💾 Backup location: $BACKUP_DIR/ui"
echo ""

# ============================================================================
# Create temporary shadcn project
# ============================================================================

log "Creating temporary shadcn project..."

mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Run shadcn create with preset (non-interactive via preset)
# The command creates a project directory with the given name
TEMP_PROJECT_DIR="$TEMP_DIR/shadcn-project"
pnpm dlx shadcn@latest create shadcn-project \
  -p "$PRESET_URL" \
  --template vite \
  --yes \
  > /dev/null 2>&1 || error "Failed to create shadcn project with preset"

success "Shadcn project created in temp directory"

if [ ! -d "$TEMP_PROJECT_DIR" ]; then
  error "Could not find shadcn project directory at: $TEMP_PROJECT_DIR"
fi

success "Found shadcn project at: $TEMP_PROJECT_DIR"

# ============================================================================
# Copy UI components
# ============================================================================

log "Copying UI components from shadcn project..."

# Remove existing components
rm -rf "$UI_COMPONENTS_DIR"/*

# Copy new components
cp -r "$TEMP_PROJECT_DIR/src/components/ui/"* "$UI_COMPONENTS_DIR/" || error "Failed to copy UI components"

success "UI components updated"

# ============================================================================
# Copy and update globals.css
# ============================================================================

log "Copying design tokens (globals.css)..."

# The shadcn vite template puts CSS in src/index.css
TEMP_CSS_FILE="$TEMP_PROJECT_DIR/src/index.css"

if [ ! -f "$TEMP_CSS_FILE" ]; then
  error "Could not find CSS file at: $TEMP_CSS_FILE"
fi

cp "$TEMP_CSS_FILE" "$STYLES_FILE" || error "Failed to copy index.css to globals.css"

success "Design tokens updated"

# ============================================================================
# Copy and update components.json
# ============================================================================

log "Updating components.json..."

# Get the new components.json and update the CSS path
TEMP_COMPONENTS_JSON="$TEMP_PROJECT_DIR/components.json"

if [ ! -f "$TEMP_COMPONENTS_JSON" ]; then
  error "Could not find components.json at: $TEMP_COMPONENTS_JSON"
fi

# Copy the new components.json
cp "$TEMP_COMPONENTS_JSON" "$COMPONENTS_JSON" || error "Failed to copy components.json"

# Update the CSS path to match our project structure (src/index.css -> src/styles/globals.css)
sed -i.bak 's|"css": "src/index.css"|"css": "src/styles/globals.css"|g' "$COMPONENTS_JSON"
rm -f "$COMPONENTS_JSON.bak"

# Verify the CSS path was updated
if grep -q '"css": "src/styles/globals.css"' "$COMPONENTS_JSON"; then
  success "components.json updated and CSS path configured"
else
  error "Failed to update CSS path in components.json"
fi

# ============================================================================
# Verification
# ============================================================================

log "Verifying updates..."

# Check if files exist and are readable
if [ ! -d "$UI_COMPONENTS_DIR" ] || [ -z "$(ls -A "$UI_COMPONENTS_DIR" 2>/dev/null)" ]; then
  error "UI components directory is empty after update"
fi
success "UI components directory verified"

if [ ! -f "$STYLES_FILE" ] || [ ! -s "$STYLES_FILE" ]; then
  error "globals.css is empty or missing"
fi
success "globals.css verified"

if [ ! -f "$COMPONENTS_JSON" ] || [ ! -s "$COMPONENTS_JSON" ]; then
  error "components.json is empty or missing"
fi
success "components.json verified"

# ============================================================================
# Cleanup
# ============================================================================

log "Cleaning up temporary files..."

cd "$PROJECT_ROOT"
rm -rf "$TEMP_DIR"

success "Temporary files cleaned up"

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "✓ Design System Update Complete!"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "📦 What was updated:"
echo "  • src/components/ui/* - All UI components"
echo "  • src/styles/globals.css - Design tokens and colors"
echo "  • components.json - Configuration"
echo ""
echo "⚠️  Custom Components Notice:"
echo "  The following custom components were backed up and need manual restoration:"
echo "  • ResizableSeparator.tsx"
echo "  • input-group.tsx"
echo "  • field.tsx"
echo "  • combobox.tsx"
echo ""
echo "  Restore from: $BACKUP_DIR/ui/"
echo ""
echo "💾 Full backup location:"
echo "  $BACKUP_DIR/ui"
echo ""
echo "Next steps:"
echo "  1. Test the updated components"
echo "  2. Restore custom components if needed"
echo "  3. Run: pnpm install (if dependencies changed)"
echo "  4. Run: pnpm dev (to verify everything works)"
echo ""
