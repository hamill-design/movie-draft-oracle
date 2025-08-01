# Movie Draft Oracle - Knowledge Base

## Project Overview
Movie Draft Oracle is a web application that allows users to create and participate in movie drafts. Users can draft movies based on actors/directors or by year, either locally or in multiplayer mode with friends.

## Core Features
- **Draft Creation**: Choose themes (person-based or year-based) and modes (local or multiplayer)
- **Person Search**: Search for actors, directors, and other film personalities
- **Multiplayer Drafts**: Invite friends via email to join draft sessions
- **Category Selection**: Choose movie categories for drafts
- **Real-time Collaboration**: Live multiplayer draft sessions
- **User Profiles**: Manage user accounts and draft history

## Technical Architecture
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design system
- **Backend**: Supabase (PostgreSQL database, authentication, real-time features)
- **Routing**: React Router DOM
- **State Management**: React hooks and context
- **UI Components**: Custom atomic design system + shadcn/ui

## Design System
- **Colors**: HSL-based color system with semantic tokens
- **Typography**: Brockmann and Chaney font families
- **Components**: Atomic design pattern (atoms, molecules, organisms)
- **Theme**: Light theme with purple brand colors and gradient backgrounds

## Authentication & Users
- Supabase Auth for user management
- Guest sessions for non-authenticated users
- Profile management and customization
- Email invitations for multiplayer drafts

## Database Schema
- Users and profiles
- Drafts and draft sessions
- Movies and people data
- Participant management
- Category definitions

## Key User Flows
1. **Create Draft**: Theme selection → Person/Year selection → Mode selection → Participants (if multiplayer) → Categories → Start draft
2. **Join Draft**: Enter invite code → Set display name → Join session
3. **Draft Process**: Round-based selection with real-time updates
4. **Scoring**: Calculate and display final scores

## External Integrations
- Movie/people data APIs
- Email service for invitations
- Image storage for profiles and assets

## Performance Considerations
- Code splitting and lazy loading
- Optimized component rendering
- Efficient database queries
- Real-time subscription management