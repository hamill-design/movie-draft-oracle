# Design System Rules - Movie Draft App

## Color System (HSL Format)
```css
:root {
  --primary: 217 91% 60%;           /* Blue primary */
  --secondary: 210 40% 8%;          /* Dark secondary */
  --success: 142 71% 45%;           /* Green for success */
  --warning: 38 92% 50%;            /* Orange for warnings */
  --destructive: 0 84% 60%;         /* Red for errors */
  --background: 0 0% 100%;          /* White background */
  --foreground: 240 10% 3.9%;      /* Dark text */
}
```

## Design Principles
- **NEVER** use direct colors (text-white, bg-black)
- **ALWAYS** use semantic design tokens
- Maintain WCAG 2.1 AA contrast ratios
- Use HSL format for all color definitions

## Typography Scale
- **Display**: 2.25rem - Hero headings
- **H1**: 1.875rem - Page titles  
- **H2**: 1.5rem - Section titles
- **Body**: 1rem - Default text
- **Small**: 0.875rem - Captions

## Spacing System
- Base unit: 4px (0.25rem)
- Follow 8px grid system
- Use rem units for scalability

## Component Standards
- Border radius: 8px for cards
- Minimum touch target: 44px × 44px
- Consistent hover and focus states
- Loading states with animations