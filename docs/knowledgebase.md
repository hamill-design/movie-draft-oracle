# Movie Draft Knowledgebase

## Overview
Movie Draft is a fantasy sports-style drafting game focused on movies and actors. Players create teams by drafting actors, and their team's performance is scored based on the real-world box office success and critical reception of movies featuring their drafted actors.

## Core Concepts

### Draft System
- **Snake Draft**: Players alternate picking actors in rounds, with the order reversing each round
- **Categories**: Actors are organized into different categories (Leading Men, Leading Ladies, Character Actors, etc.)
- **Team Building**: Each player builds a roster of actors across different categories

### Scoring System
- **Box Office Performance**: Points awarded based on domestic and international box office earnings
- **Critical Reception**: Bonus points for high Rotten Tomatoes scores and awards
- **Release Timing**: Points accumulate as new movies are released featuring drafted actors

### Multiplayer Features
- **Draft Rooms**: Private rooms where friends can draft together
- **Real-time Updates**: Live draft interface with pick notifications
- **Leaderboards**: Track performance throughout the scoring period

## Technical Architecture

### Frontend
- **React 18** with TypeScript for type safety
- **Tailwind CSS** with custom design system
- **Radix UI** components for accessibility
- **React Router** for navigation
- **React Query** for data fetching and caching

### Backend
- **Supabase** for authentication, database, and real-time features
- **PostgreSQL** database with Row Level Security
- **Edge Functions** for complex business logic

### Data Sources
- **The Movie Database (TMDb)** API for movie and actor data
- **Box office tracking** for scoring calculations
- **Awards databases** for bonus point systems

## Key Features

### User Authentication
- Email/password registration and login
- Guest mode for trying the platform
- User profiles with draft history

### Draft Management
- Create and join draft rooms
- Configurable draft settings (number of rounds, categories, etc.)
- Save and resume drafts
- Share draft results

### Scoring Engine
- Real-time score updates
- Historical performance tracking
- Detailed scoring breakdowns
- Comparative analysis tools

## Business Model
- **Freemium**: Basic drafts are free
- **Premium Features**: Advanced analytics, private leagues, extended draft history
- **Advertising**: Non-intrusive ads in free tier
- **Partnerships**: Potential partnerships with streaming services and movie studios