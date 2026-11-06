/** Origin for Supabase auth links (Google return, signup confirm, password reset). Override with VITE_APP_URL for local testing. */
export const PUBLIC_SITE_URL = (import.meta.env.VITE_APP_URL || 'https://moviedrafter.com').replace(
  /\/+$/,
  ''
);

/** Only same-site relative paths are allowed as a post-auth destination (no open redirects). */
export const safeReturnTo = (value: string | null | undefined): string | null =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : null;

/**
 * Google sign-in from the popup opens in a new tab, so the page the person was on (Final Scores, say) stays put.
 * Google sends that new tab back to the site with this flag in the address; the tab then closes itself and the
 * original tab carries on.
 */
const AUTH_TAB_PARAM = 'auth_tab';

/** `path` with the new-tab flag added (keeps any query and hash it already has). */
export const withAuthTabFlag = (path: string): string => {
  const url = new URL(path, 'https://placeholder.invalid');
  url.searchParams.set(AUTH_TAB_PARAM, '1');
  return `${url.pathname}${url.search}${url.hash}`;
};

/** True in the tab Google sign-in opened. Decided once, when the page loads, so later navigation can't change it. */
export const IS_AUTH_TAB =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(AUTH_TAB_PARAM);
