import type { CSSProperties } from 'react';
import { getCleanActorName } from '@/lib/utils';

const MIN_FONT_PX = 32;
const MAX_FONT_PX = 64;
/** Character count that fits comfortably at max size in the draft header container. */
const COMFORTABLE_CHAR_COUNT = 14;

export function formatDraftHeadingTitle(
  option: string,
  theme?: string,
  specDraftName?: string | null,
): string {
  if (theme === 'spec-draft') {
    return (specDraftName || option || '').toUpperCase();
  }

  const base =
    theme === 'people'
      ? getCleanActorName(option || '').toUpperCase()
      : (option ?? '').toString().toUpperCase();

  return `${base} MOVIES`.trim();
}

function scaleFontSizeForTitle(title: string): number {
  const length = title.length;
  if (length <= COMFORTABLE_CHAR_COUNT) return MAX_FONT_PX;
  return Math.max(
    MIN_FONT_PX,
    Math.round((MAX_FONT_PX * COMFORTABLE_CHAR_COUNT) / length),
  );
}

export function getDraftTitleFontStyle(title: string): CSSProperties {
  const scaled = scaleFontSizeForTitle(title);
  return {
    fontSize: `clamp(${MIN_FONT_PX}px, min(${scaled}px, 12vw), ${MAX_FONT_PX}px)`,
    lineHeight: `clamp(${MIN_FONT_PX}px, min(${scaled}px, 12vw), ${MAX_FONT_PX}px)`,
    maxWidth: '100%',
    overflowWrap: 'normal',
    wordBreak: 'normal',
    textWrap: 'balance',
  };
}

/** Default responsive title sizing when title length is unknown at module init. */
export const DRAFT_TITLE_FONT_STYLE: CSSProperties = getDraftTitleFontStyle(
  'DEFAULT TITLE XX',
);
