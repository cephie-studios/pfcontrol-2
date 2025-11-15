# Z-Index Guide for PFControl

This document defines the standardized z-index system for the application to prevent layering conflicts and ensure proper visual hierarchy.

## Z-Index Scale

### Body Background (Auto/0)
- **body element**: `background-color: #1a1a1a` at z-index: auto (0)
  - This is the default dark background for the entire app
  - Elements must be at z-index: 1 or higher to appear above this

### Content Layer (1-999)
- **1-9**: Decorative overlays and page-level effects
  - `1`: Holiday effects (snow, animations) - above body background
  - `5`: Slider controls (internal z-index)
- **10-99**: Interactive elements within content
  - `10`: Forms, cards, and content containers (above holiday effects)
  - `10`: Slider thumbs (internal z-index)
  - `40`: Toolbar positioning helpers
  - `48`: Chart drawer
  - `49`: Chart drawer header
  - `50`: Reserved
- **100-999**: Floating UI elements
  - `100`: Toast notifications, Music player control
  - `998`: Toolbar dropdowns and tooltips
  - `999`: Reserved

### Overlay Layer (1000-9999)
- **1000-4999**: Page overlays and dialogs
  - `1000`: Page-level modals (Settings, Home, Flights, Create pages)
- **5000-8999**: Reserved for future overlays
- **9000-9999**: Critical overlays
  - `9997`: Flight table dropdown backdrops
  - `9998`: Flight table dropdown content, generic dropdowns
  - `9999`: Navbar (top navigation bar)

### Top Layer (10000+)
- **10000+**: Always-on-top elements
  - `10000`: ACARS sidebars (Chat, Contact, ATIS)
  - `50000`: Critical system modals (use z-50 in Tailwind)

## Component Reference

### Holiday Effects (Content Layer)
- **SnowEffect.tsx**: `z-index: 1` (canvas)
- **HolidayAnimations.tsx**: `z-index: 1` (snow drift SVG and snowman)
- **Purpose**: Above body background but behind all interactive UI elements

### Forms & Interactive Content (Content Layer)
- **Submit.tsx**: `z-10` (form containers, success messages, wind display)
- **Purpose**: Interactive content that should appear above holiday effects

### Navigation
- **Navbar.tsx**: `z-[9999]` (Tailwind class)
- **Purpose**: Always visible at top of viewport

### Modals & Overlays
- **Modal.tsx**: `z-50` (Tailwind = 50000)
  - Standard modal overlay and content
- **Page Modals** (Settings, Home, Flights, Create): `z-index: 1000`
  - Page-specific modal overlays

### Sidebars & Tools
- **ChatSidebar.tsx**: `z-index: 10000`
- **ContactAcarsSidebar.tsx**: `z-index: 10000`
- **ATIS.tsx**: `z-index: 10000`
- **ChartDrawer.tsx**:
  - Container: `z-index: 48`
  - Header: `z-index: 49`
- **Toolbar.tsx**:
  - Position helper: `z-index: 40`
  - Dropdown: `z-index: 998`

### Dropdowns & Tooltips
- **Dropdown.tsx**: `z-index: 9998`
- **Flight Tables** (Arrivals/Departures):
  - Backdrop: `z-index: 9997`
  - Dropdown: `z-index: 9998`
- **Chat Tooltips**: `z-[9999]`

### Notifications
- **Toast.tsx**: `z-[100]` (Tailwind class)

### Settings UI Elements
- **SoundSettings.tsx**: Internal slider controls
  - Slider track: `z-index: 5`
  - Slider thumb: `z-index: 10`
- **LayoutSettings.tsx**: Internal slider controls
  - Slider track: `z-index: 5`
  - Slider thumb: `z-index: 10`
- **HolidayThemeSettings.tsx**: Internal slider controls
  - Slider track: `z-index: 5`
  - Slider thumb: `z-index: 10`

## Usage Guidelines

### When to Use Each Layer

1. **Body Background (0/auto)**
   - Default page backgrounds (sections with bg-black, bg-zinc-900, etc.)
   - These should NOT have explicit z-index values to remain at layer 0

2. **Content Layer (1-999)**
   - Normal page content (0)
   - In-content interactive elements (1-99)
   - Floating UI tied to specific content (100-999)

3. **Overlay Layer (1000-9999)**
   - Page-level modals and dialogs (1000-4999)
   - Navigation and critical UI (9000-9999)

4. **Top Layer (10000+)**
   - Always-visible sidebars
   - System-level modals
   - Emergency/critical notifications

### Visual Layer Order (Bottom to Top)

```
[0] Body background (#1a1a1a)
[0] Page sections with bg-black, bg-zinc-900 (no z-index)
[1] Holiday effects (snow, snowman, animations)
[10] Forms, cards, and interactive content (above holiday effects)
[10-99] Other interactive content elements
[100-999] Tooltips and floating UI
[1000-9999] Modals, dropdowns, navigation
[10000+] Sidebars and top-layer modals
```

### Best Practices

1. **Use named constants**: Define z-index values in this document and reference them in comments
2. **Avoid arbitrary values**: Use values from this scale
3. **Group related elements**: Keep related UI elements in the same z-index range
4. **Leave gaps**: Don't use every number - leave room for future additions
5. **Document exceptions**: If you need to deviate from this system, document why

### Tailwind Z-Index Classes

Tailwind provides these z-index utilities:
- `z-0` = 0
- `z-10` = 10
- `z-20` = 20
- `z-30` = 30
- `z-40` = 40
- `z-50` = 50 (50000 in some contexts)
- `z-auto` = auto
- `z-[value]` = custom value (e.g., `z-[9999]`)

## Migration Notes

When updating z-index values:
1. Check this document for the correct layer
2. Update the component
3. Test with other overlapping components
4. Update this document if adding new patterns

## Common Issues & Solutions

### Issue: Holiday effects not visible
**Solution**: Holiday effects must be at `z-index: 1` or higher to appear above the body background (`#1a1a1a` at z-index: 0). Page sections should NOT have explicit z-index values to remain at layer 0.

### Issue: Holiday effects appearing above UI elements
**Solution**: Ensure holiday effects use `z-index: 1` and interactive elements use z-index: 10 or higher

### Issue: Modals hidden behind navigation
**Solution**: Navigation should be z-9999, modals should be z-50000 (z-50)

### Issue: Dropdowns cut off by parent containers
**Solution**: Use portal rendering or ensure parent has lower z-index

### Issue: Multiple overlays fighting for top position
**Solution**: Use proper layer from this guide, don't just add +1

## Testing Checklist

When changing z-index values, test these scenarios:
- [ ] Holiday effects visible but behind all UI
- [ ] Navbar always on top (except modals)
- [ ] Modals cover everything except other modals
- [ ] Dropdowns appear above their trigger elements
- [ ] Tooltips readable and not obscured
- [ ] Sidebars accessible and properly layered
- [ ] Toast notifications visible
- [ ] No unintended layering conflicts

---

**Last Updated**: 2025-11-14
**Maintainer**: Development Team
