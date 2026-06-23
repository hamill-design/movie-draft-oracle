import { cn, getCleanActorName } from '@/lib/utils';
import { formatDraftHeadingTitle, getDraftTitleFontStyle } from '@/lib/draftTitleTypography';

interface DraftHeadingTitleProps {
  option: string;
  theme?: string;
  specDraftName?: string | null;
  className?: string;
}

export function DraftHeadingTitle({
  option,
  theme,
  specDraftName,
  className,
}: DraftHeadingTitleProps) {
  const primaryLabel =
    theme === 'spec-draft'
      ? (specDraftName || option || '').toUpperCase()
      : theme === 'people'
        ? getCleanActorName(option || '').toUpperCase()
        : (option ?? '').toString().toUpperCase();

  const fullTitle = formatDraftHeadingTitle(option, theme, specDraftName);

  return (
    <h2
      className={cn(
        'font-chaney font-normal text-center m-0 max-w-full break-normal',
        className,
      )}
      style={getDraftTitleFontStyle(fullTitle)}
    >
      {theme === 'spec-draft' ? (
        <span className="text-greyscale-blue-100">{primaryLabel}</span>
      ) : (
        <>
          <span className="text-greyscale-blue-100">{primaryLabel}</span>
          {' '}
          <span className="text-purple-300">MOVIES</span>
        </>
      )}
    </h2>
  );
}
