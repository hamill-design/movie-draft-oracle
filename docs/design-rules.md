# Design System Rules

## Color System

### Semantic Token Usage
- **CRITICAL**: Never use direct colors like `text-white`, `bg-black`, `text-gray-500`
- **ALWAYS** use semantic tokens from the design system
- **ALL** colors must be in HSL format in the CSS variables

### Color Tokens
```css
/* Primary colors */
--primary: hsl(value);
--primary-foreground: hsl(value);

/* Secondary colors */
--secondary: hsl(value);
--secondary-foreground: hsl(value);

/* Background colors */
--background: hsl(value);
--foreground: hsl(value);

/* Muted colors */
--muted: hsl(value);
--muted-foreground: hsl(value);

/* Accent colors */
--accent: hsl(value);
--accent-foreground: hsl(value);
```

## Component Design Principles

### Shadcn/UI Customization
- **Customize** shadcn components rather than creating from scratch
- **Create variants** for different use cases
- **Maintain consistency** across all components
- **Use the variant system** for component states

## Dark/Light Mode

### Theme Consistency
- **Support both modes** in all components
- **Test contrast ratios** in both themes
- **Use CSS variables** for theme switching
- **Avoid hardcoded colors** that break in one mode

### Common Mistakes to Avoid
```css
/* ❌ WRONG - Breaks in dark mode */
.component {
  background: white;
  color: black;
}

/* ✅ CORRECT - Works in both modes */
.component {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

## Best Practices

### Do's
- ✅ Use semantic tokens exclusively
- ✅ Customize shadcn components with variants
- ✅ Test in both light and dark modes
- ✅ Maintain consistent spacing
- ✅ Use HSL color values in CSS variables

### Don'ts
- ❌ Never use direct color classes in components
- ❌ Don't hardcode colors in CSS
- ❌ Don't create components from scratch if shadcn has them
- ❌ Don't ignore accessibility requirements
- ❌ Don't break the semantic token system