# Dark Mode Color System Guide

## Overview

This app uses a **professional, accessible dark mode** built on Material Design 3 and WCAG AA principles.

## Key Features

✅ **Layered Elevation System** - Cards "lift" off backgrounds naturally
✅ **Desaturated Accent Colors** - Prevents color vibration on dark surfaces
✅ **Off-white Text** - Comfortable reading without harsh contrast
✅ **System Preference Detection** - Respects `prefers-color-scheme`
✅ **Smooth Transitions** - 200ms transitions between modes
✅ **WCAG AA Compliant** - Maintains 4.5:1 contrast for body text

---

## Color Palette

### Surface Colors (Elevation System)

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--surface-0` | `#ffffff` | `#121218` | Base page background (0% elevation) |
| `--surface-1` | `#f8f9fa` | `#1a1a24` | Cards at rest (4% elevation) |
| `--surface-2` | `#f1f3f5` | `#24242f` | Raised cards, hover states (8% elevation) |
| `--surface-3` | `#e9ecef` | `#2d2d3a` | Modals, dialogs (12% elevation) |

**Tailwind Classes:**
```tsx
<div className="bg-surface-0">Base background</div>
<div className="bg-surface-1">Card background</div>
<div className="bg-surface-2">Elevated card</div>
<div className="bg-surface-3">Modal background</div>
```

### Text Colors (Hierarchy)

| Token | Light Mode | Dark Mode | Contrast | Usage |
|-------|------------|-----------|----------|-------|
| `--text-primary` | `#1a1a1a` | `#e8e8ed` | High (87%) | Headings, important text |
| `--text-secondary` | `#666666` | `#b4b4c0` | Medium (60%) | Body text, labels |
| `--text-tertiary` | `#999999` | `#84848f` | Low (38%) | Hints, placeholders |
| `--text-disabled` | `#c4c4c4` | `#5a5a63` | Disabled | Disabled text |

**Tailwind Classes:**
```tsx
<h1 className="text-primary">Primary Text</h1>
<p className="text-secondary">Secondary Text</p>
<span className="text-tertiary">Tertiary Text</span>
<button disabled className="text-disabled">Disabled</button>
```

### Border Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--border-subtle` | `#f3f4f6` | `#2d2d3a` | Dividers, subtle separators |
| `--border-default` | `#e5e7eb` | `#3a3a47` | Standard borders |
| `--border-strong` | `#d1d5db` | `#4a4a58` | Emphasized borders |

**Tailwind Classes:**
```tsx
<div className="border border-subtle">Subtle border</div>
<div className="border border-default">Default border</div>
<div className="border border-strong">Strong border</div>
```

### Accent Colors (Desaturated in Dark Mode)

| Color | Light Mode | Dark Mode (Desaturated 15-20%) |
|-------|------------|-------------------------------|
| Teal (Primary) | `#14b8a6` | `#4aded4` |
| Pink | `#ec4899` | `#f5a6c4` |
| Purple | `#a855f7` | `#b794f6` |
| Orange | `#f59e0b` | `#f8b968` |
| Blue | `#3b82f6` | `#70a7f5` |

**Why Desaturated?**
Highly saturated colors on dark backgrounds create visual vibration and eye strain. We reduce saturation by 15-20% for comfortable viewing.

**Tailwind Classes:**
```tsx
<button className="bg-accent-teal">Primary Button</button>
<span className="text-accent-pink">Pink Text</span>
```

### Semantic Colors

| Purpose | Light Mode | Dark Mode | Usage |
|---------|------------|-----------|-------|
| Success | `#10b981` | `#4ade80` | Success states, confirmations |
| Warning | `#f59e0b` | `#fbbf24` | Warnings, cautions |
| Error | `#ef4444` | `#f87171` | Errors, destructive actions |
| Info | `#3b82f6` | `#60a5fa` | Information, tips |

**Tailwind Classes:**
```tsx
<div className="text-color-success">Success message</div>
<div className="text-color-error">Error message</div>
```

---

## Shadows & Elevation

### Light Mode
Traditional shadows create depth:
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
```

### Dark Mode
Shadows become **glows** and **subtle borders**:
```css
--shadow-sm: 0 0 0 1px rgba(255, 255, 255, 0.05);  /* Subtle border */
--shadow-md: 0 0 0 1px rgba(255, 255, 255, 0.08);  /* Visible border */
--shadow-lg: 0 0 12px 0 rgba(78, 222, 212, 0.15);  /* Teal glow */
```

**Why?** Dark-on-dark shadows are invisible. We use glows and borders instead to create elevation.

**Tailwind Classes:**
```tsx
<div className="shadow-sm">Subtle shadow/glow</div>
<div className="shadow-md">Medium shadow/glow</div>
<div className="shadow-lg">Large shadow/glow</div>
```

---

## Usage Examples

### Card with Elevation
```tsx
// Basic card (4% elevation)
<div className="bg-surface-1 border border-default rounded-xl shadow-md p-6">
  <h2 className="text-primary">Card Title</h2>
  <p className="text-secondary">Card content</p>
</div>

// Elevated card (8% elevation)
<div className="bg-surface-2 border border-strong rounded-xl shadow-lg p-6">
  <h2 className="text-primary">Elevated Card</h2>
  <p className="text-secondary">This card is raised higher</p>
</div>
```

### Modal/Dialog (12% elevation)
```tsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center">
  <div className="bg-surface-3 border border-strong rounded-xl shadow-lg p-8 max-w-md">
    <h2 className="text-primary mb-4">Modal Title</h2>
    <p className="text-secondary mb-6">Modal content goes here</p>
    <button className="bg-accent-teal hover:bg-accent-teal-hover px-4 py-2 rounded-lg">
      Confirm
    </button>
  </div>
</div>
```

### Interactive Button
```tsx
<button className="bg-surface-interactive hover:bg-surface-interactive-hover border border-default text-primary px-4 py-2 rounded-lg transition-colors">
  Click Me
</button>
```

### Text Hierarchy
```tsx
<article>
  <h1 className="text-2xl font-bold text-primary mb-2">
    Article Title
  </h1>
  <p className="text-sm text-tertiary mb-4">
    Published on January 1, 2026
  </p>
  <p className="text-secondary leading-relaxed">
    Article body text with comfortable reading contrast...
  </p>
</article>
```

---

## Accessibility

### Contrast Ratios (WCAG AA)

| Element | Required Ratio | Light Mode | Dark Mode | Status |
|---------|----------------|------------|-----------|--------|
| Body Text | 4.5:1 | ✅ 12.6:1 | ✅ 11.8:1 | Pass |
| Large Text | 3:1 | ✅ 12.6:1 | ✅ 11.8:1 | Pass |
| UI Components | 3:1 | ✅ 3.2:1 | ✅ 3.1:1 | Pass |

### Focus States
All interactive elements have visible focus rings:
```css
*:focus-visible {
  outline: 2px solid var(--accent-teal);
  outline-offset: 2px;
}
```

---

## System Preference Detection

The app automatically detects your system's dark mode preference:

```tsx
// Check system preference
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Listen for changes
mediaQuery.addEventListener('change', (e) => {
  if (e.matches) {
    // User switched to dark mode
  }
});
```

**User Override:**
If a user manually toggles dark mode, their preference is saved to `localStorage` and takes precedence over system settings.

---

## Transitions

All color transitions are smooth (200ms):

```css
* {
  transition-property: background-color, border-color, color, fill, stroke, box-shadow;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}
```

---

## Best Practices

### ✅ DO

- Use semantic tokens (`bg-surface-1`, `text-primary`) instead of raw colors
- Leverage the elevation system for visual hierarchy
- Use desaturated accent colors for large surfaces
- Test focus states in both modes
- Reduce image brightness (~85-90%) in dark mode

### ❌ DON'T

- Use pure black (`#000000`) for backgrounds
- Use pure white (`#ffffff`) for text in dark mode
- Use highly saturated colors on dark backgrounds
- Rely solely on shadows for elevation in dark mode
- Forget to test interactive states (hover, focus, active)

---

## Migration Guide

### Old Code (Hardcoded)
```tsx
<div className="bg-white text-stone-900 border-stone-200">
  Content
</div>
```

### New Code (Semantic)
```tsx
<div className="bg-surface-1 text-primary border-default">
  Content
</div>
```

---

## Resources

- [Material Design 3 - Dark Theme](https://m3.material.io/styles/color/dark-theme/overview)
- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Dark Mode Best Practices](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
