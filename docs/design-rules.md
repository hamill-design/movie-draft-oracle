# Movie Draft Design System Rules

## Design Philosophy

### Core Principles
- **Clarity First**: Every interface element should have a clear purpose and be immediately understandable
- **Consistency**: Reusable patterns and components across all features
- **Accessibility**: WCAG 2.1 AA compliance for inclusive design
- **Performance**: Lightweight, fast-loading interfaces that don't compromise user experience
- **Scalability**: Design system that grows with the product

### Brand Personality
- **Cinematic**: Inspired by movie culture without being overwhelming
- **Competitive**: Fantasy sports energy with clear winners and rankings
- **Social**: Community-focused design encouraging interaction
- **Premium**: Quality feel that justifies paid features

## Color System

### Brand Colors
```css
--brand-primary: 262 100% 52%;        /* #680AFF - Primary purple */
--brand-primary-foreground: 0 0% 100%; /* White text on primary */
--purple-200: 252 100% 85%;           /* #BCB2FF - Light purple accent */
--greyscale-blue-900: 240 8% 6%;      /* #0E0F0F - Dark background */
```

### Semantic Color Usage
- **Primary Actions**: Use `--brand-primary` for main CTAs and active states
- **Secondary Actions**: Use `--purple-200` for secondary buttons and highlights
- **Dark Surfaces**: Use `--greyscale-blue-900` for headers and dark backgrounds
- **Text Hierarchy**: Follow foreground/muted-foreground pattern for content

### Color Application Rules
1. **Never use direct colors** (e.g., `text-white`, `bg-black`) in components
2. **Always use semantic tokens** from the design system
3. **Maintain contrast ratios** of 4.5:1 minimum for normal text
4. **Use HSL format** for all color definitions
5. **Test in both light and dark modes** when applicable

## Typography System

### Font Families
- **Brockmann**: Primary font family for UI text and body content
  - Regular (400): General text and descriptions
  - Medium (500): Button labels and emphasized text
  - Semibold (600): Subheadings and important labels
  - Bold (700): Main headings and brand elements

- **Chaney**: Display font family for special elements
  - Regular: Decorative elements
  - Wide: Logo text and brand moments
  - Extended: Special headings
  - Ultra Extended: Hero text and major displays

### Typography Hierarchy
```css
/* Headings - Use Heading component */
h1: 2rem (32px) - Brockmann Bold - Page titles
h2: 1.5rem (24px) - Brockmann Semibold - Section headers
h3: 1.25rem (20px) - Brockmann Medium - Subsection headers
h4: 1.125rem (18px) - Brockmann Medium - Card titles

/* Body Text - Use Text component */
Large: 1.125rem (18px) - Brockmann Regular - Introductory text
Base: 1rem (16px) - Brockmann Regular - Standard body text
Small: 0.875rem (14px) - Brockmann Regular - Helper text
XSmall: 0.75rem (12px) - Brockmann Regular - Captions
```

### Typography Rules
1. **Use semantic components** (Heading, Text) instead of raw HTML elements
2. **Maintain consistent line heights** (1.2 for headings, 1.5 for body)
3. **Limit font weights** to defined system weights only
4. **Consider reading flow** and information hierarchy
5. **Test across devices** for readability

## Component Architecture

### Atomic Design Structure
```
atoms/
├── Button/          # All button variants and states
├── Input/           # Form input components
├── Icon/            # Icon wrapper component
└── Typography/      # Heading and Text components

molecules/
├── Form controls    # Input + Label combinations
├── Card components  # Content containers
└── Navigation items # Menu and nav components

organisms/
├── Headers          # AppHeader and section headers
├── Forms            # Complete form implementations
└── Data displays    # Tables, lists, grids

templates/
├── Page layouts     # Common page structures
└── Section layouts  # Reusable section patterns
```

### Component Design Rules
1. **Single Responsibility**: Each component should have one clear purpose
2. **Prop Interfaces**: Use TypeScript interfaces for all component props
3. **Variant System**: Use CVA for component variants and states
4. **Composition Over Configuration**: Favor composable components
5. **Default Props**: Provide sensible defaults for optional props

## Layout System

### Grid and Spacing
- **Base unit**: 4px (0.25rem) for consistent spacing
- **Common spacing**: 8px, 12px, 16px, 20px, 24px, 32px
- **Container max-width**: 1400px for main content areas
- **Responsive breakpoints**: sm(640px), md(768px), lg(1024px), xl(1280px), 2xl(1536px)

### Layout Patterns
- **Header**: Fixed height 80px (h-20) with brand and navigation
- **Main Content**: Flexible height with proper spacing from header
- **Sidebar**: 240px width (w-60) for desktop navigation
- **Cards**: Consistent padding (p-6) and border radius (rounded-lg)

## Interactive Elements

### Button System
```tsx
// Primary actions
<Button variant="default">Primary Action</Button>

// Secondary actions  
<Button variant="outline">Secondary Action</Button>

// Ghost/subtle actions
<Button variant="ghost">Ghost Action</Button>

// Premium features
<Button variant="premium">Premium Feature</Button>

// Hero/landing page actions
<Button variant="hero">Get Started</Button>
```

### Button Rules
1. **Use semantic variants** instead of custom styling
2. **Include loading states** for async actions
3. **Provide disabled states** with clear visual feedback
4. **Maintain consistent sizing** across similar actions
5. **Include keyboard navigation** support

### Interactive States
- **Hover**: Subtle color shift and/or shadow increase
- **Active**: Darker color or pressed effect
- **Focus**: Visible focus ring for keyboard navigation
- **Disabled**: Reduced opacity (50%) and no interaction
- **Loading**: Replace content with spinner, maintain size

## Responsive Design

### Mobile-First Approach
1. **Design for mobile** (320px+) first
2. **Progressive enhancement** for larger screens
3. **Touch targets** minimum 44px x 44px
4. **Readable text** without zooming (16px minimum)
5. **Accessible navigation** with proper touch zones

### Responsive Patterns
- **Stack to Grid**: Mobile stacked layouts become grids on desktop
- **Hide/Show**: Non-essential elements hidden on mobile
- **Navigation**: Hamburger menu on mobile, full nav on desktop
- **Typography**: Smaller scales on mobile, larger on desktop

## Accessibility Standards

### WCAG 2.1 AA Compliance
1. **Color Contrast**: 4.5:1 for normal text, 3:1 for large text
2. **Keyboard Navigation**: All interactive elements accessible via keyboard
3. **Screen Readers**: Proper ARIA labels and semantic HTML
4. **Focus Management**: Visible focus indicators and logical tab order
5. **Alternative Text**: Descriptive alt text for all images

### Implementation Rules
- **Use semantic HTML** elements when possible
- **Provide ARIA labels** for custom components
- **Test with screen readers** regularly
- **Ensure keyboard-only** navigation works
- **Include skip links** for main content

## Animation and Motion

### Motion Principles
- **Purposeful**: Animations should guide user attention or provide feedback
- **Subtle**: Avoid distracting or excessive motion
- **Fast**: Keep animations under 300ms for UI feedback
- **Respectful**: Honor user's reduced motion preferences

### Animation Types
```css
/* Micro-interactions */
transition: all 0.2s ease-out;

/* Page transitions */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* Loading states */
animation: spin 1s linear infinite;
```

## Error Prevention and Handling

### Form Validation
- **Real-time validation** for immediate feedback
- **Clear error messages** explaining how to fix issues
- **Success states** to confirm correct input
- **Consistent styling** across all form elements

### Error States
- **Inline errors**: Show errors next to relevant form fields
- **Page-level errors**: Use toast notifications for system errors
- **Empty states**: Provide helpful guidance when no data exists
- **Loading states**: Show progress for long-running operations