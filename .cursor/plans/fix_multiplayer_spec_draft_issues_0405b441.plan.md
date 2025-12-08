# Fix Multiplayer Spec Draft Issues

## Issues Identified

1. **Missing useAuth import error** - Component crashes with "useAuth is not defined" despite import being present (likely build cache issue)
2. **Movie search returns 0 results** - Movies are fetched (158) but filtered to 0, preventing users from searching
3. **Empty movie_genres arrays** - All movies show `movie_genres: Array(0)`, causing genre conversion warnings
4. **UUID type error** - `load_draft_unified` receives `[object Object]` instead of UUID string, causing 400 errors
5. **Additional participant requirement** - Multiplayer spec drafts require at least one additional participant beyond the host, but should work like normal multiplayer drafts (host can start alone)

## Root Causes

1. **useAuth import**: Import exists but may need verification/rebuild
2. **Movie search filtering**: `MovieSearch.tsx` filters movies only when `searchQuery.trim()` is truthy, but the filtering logic may be too restrictive
3. **Empty genres**: When movies are added to spec drafts, `movie_genres` field may not be populated correctly from the search results
4. **UUID error**: `draftId` parameter in `useMultiplayerDraft` is being passed as draft object instead of string ID, likely in polling/refresh logic
5. **Participant requirement**: Validation prevents creating multiplayer drafts with only the host, but normal multiplayer drafts allow this

## Implementation Plan

### 1. Remove Additional Participant Requirement
**File**: `src/pages/SpecDraftSetup.tsx`
- Remove validation at lines 372-379 that requires additional participants
- Remove validation at lines 388-395 that checks for additional participants
- Allow creating multiplayer spec drafts with just the host (others can join via invite code later)
- Update the participant filtering logic to send empty array if only host is present

### 2. Fix UUID Type Error
**File**: `src/hooks/useMultiplayerDraft.ts`
- Line 710: Add type guard to ensure `draftId` is string before logging/using
- Line 135: In `startPolling`, ensure `draftId` parameter is string type
- Line 419: In `loadDraft`, add validation: `if (typeof id !== 'string') { console.error('Invalid draftId type:', typeof id, id); return; }`
- Check all places where `draftId` is used to ensure it's always a string UUID
- Add defensive check: `const validDraftId = typeof draftId === 'string' ? draftId : draftId?.id || null;`

### 3. Fix Movie Search Filtering
**File**: `src/components/MovieSearch.tsx`
- Review filtering logic at lines 75-79
- Ensure `filteredMoviesByTheme` contains movies before filtering by search query
- Add debug logging to trace why movies are filtered to 0
- Check if `searchQuery` state is being updated correctly
- Verify that movies array is not being cleared unexpectedly

### 4. Fix Empty movie_genres Warnings
**Files**: 
- `src/hooks/useMovies.ts` (lines 39-47)

**Changes**:
- Remove or reduce the console.warn for empty genres (it's expected for some movies)
- Change from `console.warn` to `console.log` with lower verbosity, or remove entirely
- Only log if it's actually unexpected (e.g., if we expected genres but got none)

### 5. Fix useAuth Import Issue
**File**: `src/pages/SpecDraftSetup.tsx`
- Verify import statement is correct (line 9)
- Ensure `useAuth` is imported from `@/contexts/AuthContext`
- Check if there are any circular dependency issues
- May require clearing build cache or restarting dev server

## Testing Checklist

- [ ] Spec draft setup page loads without useAuth errors
- [ ] Multiplayer spec draft can be created with only the host (no additional participants required)
- [ ] Movie search shows results when typing in multiplayer spec draft
- [ ] No UUID type errors in console when loading/refreshing drafts
- [ ] Polling and real-time updates work correctly
- [ ] Draft can be created and loaded successfully
- [ ] Empty genre warnings are reduced or removed

## Files to Modify

1. `src/pages/SpecDraftSetup.tsx` - Remove participant requirement validation, verify useAuth import
2. `src/components/MovieSearch.tsx` - Fix filtering logic
3. `src/hooks/useMovies.ts` - Reduce empty genre warnings
4. `src/hooks/useMultiplayerDraft.ts` - Fix UUID type validation

