# Movie Draft Technology Stack

## Frontend Technologies

### Core Framework
- **React 18.3.1**: Latest React with concurrent features and improved performance
- **TypeScript**: Full type safety across the application
- **Vite**: Fast build tool and development server with HMR

### UI Framework & Styling
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Radix UI**: Headless, accessible component primitives
- **Shadcn/ui**: Pre-built components built on Radix UI
- **Class Variance Authority (CVA)**: Component variant management
- **Tailwind Merge**: Conflict resolution for Tailwind classes

### Routing & Navigation
- **React Router Dom 6.26.2**: Client-side routing with modern features
- **Dynamic imports**: Code splitting for optimal performance

### State Management & Data Fetching
- **React Query (TanStack Query) 5.56.2**: Server state management and caching
- **React Hook Form 7.53.0**: Performant form handling with validation
- **Zod 3.23.8**: TypeScript-first schema validation

### Real-time Features
- **Supabase Realtime**: WebSocket connections for live draft updates
- **React context**: Local state management for UI state

## Backend Technologies

### Backend as a Service
- **Supabase 2.50.2**: Complete backend solution
  - PostgreSQL database with automatic APIs
  - Authentication and user management
  - Real-time subscriptions
  - Edge Functions for custom logic
  - File storage and CDN

### Database
- **PostgreSQL**: Robust relational database with JSON support
- **Row Level Security (RLS)**: Fine-grained access control
- **Database Functions**: Stored procedures for complex operations
- **Triggers**: Automated data processing and validation

### Authentication
- **Supabase Auth**: Built-in authentication system
- **Magic Links**: Passwordless authentication option
- **Social Providers**: OAuth integration capabilities
- **JWT Tokens**: Secure session management

## Development Tools

### Build & Development
- **Bun**: Fast JavaScript runtime and package manager
- **ESLint**: Code linting and style enforcement
- **PostCSS**: CSS processing and optimization
- **TypeScript Compiler**: Type checking and compilation

### Code Quality
- **Prettier**: Code formatting (configured via ESLint)
- **TypeScript strict mode**: Enhanced type checking
- **Import/export validation**: Consistent module structure

## Third-Party Integrations

### Movie Data
- **The Movie Database (TMDb) API**: Movie and actor information
- **Custom data enrichment**: Additional scoring and classification data

### Analytics & Monitoring
- **Web Vitals**: Performance monitoring
- **Error tracking**: Runtime error collection and reporting

### Advertising
- **Google AdSense**: Monetization through display advertising
- **Custom ad components**: Integrated advertising system

## Font System

### Typography
- **Brockmann Font Family**: Primary brand typography
  - Regular, Medium, Semibold, Bold weights
  - Web font optimization (WOFF2, WOFF, TTF)
- **Chaney Font Family**: Display and accent typography
  - Regular, Wide, Extended, Ultra Extended variants
- **Font loading optimization**: Preload critical fonts

## Asset Management

### Images & Media
- **SVG Icons**: Scalable vector graphics for UI elements
- **Lucide React**: Comprehensive icon library
- **Image optimization**: Automatic format selection and compression
- **Responsive images**: Multiple sizes for different devices

### Static Assets
- **Vite asset handling**: Optimized bundling and caching
- **Public folder**: Direct asset serving for static files
- **Font subsetting**: Reduced font file sizes

## Deployment & Infrastructure

### Hosting
- **Lovable Platform**: Integrated hosting and deployment
- **CDN**: Global content delivery for optimal performance
- **SSL/HTTPS**: Secure connections by default

### Environment Management
- **Environment variables**: Configuration management
- **Development/Production builds**: Optimized builds for each environment

## Performance Optimizations

### Bundle Optimization
- **Code splitting**: Route-based and component-based splitting
- **Tree shaking**: Elimination of unused code
- **Module federation**: Shared dependencies optimization

### Runtime Performance
- **React.memo**: Component memoization for expensive renders
- **useMemo/useCallback**: Hook optimization for complex calculations
- **Lazy loading**: On-demand component and route loading

### Caching Strategy
- **React Query caching**: Intelligent server state caching
- **Browser caching**: Optimized cache headers
- **Service worker**: Offline capability and background sync

## Security Considerations

### Data Protection
- **Row Level Security**: Database-level access control
- **Input validation**: Zod schemas for all user inputs
- **XSS prevention**: React's built-in protections
- **CSRF protection**: Token-based request validation

### Authentication Security
- **JWT token management**: Secure token storage and refresh
- **Password hashing**: Bcrypt with appropriate rounds
- **Rate limiting**: API endpoint protection
- **Audit logging**: Security event tracking