import { cn, getCleanActorName } from '@/lib/utils';
import { DRAFT_TITLE_FONT_STYLE } from '@/lib/draftTitleTypography';

interface FinalScoresHeadingTitleProps {
  title: string;
  option?: string | null;
  theme?: string | null;
  className?: string;
}

function getNameLabel(title: string, option?: string | null, theme?: string | null): string {
  if (theme === 'people' && option) {
    return getCleanActorName(option).toUpperCase();
  }

  return (title || option || '').toUpperCase();
}

export function FinalScoresHeadingTitle({
  title,
  option,
  theme,
  className,
}: FinalScoresHeadingTitleProps) {
  const nameLabel = getNameLabel(title, option, theme);

  return (
    <h1
      className={cn(
        'font-chaney font-normal text-center m-0 max-w-full break-normal',
        className,
      )}
      style={DRAFT_TITLE_FONT_STYLE}
    >
      <span className="text-greyscale-blue-100">{nameLabel}</span>
      {' '}
      <span className="text-purple-300">DRAFT</span>
    </h1>
  );
}
