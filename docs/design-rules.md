# Design System Rules

## Color Philosophy
- **HSL Color Space**: All colors defined in HSL format for consistency
- **Semantic Tokens**: Use meaningful names, not direct color values
- **Dark/Light Mode**: Automatic theme switching support
- **Accessibility**: WCAG AA contrast ratios maintained

## Color Usage Rules

### ❌ NEVER Use Direct Colors
```css
/* DON'T */
.text-white
.bg-black
.border-blue-500
.text-red-600
```

### ✅ ALWAYS Use Semantic Tokens
```css
/* DO */
.text-foreground
.bg-background
.border-border
.text-destructive
```

## Design Token Categories

### Core Colors
- `--background`: Main background color
- `--foreground`: Primary text color
- `--muted`: Subdued background
- `--muted-foreground`: Subdued text
- `--border`: Border colors
- `--input`: Input field backgrounds

### Semantic Colors
- `--primary`: Brand colors for main actions
- `--secondary`: Secondary actions and accents
- `--destructive`: Error states and warnings
- `--success`: Success states and confirmations

### Component-Specific
- `--card`: Card backgrounds
- `--popover`: Overlay backgrounds
- `--accent`: Highlight and hover states

## Typography Rules
- Use semantic text classes: `text-foreground`, `text-muted-foreground`
- Consistent font sizing with Tailwind scale
- Proper line height for readability
- Font weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

## Spacing & Layout
- Use Tailwind spacing scale consistently
- 4px base unit (space-1 = 4px)
- Consistent padding/margin patterns
- Responsive design mobile-first

## Component Design Rules

### Variants over Custom Styles
```tsx
// DON'T - Custom styles in components
<Button className="bg-white text-black hover:bg-gray-100">

// DO - Define variants in design system
<Button variant="outline">
```

### Custom Variant Definition
```tsx
// In button.tsx
const buttonVariants = cva(
  "...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      }
    }
  }
)
```

## Animation Guidelines
- Use consistent timing functions
- Smooth transitions for state changes
- Respect user preferences (prefers-reduced-motion)
- Subtle animations that enhance UX

## Responsive Design
- Mobile-first approach
- Consistent breakpoints
- Touch-friendly interactive elements
- Readable text on all screen sizes

## Accessibility Requirements
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance
- Focus indicators
- Alternative text for images

## Component Architecture
- Single responsibility principle
- Composable components
- Consistent prop interfaces
- Proper TypeScript types

## File Organization
- Components in feature-based folders
- Shared UI components in `/ui` folder
- Custom hooks in `/hooks` folder
- Utilities in `/lib` folder

## Performance Considerations
- Lazy loading for large components
- Memoization for expensive calculations
- Optimized re-renders
- Minimal bundle size impact