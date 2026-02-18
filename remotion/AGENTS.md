# Remotion Showcase Video - Agent Documentation

## Project Overview

This is a Remotion project that generates showcase videos for doce.dev. The videos demonstrate the product's key features in a visually polished way, matching the actual UI design from the main doce.dev application.

**Key principle**: The Remotion scenes should be **pixel-accurate** to the real doce.dev UI. When updating scenes, always reference the actual source code in `/src/components/` to match colors, layouts, icons, and component structures.

## Project Structure

### Package Manager
**Uses `npm`** (NOT `pnpm`). The parent project uses `pnpm`, but this Remotion subproject has its own `package.json` and uses `npm`.

### Directory Layout
```
remotion/
├── src/
│   ├── Root.tsx                 # Composition definitions (DoceShowcaseDark, DoceShowcaseLight)
│   ├── DoceShowcase.tsx         # Main timeline - sequences all scenes with transitions
│   ├── theme.tsx                # Theme system (dark/light mode with design tokens)
│   └── scenes/
│       ├── Scene1Hook.tsx       # Opening "hook" scene
│       ├── Scene2Dashboard.tsx  # Dashboard with CreateProjectForm
│       ├── Scene3Chat.tsx       # Chat interface with Files tab
│       ├── Scene5Deploy.tsx     # Deploy button animation
│       ├── Scene6iPhone.tsx     # iPhone mockup
│       ├── Scene7Logo.tsx       # Closing logo animation
│       └── ide/
│           ├── FileTree.tsx     # File tree component
│           └── CodeEditor.tsx   # Code editor with typing animation
├── out/                         # Rendered output files
│   ├── doce-showcase.mp4        # Dark mode MP4
│   ├── doce-showcase-light.mp4  # Light mode MP4
│   ├── doce-showcase.gif        # Dark mode GIF (for README)
│   └── doce-showcase-light.gif  # Light mode GIF (for README)
└── package.json
```

## Theme System

### File: `src/theme.tsx`

The theme system provides design tokens for both dark and light modes. All colors, spacing, and styling should use theme tokens, **never hardcoded values**.

**Key tokens**:
- `sceneBg` - Main background color
- `navbarBg` - Navbar background
- `cardBg` - Card backgrounds
- `textPrimary`, `textMuted`, `textSubtle` - Text colors
- `borderSubtle`, `borderLight`, `borderMedium` - Border colors
- `buttonPrimary`, `buttonPrimaryForeground` - Button colors
- `mutedBg50` - Semi-transparent muted background
- `tabsListBg`, `tabsTriggerActive` - Tab styling
- `chart1`, `chart4`, `chart5` - Gradient colors (orange/yellow/amber)

**Getting real colors from the app**:
1. Check `/src/styles/globals.css` for CSS custom properties (oklch values)
2. Convert oklch to RGB/hex for use in Remotion
3. Dark mode colors come from `:root` section
4. Light mode colors come from `:root.light` section

### Real doce.dev UI Reference

When updating scenes, **always reference the real source code**:

| UI Element | Reference File |
|------------|---------------|
| Navbar | `/src/components/navbar/Navbar.tsx` |
| Create Project Form | `/src/components/dashboard/CreateProjectFormContent.tsx` |
| Model Selector | `/src/components/dashboard/ModelSelector.tsx` |
| Chat Message | `/src/components/chat/ChatMessage.tsx` |
| Chat Input | `/src/components/chat/ChatInput.tsx` |
| Tool Call Display | `/src/components/chat/ToolCallDisplay.tsx` |
| Deploy Button | `/src/components/preview/DeployButton.tsx` |
| Preview Panel | `/src/components/preview/PreviewPanel.tsx` |
| File Tree | `/src/components/files/FileTree.tsx` |
| Read-only Editor | `/src/components/files/ReadOnlyEditor.tsx` |
| Logo | `/public/favicon.svg` |

## Timeline & Scene Durations

### Composition Settings
- **Resolution**: 1920×1080
- **FPS**: 30
- **Total duration**: 615 frames (~20.5 seconds)

### Scene Breakdown (from `DoceShowcase.tsx`)
```typescript
Scene1Hook:          0-75    (75 frames)
Scene2Dashboard:     75-210  (135 frames)
Scene3Chat:          210-395 (185 frames)
Scene5Deploy:        395-455 (60 frames)
Scene6iPhone:        455-555 (100 frames)
Scene7Logo:          555-615 (60 frames) - only in dark mode
```

**Scene4** was skipped/removed in the current implementation.

### Transitions
All transitions use `@remotion/transitions` with 10-frame fade:
```typescript
<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={75}>
    <Scene1Hook />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition timing={fade({ durationInFrames: 10 })} />
  <TransitionSeries.Sequence durationInFrames={135}>
    <Scene2Dashboard />
  </TransitionSeries.Sequence>
  // ... etc
</TransitionSeries>
```

## Important Animation Rules

### ❌ FORBIDDEN in Remotion
These will **NOT render correctly**:
- CSS transitions (`transition: all 0.3s`)
- CSS animations (`@keyframes`, `animation:`)
- Tailwind animation classes (`animate-spin`, `animate-pulse`)
- Any time-based CSS that doesn't use frame data

### ✅ REQUIRED for Animations
All animations **MUST** be driven by `useCurrentFrame()`:

```typescript
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Spring animation
const progress = spring({ frame, fps, config: { damping: 200 } });

// Linear interpolation
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});

// Rotation
const rotation = (frame * 12) % 360;
```

## Common Patterns

### 1. Scene Entry Animation
```typescript
const entranceOpacity = spring({
  frame,
  fps,
  config: { damping: 20, stiffness: 100 }
});

return (
  <AbsoluteFill style={{ opacity: entranceOpacity }}>
    {/* content */}
  </AbsoluteFill>
);
```

### 2. Staggered List Animation
```typescript
{items.map((item, index) => {
  const itemProgress = spring({
    frame: frame - index * 3,  // 3-frame delay per item
    fps,
    config: { damping: 200 }
  });
  const itemX = interpolate(itemProgress, [0, 1], [-20, 0]);
  
  return (
    <div style={{ transform: `translateX(${itemX}px)`, opacity: itemProgress }}>
      {item.name}
    </div>
  );
})}
```

### 3. Typing Animation
```typescript
const typeStartFrame = 30;
const charsPerFrame = 0.5; // 2 frames per character
const charsVisible = Math.floor((frame - typeStartFrame) * charsPerFrame);
const visibleText = fullText.slice(0, charsVisible);

// Cursor blink
const cursorBlink = Math.floor(frame / 4) % 2 === 0 ? 1 : 0;
```

### 4. Button State Transitions
```typescript
// Frame ranges for different states
const isPressed = frame >= 25 && frame < 30;
const isLoading = frame >= 30 && frame < 50;
const isSuccess = frame >= 50;

const buttonState = isSuccess ? "success" : isLoading ? "loading" : "idle";
```

## Scene-Specific Notes

### Scene1Hook
- Simple hook/intro scene
- No complex interactions needed

### Scene2Dashboard
- Shows the main dashboard with CreateProjectForm
- **Model selector dropdown** opens and shows models with provider logos
- Provider logos: Anthropic (A), OpenAI (G) - both rounded squares with letters
- Typing animation for user input
- **Create button** has Sparkles icon (orange) with gradient text

### Scene3Chat
- Split layout: 35% chat panel (left), 65% preview/files panel (right)
- **Chat messages**: 
  - Rounded-md avatars (NOT round circles)
  - User/Bot icons from lucide-react
  - Per-row backgrounds (user: `bg-muted/50`, assistant: `bg-background`)
- **Tool call cards**: Rectangular with `border rounded-md`, NOT pills
- **Tab switching**: Preview tab shows loading spinner, then switches to Files tab at frame 105
- **FileTree**: 320px width, must have `flexShrink: 0` to prevent squishing
- **CodeEditor**: Two lines get typed sequentially (NOT simultaneously)

### Scene5Deploy
- Zooms into preview toolbar (top-right transform origin)
- **Deploy button animation**:
  - Frame 0-24: Idle (outline button, Rocket icon, "Deploy")
  - Frame 25-29: Press animation (scale 0.93)
  - Frame 30-49: Building (Loader2 spinner, "Building...")
  - Frame 50+: Deployed (filled button, CheckCircle2 icon, "Deployed")
- **No Queue/Settings links** in navbar (intentionally hidden)

### Scene6iPhone
- iPhone mockup with live preview
- Shows responsive mobile view

### Scene7Logo
- Closing logo animation
- **Only renders in dark mode** (light mode composition ends after Scene6)

## Components

### Navbar (used in multiple scenes)
```typescript
// Standard navbar structure
<nav className="w-full h-14 border-b" style={{ backgroundColor: t.navbarBg }}>
  <div className="flex items-center gap-2">
    <DoceLogoIcon />  {/* Real 3D "E" logo from /public/favicon.svg */}
    <span style={{ color: t.textPrimary }}>doce</span>
    <span style={{ color: t.textMuted }}>.dev</span>
    <AlphaBadge />
  </div>
  <div />  {/* Empty spacer - Queue/Settings removed */}
  <MoonIcon />
</nav>
```

**Important**: The logo should be the real 3D "E" logo from `/public/favicon.svg`, **not** a simplified icon.

### FileTree (`src/scenes/ide/FileTree.tsx`)
- Width: 320px (25% of right panel)
- **Critical styles**: `flexShrink: 0`, `minWidth: width`, `maxWidth: width` (prevents flex squishing)
- Background: Solid color (`#1a1d2e` dark, `#f9fafb` light), **NOT** semi-transparent
- Icons: ChevronRight (directories, rotates 90° when expanded), File (files)
- Node style: `rounded-md px-2 py-1`, indentation formula: `level * 12 + 8`

### CodeEditor (`src/scenes/ide/CodeEditor.tsx`)
- Header: `px-4 py-2 border-b bg-mutedBg50` with Monaco monospace font
- **Typed lines**: Must be sequential, not simultaneous
  - Calculate typing duration: `textLength * 2 frames`
  - Start next line AFTER previous line finishes
- Monaco theme: `vs-dark` (dark mode), `vs` (light mode)

## Build & Render Commands

### TypeScript Check
```bash
cd /Users/pablopunk/src/doce.dev/remotion
npx tsc --noEmit
```

### Render Videos
```bash
# Dark mode MP4
npx remotion render DoceShowcaseDark out/doce-showcase.mp4

# Light mode MP4
npx remotion render DoceShowcaseLight out/doce-showcase-light.mp4
```

### Render GIFs (for README)
```bash
# Dark GIF (half scale, 15fps)
npx remotion render DoceShowcaseDark out/doce-showcase.gif --image-format=png --scale=0.5 --every-nth-frame=2

# Light GIF
npx remotion render DoceShowcaseLight out/doce-showcase-light.gif --image-format=png --scale=0.5 --every-nth-frame=2
```

### Output Locations
After rendering:
1. **MP4s** go to both:
   - `remotion/out/` (source)
   - `www/assets/` (for website) - manually copy after render
2. **GIFs** stay in `remotion/out/` (for README)

**Copy command**:
```bash
cp remotion/out/doce-showcase.mp4 www/assets/
cp remotion/out/doce-showcase-light.mp4 www/assets/
```

## Troubleshooting

### Issue: FileTree is too narrow
**Cause**: Flexbox is shrinking the component
**Fix**: Add to FileTree container:
```typescript
style={{
  width,
  minWidth: width,
  maxWidth: width,
  flexShrink: 0,
  // ...
}}
```

### Issue: Two lines typing simultaneously
**Cause**: `typeStartFrame` values are too close
**Fix**: Calculate proper timing:
```typescript
// Line 1: starts at frame 30, text length 38 chars
// Duration: 38 * 2 = 76 frames
// Finishes: 30 + 76 = 106
// Line 2 should start at frame 110+ (with small gap)
```

### Issue: Theme colors don't match real app
**Cause**: Using outdated or hardcoded colors
**Fix**: 
1. Check `/src/styles/globals.css` for current oklch values
2. Update `theme.tsx` with converted RGB/hex values
3. Verify with actual UI in browser DevTools

### Issue: Animations not rendering
**Cause**: Using CSS transitions/animations instead of frame-based
**Fix**: Convert all animations to use `useCurrentFrame()`, `spring()`, or `interpolate()`

## Adding a New Scene

1. **Create scene file**: `src/scenes/SceneX.tsx`
2. **Use existing patterns**:
   ```typescript
   export const SceneX: React.FC = () => {
     const frame = useCurrentFrame();
     const { fps } = useVideoConfig();
     const t = useTheme();
     
     const entranceOpacity = spring({ frame, fps, config: { damping: 20 } });
     
     return (
       <AbsoluteFill style={{ backgroundColor: t.sceneBg, opacity: entranceOpacity }}>
         {/* content */}
       </AbsoluteFill>
     );
   };
   ```
3. **Add to timeline** in `DoceShowcase.tsx`:
   ```typescript
   <TransitionSeries.Sequence durationInFrames={90}>
     <SceneX />
   </TransitionSeries.Sequence>
   <TransitionSeries.Transition timing={fade({ durationInFrames: 10 })} />
   ```
4. **Update total duration** in both compositions (Root.tsx)
5. **Test render** before committing

## Design Consistency Checklist

Before considering a scene "complete":

- [ ] All colors use theme tokens (no hardcoded colors)
- [ ] Matches real UI from `/src/components/` exactly
- [ ] Uses real logo from `/public/favicon.svg`
- [ ] All animations use `useCurrentFrame()` (no CSS animations)
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
- [ ] Renders successfully for both dark and light modes
- [ ] File tree is visible and properly sized (if applicable)
- [ ] Text animations are sequential, not simultaneous (if applicable)
- [ ] No Queue/Settings nav links (intentionally removed for cleaner look)

## Tips for Future Agents

1. **Always reference real UI**: When in doubt, check the actual component source code in `/src/components/`
2. **Theme tokens are mandatory**: Never hardcode colors. Always use `t.propertyName`
3. **Test both modes**: Always render both dark and light compositions
4. **Frame math matters**: When sequencing animations, calculate exact frame counts
5. **FlexShrink is your enemy**: When setting explicit widths, also set `flexShrink: 0`
6. **Read the Remotion docs**: https://remotion.dev - especially for new animation patterns
7. **Use the remotion-best-practices skill**: Load this skill when working on animations
8. **Sequential vs parallel**: Be explicit about whether animations should overlap or follow each other

## Current State (Last Updated: Feb 2026)

- ✅ All scenes match real doce.dev UI
- ✅ Real 3D "E" logo implemented
- ✅ Provider logos (Anthropic A, OpenAI G) added to model selector
- ✅ Queue/Settings nav links removed for cleaner look
- ✅ FileTree properly sized and visible (320px, non-shrinking)
- ✅ Code editor typing is sequential (one line at a time)
- ✅ Deploy button follows real UI pattern (outline→spinner→filled)
- ✅ Both dark and light modes fully functional
- ✅ All outputs generated and copied to correct locations
