# Technology Stack

## Frontend Technologies

### Core Framework
- **React 18.3.1** - Component-based UI library
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Reusable component library
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **Custom Design System** - Semantic tokens and theming

### State Management
- **React Hooks** - Built-in state management
- **Custom Hooks** - Encapsulated business logic

### Routing
- **React Router DOM 6.26.2** - Client-side routing
- **Nested routes** for complex navigation
- **Protected routes** for authenticated sections

## Backend Technologies

### Database & Backend
- **Supabase** - Backend-as-a-Service platform
- **PostgreSQL** - Relational database
- **Row Level Security (RLS)** - Database-level authorization
- **Database Functions** - Custom PostgreSQL functions

### Authentication
- **Supabase Auth** - User authentication system
- **Guest Sessions** - Anonymous user support
- **Email Invitations** - Participant recruitment

### Real-time Features
- **Supabase Realtime** - WebSocket connections
- **Presence API** - User presence tracking
- **Broadcasting** - Real-time message delivery

## External APIs

### Movie Data
- **TMDB (The Movie Database)** - Movie information and metadata
- **Person Search API** - Actor/actress lookup
- **Movie Search API** - Theme-based movie filtering

### Other Services
- **Email Service** - Draft invitations (via Supabase)

## Development Tools

### Build & Development
- **Vite** - Build tool and dev server
- **ESLint** - Code linting
- **TypeScript Compiler** - Type checking
- **PostCSS** - CSS processing

### Package Management
- **npm/yarn** - Dependency management
- **Package.json** - Project configuration

### Code Quality
- **TypeScript** - Type safety
- **ESLint Config** - Code style enforcement
- **Component Architecture** - Modular design

## Key Dependencies

### UI & Styling
```json
{
  "@radix-ui/*": "Various versions",
  "tailwindcss": "Latest",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.5.2"
}
```

### Backend Integration
```json
{
  "@supabase/supabase-js": "^2.50.2",
  "@tanstack/react-query": "^5.56.2"
}
```

### Utilities
```json
{
  "react-router-dom": "^6.26.2",
  "react-hook-form": "^7.53.0",
  "zod": "^3.23.8",
  "date-fns": "^3.6.0"
}
```