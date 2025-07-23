# Movie Draft Game - Knowledgebase

## Overview
The Movie Draft Game is a web application that allows users to create and participate in movie drafting games. Users can draft movies based on different themes (actor/director or year) and categories, then compete to see whose picks perform best.

## Key Features

### Guest Access
- Users can create and join drafts without an account
- Guest sessions are temporary (7 days)
- All draft functionality available to guests
- Account creation prompts for permanent saving

### Draft Types
1. **Solo/Local Drafts**: Single-player experience with AI-controlled opponents
2. **Multiplayer Drafts**: Real-time collaborative drafts with friends via invite codes

### Draft Themes
1. **By Person**: Draft movies featuring a specific actor or director
2. **By Year**: Draft movies released in a specific year

### Categories
Dynamic categories based on theme:
- **Person-based**: Actor roles, director films, genre variety, etc.
- **Year-based**: Box office performance, critical acclaim, awards, etc.

## Technical Architecture

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling with custom design system
- **React Router** for navigation
- **React Hook Form** for form management
- **Zustand** for state management

### Backend
- **Supabase** for database, authentication, and real-time features
- **PostgreSQL** database with Row Level Security (RLS)
- **Edge Functions** for server-side logic
- **Real-time subscriptions** for multiplayer features

### External APIs
- **TMDB (The Movie Database)** for movie data
- **OMDB** for additional movie metadata
- **Resend** for email invitations

## Database Schema

### Core Tables
- `profiles`: User profile data
- `guest_sessions`: Temporary guest session tracking
- `drafts`: Draft game instances
- `draft_participants`: Players in each draft
- `draft_picks`: Movie selections made during drafts
- `oscar_cache`: Cached Oscar nomination/win data

### Security
- Row Level Security (RLS) policies protect data
- Guest sessions have isolated access
- User data migration on account creation

## Authentication System

### Dual Authentication
1. **Authenticated Users**: Full account with permanent data
2. **Guest Sessions**: Temporary access with migration capability

### Guest Session Flow
1. Auto-generate guest session on first visit
2. Allow full draft functionality
3. Prompt for account creation at strategic points
4. Migrate guest data to user account on signup

## Multiplayer System

### Real-time Features
- Live draft updates via Supabase real-time
- Turn-based picking system
- Participant status tracking
- Invite code sharing

### Draft Flow
1. Host creates draft with theme/categories
2. Sends invitations via email or invite code
3. Players join and wait for draft start
4. Turn-based picking begins
5. Real-time updates for all participants

## Scoring System
- Dynamic scoring based on movie metadata
- Box office performance
- Critical acclaim (IMDB, Rotten Tomatoes, Metacritic)
- Awards recognition (Oscars)
- Audience scores

## Design System
- Custom HSL color tokens
- Semantic theming for light/dark modes
- Consistent component variants
- Responsive design patterns