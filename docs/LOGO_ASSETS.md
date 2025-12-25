# Logo Assets

Master logo design: `public/icon.svg` (1080×1080px)

## Generated Variants

All PNG files are exported at 2x scale (retina) for optimal quality on high-DPI displays.

### Core UI Sizes
- **icon-16.png** (32×32px) - Nav links, small UI elements
- **icon-20.png** (40×40px) - Navbar branding, buttons
- **icon-32.png** (64×64px) - Favicon, icon buttons
- **icon-80.png** (160×160px) - Chat message avatars

### Extended Sizes
- **icon-64.png** (128×128px) - Apple touch icons, larger favicon
- **icon-128.png** (256×256px) - Social media thumbnails, high-res displays
- **icon-256.png** (512×512px) - Further upscaling
- **icon-512.png** (1024×1024px) - Master export size

## Vector Format
- **icon.svg** (1080×1080px) - Master vector file, transparent background
- **favicon.svg** (1080×1080px) - Symlink to icon.svg, referenced in HTML

## Design Specifications
- **Shape**: Square (1:1 aspect ratio)
- **Background**: Transparent
- **Colors**: Fixed (grayscale + white, no theme variants)
- **Style**: Isometric "d" lettermark

## Usage in App
- Favicon: `src/layouts/AppLayout.astro` → `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`
- Future integration: Components can reference specific sizes from `/public/icon-*.png`
