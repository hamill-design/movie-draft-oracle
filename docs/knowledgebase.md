# Movie Draft Game - Knowledge Base

## Overview
This is a React-based web application for hosting movie drafting games where players take turns selecting movies based on different themes and categories.

## Core Features

### Draft Types
- **Single Player**: Practice drafts for individual users
- **Multiplayer**: Real-time collaborative drafts with multiple participants

### Themes
- **Year**: Movies from a specific year
- **People**: Movies featuring a specific actor/actress
- **Genre**: Movies from specific genres

### Categories
Various movie categories like "Best Picture", "Action", "Comedy", etc.

## Technical Architecture

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling with custom design system
- **Supabase** for backend services
- **Real-time updates** using Supabase presence and broadcasting

### Backend
- **Supabase Database** with PostgreSQL
- **Row Level Security (RLS)** for data protection
- **Edge Functions** for API integrations
- **Real-time subscriptions** for live updates

### Key Data Models
- **Drafts**: Main draft configuration and state
- **Draft Participants**: Users/guests in a draft
- **Draft Picks**: Movie selections made by players
- **Guest Sessions**: Temporary sessions for non-authenticated users

## Movie Data Integration
- **TMDB API** for movie information
- **People Search** for actor/actress lookup
- **Movie Search** with theme-based filtering
- **Poster Images** and metadata

## Real-time Features
- Live participant joining/leaving
- Turn-based picking system
- Snake draft turn order
- Broadcast messaging for state updates

## Authentication
- **Supabase Auth** for registered users
- **Guest Sessions** for anonymous participation
- **Unified participant system** supporting both user types

## Scoring System
- Oscar nominations and wins
- IMDB ratings
- Rotten Tomatoes scores
- Box office performance
- Metacritic scores