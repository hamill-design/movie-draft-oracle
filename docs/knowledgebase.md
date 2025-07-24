# Movie Draft App - Knowledgebase

## Overview
A React-based movie drafting application that allows users to create fantasy drafts with different themes (years, actors, general movies) and categories. Users can draft movies competitively in single-player or multiplayer formats.

## Core Features

### Draft Types
1. **Single Player Drafts**: Quick drafts with AI/simulated opponents
2. **Multiplayer Drafts**: Real-time drafts with multiple human participants

### Draft Themes
1. **Year-based**: Draft movies from specific years (e.g., 2020, 1990s)
2. **Actor-based**: Draft movies featuring specific actors (e.g., "Tom Hanks movies")
3. **General**: Draft from popular movie collections

### Draft Categories
Players draft movies to fill specific categories like:
- Action/Adventure
- Drama/Romance
- Comedy
- Blockbusters (minimum $50M budget)
- Academy Award nominees/winners
- Decade-specific (2010s, 2020s, etc.)

## Technical Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling with custom design system
- **Shadcn/ui** components for consistent UI
- **React Router** for navigation
- **React Hook Form** with Zod validation

### Backend & Database
- **Supabase** for backend services
  - PostgreSQL database with Row Level Security (RLS)
  - Real-time subscriptions for multiplayer features
  - Authentication (email/password + guest sessions)
  - Edge Functions for external API integrations

### Data Sources
- **TMDB (The Movie Database)** API for movie data
- **OMDB** API for additional movie metadata
- Custom caching layer for performance

## Database Schema

### Core Tables
- `drafts`: Draft configurations and state
- `draft_participants`: Multiplayer draft participants 
- `draft_picks`: Individual movie selections
- `guest_sessions`: Anonymous user sessions
- `profiles`: User profile data
- `oscar_cache`: Cached awards data

### Authentication Model
- Supports both authenticated users and guest sessions
- Guest sessions allow anonymous participation with optional account creation
- RLS policies ensure data access control

## Key Components

### Draft Flow
1. **Draft Creation**: Configure theme, categories, participants
2. **Participant Joining**: Email invites or invite codes
3. **Turn Management**: Randomized turn order, real-time updates
4. **Movie Selection**: Search, filter, and pick movies
5. **Draft Completion**: Final results and scoring

### Real-time Features
- Live participant status updates
- Turn notifications
- Pick broadcasts
- Draft state synchronization

## Guest Session System
Allows anonymous users to:
- Create and join drafts without registration
- Maintain session state across browser sessions
- Optionally convert to full accounts later
- Automatic data migration upon account creation

## External Integrations

### Movie Data APIs
- TMDB for core movie information, cast, crew
- OMDB for additional metadata and ratings
- Custom edge functions handle API rate limiting

### Email Services
- Draft invitation emails
- Participant notifications
- Account verification (optional)

## Deployment & Hosting
- Frontend deployed on modern hosting platforms
- Supabase manages backend infrastructure
- Environment-specific configurations
- Automatic CI/CD pipeline integration

## Performance Optimizations
- Movie data caching
- Lazy loading for large datasets
- Optimistic UI updates
- Real-time subscription management
- Image optimization and CDN usage

## Security Considerations
- Row Level Security for data access
- Guest session expiration and cleanup
- API rate limiting and abuse prevention
- Input validation and sanitization
- CORS and CSP headers

## Future Enhancements
- Advanced scoring algorithms
- Tournament bracket systems
- Social features and leaderboards
- Mobile app development
- AI-powered movie recommendations