import { cn } from '@/lib/utils';

interface DraftPageHeaderSectionProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DraftPageHeaderSection({
  label,
  children,
  className,
  contentClassName,
}: DraftPageHeaderSectionProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className={cn('p-6 rounded-[8px]', contentClassName)}>
        <div
          className={`flex flex-col justify-center items-center text-center ${
            label ? 'gap-4' : 'gap-0'
          }`}
        >
          {label ? (
            <p className="text-purple-300 text-[32px] font-brockmann font-bold leading-9 tracking-[1.28px] m-0">
              {label}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
