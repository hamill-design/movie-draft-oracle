/**
 * Share destinations. None of these require platform accounts, API keys, or app registration:
 * - nativeShare(): the OS share sheet (Web Share API) — on mobile this hands the image file
 *   straight to Instagram / Messages / WhatsApp / etc.
 * - build*Url(): pre-filled share/intent URLs for X, Facebook, WhatsApp, Reddit.
 */

const enc = encodeURIComponent;

/** Convert a PNG (or any) data URL into a File suitable for the Web Share API. */
export const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.split(':')[1].split(';')[0];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
};

/** Whether the browser exposes the Web Share API at all. */
export const canNativeShare = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** Whether these specific files can be shared (Web Share API Level 2 — mostly mobile). */
export const canShareFiles = (files: File[]): boolean => {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files })
    );
  } catch {
    return false;
  }
};

export type NativeShareResult = 'shared' | 'unsupported' | 'cancelled' | 'error';

export interface NativeShareInput {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

/**
 * Open the OS share sheet. If files are provided but the browser can't share them
 * (e.g. desktop), it falls back to sharing text + url so the action still works.
 */
export const nativeShare = async (input: NativeShareInput): Promise<NativeShareResult> => {
  if (!canNativeShare()) return 'unsupported';

  const payload: ShareData = {};
  if (input.title) payload.title = input.title;
  if (input.text) payload.text = input.text;
  if (input.url) payload.url = input.url;
  if (input.files?.length && canShareFiles(input.files)) {
    payload.files = input.files;
  }

  try {
    await navigator.share(payload);
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    return 'error';
  }
};

/** Open a platform share URL in a small popup (falls back to a new tab on mobile). */
export const openShareWindow = (shareUrl: string): void => {
  window.open(shareUrl, '_blank', 'noopener,noreferrer,width=620,height=640');
};

export const buildXUrl = (text: string, url: string): string =>
  `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`;

export const buildFacebookUrl = (url: string): string =>
  `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;

export const buildWhatsAppUrl = (text: string, url: string): string =>
  `https://wa.me/?text=${enc(`${text} ${url}`)}`;

export const buildRedditUrl = (title: string, url: string): string =>
  `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`;

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
