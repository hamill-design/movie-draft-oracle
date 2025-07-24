# Movie Draft Game - Knowledge Base

## Application Overview

The Movie Draft Game is a multiplayer web application that allows users to draft movies based on different themes and categories. Players take turns selecting movies in a snake draft format, similar to fantasy sports drafts.

## Core Features

### Draft Types
- **Single Player**: Practice drafts for individual users
- **Multiplayer**: Real-time drafts with multiple participants
- **Guest Support**: Anonymous users can participate without registration

### Draft Themes
- **Year-based**: Movies from specific years or year ranges
- **Person-based**: Movies featuring specific actors/directors
- **Genre-based**: Movies from specific genres
- **Custom themes**: User-defined criteria

### User Management
- **Authenticated Users**: Full account features with profile management
- **Guest Sessions**: Temporary sessions with 7-day expiration
- **Session Migration**: Guest drafts can be migrated to user accounts

## Technical Architecture

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- Real-time updates via Supabase subscriptions

### Backend
- Supabase for database and authentication
- PostgreSQL with Row Level Security (RLS)
- Edge Functions for external API integrations
- Real-time subscriptions for multiplayer features

### Data Sources
- TMDB (The Movie Database) API for movie data
- OMDB API for additional movie information
- Custom movie scoring algorithms

## Key Components

### Draft Management
- Draft creation and configuration
- Participant management
- Turn-based picking system
- Real-time synchronization

### Movie Search
- Advanced filtering by year, genre, person
- Integration with multiple movie APIs
- Caching for performance

### Scoring System
- Multiple scoring criteria (box office, ratings, awards)
- Automated score calculations
- Leaderboards and statistics

## Common Issues and Solutions

### Guest Session Problems
- **Issue**: Guest users can't join multiplayer drafts
- **Solution**: Ensure guest session ID is properly transmitted and RLS policies allow guest access

### Database Access Issues
- **Issue**: Users can't see their data
- **Solution**: Check RLS policies and ensure proper user/guest session context

### Real-time Update Problems
- **Issue**: Draft updates don't sync across users
- **Solution**: Verify Supabase subscriptions and proper channel management

## Best Practices

### Development
- Always test with both authenticated and guest users
- Implement proper error handling for API failures
- Use TypeScript for type safety
- Follow React best practices for state management

### Database
- Use RLS policies for data security
- Implement proper indexing for performance
- Handle edge cases in database functions
- Use security definer functions where appropriate

### User Experience
- Provide clear feedback for all user actions
- Handle loading states gracefully
- Implement proper error messages
- Support both desktop and mobile interfaces