# Design System Rules - Movie Draft Game

## Color System

### Semantic Tokens
All colors must use HSL values and semantic tokens from the design system. **Never use direct colors like `text-white`, `bg-black`, etc.**

```css
/* Correct Usage */
.button {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

/* Incorrect Usage */
.button {
  background: #000000;
  color: white;
}
```

### Color Palette Structure
- **Primary**: Main brand colors and CTAs
- **Secondary**: Supporting brand colors
- **Accent**: Highlight and emphasis colors
- **Muted**: Subtle backgrounds and borders
- **Destructive**: Error and warning states
- **Success**: Positive actions and feedback

### Dark/Light Mode Support
All components must work in both themes:
- Use CSS variables for automatic theme switching
- Test components in both modes
- Ensure proper contrast ratios
- Handle image and icon theming

## Typography

### Font Hierarchy
- **Display**: Large headlines and hero text
- **Heading**: Section titles (h1-h6)
- **Body**: Regular content text
- **Caption**: Small supporting text
- **Code**: Monospace for technical content

### Font Scale
```css
/* Predefined scale - use these classes */
.text-xs    /* 0.75rem */
.text-sm    /* 0.875rem */
.text-base  /* 1rem */
.text-lg    /* 1.125rem */
.text-xl    /* 1.25rem */
.text-2xl   /* 1.5rem */
.text-3xl   /* 1.875rem */
.text-4xl   /* 2.25rem */
```

## Component Design Principles

### Reusability First
- Create variants instead of custom styles
- Use composition over customization
- Design for multiple contexts
- Document all props and variants

### Shadcn Component Customization
```tsx
// Correct: Create variants in the component
const buttonVariants = cva(
  "base-styles",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        premium: "bg-gradient-primary text-white",
      }
    }
  }
)

// Incorrect: Custom styles in usage
<Button className="bg-blue-500 text-white border-blue-600">
```

### Responsive Design
- Mobile-first approach
- Use Tailwind responsive breakpoints
- Test on multiple screen sizes
- Consider touch targets on mobile

## Layout Guidelines

### Spacing System
Use consistent spacing scale:
```css
/* Standard spacing units */
.space-1  /* 0.25rem */
.space-2  /* 0.5rem */
.space-4  /* 1rem */
.space-6  /* 1.5rem */
.space-8  /* 2rem */
.space-12 /* 3rem */
.space-16 /* 4rem */
```

### Grid and Flexbox
- Use CSS Grid for two-dimensional layouts
- Use Flexbox for one-dimensional layouts
- Leverage Tailwind's grid and flex utilities
- Maintain consistent gutters and gaps

## Animation and Interactions

### Transition Guidelines
```css
/* Standard transitions */
--transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
--transition-fast: all 0.15s ease-out;
--transition-slow: all 0.5s ease-in-out;
```

### Animation Principles
- Use animations to provide feedback
- Keep animations subtle and purposeful
- Respect user's motion preferences
- Provide loading states for async operations

### Micro-interactions
- Hover states for interactive elements
- Focus states for accessibility
- Loading spinners for async actions
- Success/error feedback animations

## Accessibility Requirements

### Color Contrast
- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text
- Test with color blindness simulators
- Don't rely on color alone for information

### Keyboard Navigation
- All interactive elements must be focusable
- Visible focus indicators
- Logical tab order
- Keyboard shortcuts for power users

### Screen Reader Support
- Semantic HTML elements
- Proper ARIA labels and roles
- Alt text for images
- Descriptive link text

## Component Patterns

### Button Hierarchy
```tsx
// Primary action
<Button variant="default">Primary Action</Button>

// Secondary action
<Button variant="secondary">Secondary</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// Subtle action
<Button variant="ghost">Cancel</Button>
```

### Form Design
- Clear labels and instructions
- Inline validation messages
- Proper error states
- Loading states for submissions

### Card Components
- Consistent padding and margins
- Clear visual hierarchy
- Appropriate shadows and borders
- Responsive behavior

## Error Prevention

### Common Mistakes to Avoid
1. **Direct Color Usage**: Always use semantic tokens
2. **Inconsistent Spacing**: Use the spacing scale
3. **Missing Dark Mode**: Test all components in both themes
4. **Poor Contrast**: Ensure accessibility compliance
5. **Inline Styles**: Use component variants instead

### Code Review Checklist
- [ ] Uses semantic color tokens
- [ ] Works in dark and light modes
- [ ] Responsive on all screen sizes
- [ ] Accessible keyboard navigation
- [ ] Proper TypeScript types
- [ ] Follows component patterns
- [ ] Has appropriate loading states
- [ ] Handles error conditions

## Performance Considerations

### CSS Optimization
- Use Tailwind's purge functionality
- Minimize custom CSS
- Leverage component variants
- Avoid deep nesting

### Component Performance
- Use React.memo for expensive components
- Implement proper key props for lists
- Avoid inline object creation in render
- Use callback memoization appropriately