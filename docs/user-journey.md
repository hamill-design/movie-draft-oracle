# User Journey - Movie Draft Game

## New User Experience

### Option 1: Guest User (No Registration)
1. **Landing**: User visits the homepage
2. **Quick Start**: Clicks "Start Draft" without signing up
3. **Draft Setup**: Selects theme, categories, and participants
4. **Multiplayer Option**: Can create/join multiplayer drafts as guest
5. **Session**: Gets automatic 7-day guest session
6. **Upgrade Path**: Prompted to create account to save progress

### Option 2: Registered User
1. **Landing**: User visits homepage
2. **Sign Up**: Creates account with email/password
3. **Profile**: Sets up display name and preferences
4. **Full Access**: Can save drafts, view history, and manage settings

## Core User Flows

### Creating a Draft

#### Single Player Draft
1. **Theme Selection**: Choose year, person, or genre-based theme
2. **Configuration**: Set specific parameters (year range, actor name, etc.)
3. **Category Setup**: Select 5-8 categories for drafting
4. **Draft Start**: Begin selecting movies immediately
5. **Movie Selection**: Search and pick movies for each category
6. **Completion**: View final roster and scores

#### Multiplayer Draft
1. **Setup**: Choose theme and categories
2. **Invitation**: Add participant emails or share invite code
3. **Lobby**: Wait for participants to join
4. **Start**: Host initiates the draft when ready
5. **Turn-based**: Players take turns picking movies
6. **Real-time**: See picks and updates instantly
7. **Completion**: View final leaderboard

### Joining a Draft

#### Via Invite Code
1. **Code Entry**: Enter 8-character invite code
2. **Name Setup**: Provide display name
3. **Join**: Automatically added to draft
4. **Wait**: Lobby until draft starts
5. **Participate**: Take turns when it's your pick

#### Via Email Invitation
1. **Email Link**: Click link from email invitation
2. **Automatic Join**: Pre-filled invite code
3. **Name Confirmation**: Verify display name
4. **Join**: Enter draft lobby
5. **Ready to Play**: Wait for draft to start

## User States and Permissions

### Guest Users
- **Can Do**:
  - Create and join multiplayer drafts
  - Complete single player drafts
  - Search and select movies
  - View draft results
  - Use all core features

- **Cannot Do**:
  - Save drafts permanently
  - View draft history
  - Access profile settings
  - Manage saved preferences

- **Limitations**:
  - 7-day session expiration
  - Data loss if browser cleared
  - No cross-device access

### Authenticated Users
- **Full Access**: All guest features plus:
  - Permanent draft storage
  - Draft history and statistics
  - Profile customization
  - Cross-device synchronization
  - Account settings management

## Conversion Funnel

### Guest to Registered User
1. **Engagement**: Guest completes their first draft
2. **Value Recognition**: Sees their results and wants to save them
3. **Prompt**: System offers account creation with benefits
4. **Migration**: All guest data transfers to new account
5. **Retention**: User continues with full features

### Drop-off Points and Solutions
- **Complex Setup**: Simplified theme selection with presets
- **Long Wait Times**: Real-time updates and progress indicators
- **Technical Issues**: Comprehensive error handling and recovery
- **Confusion**: Clear instructions and tooltips throughout

## Success Metrics

### Engagement
- Draft completion rate
- Time spent in drafts
- Return user rate
- Multiplayer participation

### Conversion
- Guest to registered user rate
- Draft completion before conversion
- Feature usage after registration
- Long-term retention

## Pain Points and Mitigations

### Technical Issues
- **Problem**: Complex multiplayer synchronization
- **Solution**: Robust real-time updates and conflict resolution

### User Experience
- **Problem**: Movie selection can be overwhelming
- **Solution**: Smart filtering and recommendations

### Social Features
- **Problem**: Difficulty coordinating with friends
- **Solution**: Multiple invitation methods and flexible scheduling

### Performance
- **Problem**: Large movie database queries
- **Solution**: Efficient caching and pagination