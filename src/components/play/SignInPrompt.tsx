import { useCallback, useRef, useState } from 'react';
import { AuthModal } from '@/components/AuthModal';
import type { AuthMode } from '@/components/auth/AuthForm';

/** What the guest just tried to do. Each one gets its own wording and its own way back after signing in. */
export type SignInReason = 'quick-play' | 'join' | 'open' | 'invite' | 'general';

export interface SignInIntent {
  reason: SignInReason;
  /** Where to land after signing in or creating an account (a path on this site, e.g. "/play?quick=play"). */
  returnTo: string;
  /** Open on "Create account" instead of "Sign in". */
  mode?: AuthMode;
}

const COPY: Record<SignInReason, { title: string; text: string }> = {
  'quick-play': { title: 'Sign in to play', text: 'Quick Play drops you into a live game, or opens one for other players to join.' },
  join: { title: 'Sign in to join this game', text: 'Take a seat and draft against other movie fans.' },
  open: { title: 'Sign in to open your game to the public', text: 'Anyone can jump in once it is open, and you decide when to start.' },
  invite: { title: 'Sign in to take your seat', text: 'You have been invited to a game. It takes a minute to sign in or create an account.' },
  general: { title: 'Sign in to play', text: 'Join games, start your own and earn points on the leaderboard.' },
};

interface SignInPromptProps {
  intent: SignInIntent | null;
  onClose: () => void;
}

/**
 * "You need an account for that": the sign-in popup for guests, worded for what they just tried to do.
 * They sign in or create an account right here, then land on `returnTo` (or just stay, if that is this page).
 */
export function SignInPrompt({ intent, onClose }: SignInPromptProps) {
  // Keep showing the last wording while the dialog fades out.
  const last = useRef<SignInIntent | null>(null);
  if (intent) last.current = intent;
  const shown = intent ?? last.current;
  if (!shown) return null;
  const copy = COPY[shown.reason];

  return (
    <AuthModal
      open={intent !== null}
      onOpenChange={(o) => !o && onClose()}
      initialMode={shown.mode}
      returnTo={shown.returnTo}
      signInTitle={copy.title}
      intro={`${copy.text} You need a free account to play with others.`}
    />
  );
}

/** `ask(intent)` opens the prompt; render `prompt` once, anywhere in the component. */
export function useSignInPrompt() {
  const [intent, setIntent] = useState<SignInIntent | null>(null);
  const ask = useCallback((i: SignInIntent) => setIntent(i), []);
  const close = useCallback(() => setIntent(null), []);
  return { ask, prompt: <SignInPrompt intent={intent} onClose={close} /> };
}
