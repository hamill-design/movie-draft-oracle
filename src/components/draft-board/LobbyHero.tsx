import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The centred call to action above the two lobby cards: a heading, one sentence, then the buttons.
 * Private drafts and public tables both use this, so the pre-draft screen looks the same everywhere.
 */
export function LobbyHero({ heading, sub, children }: { heading: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section aria-label="Ready up" className="flex w-full flex-col items-center gap-4 p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <h2 className="m-0 font-brockmann text-xl font-medium leading-7 text-[#FCFFFF]">{heading}</h2>
        {sub ? <p className="m-0 max-w-[560px] font-brockmann text-sm leading-5 text-[#BDC3C2]">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

type LobbyButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
};

const BUTTON_BASE =
  'rounded-[2px] px-8 py-4 font-brockmann text-lg font-semibold leading-6 transition-colors disabled:opacity-60';

const BUTTON_VARIANTS: Record<NonNullable<LobbyButtonProps['variant']>, string> = {
  primary: 'bg-[#680AFF] text-[#FCFFFF] hover:bg-[#794DFF]',
  // No border and no fill; it only darkens under the pointer. Quieter type than the main button.
  ghost: 'bg-transparent text-base font-normal text-[#FCFFFF] hover:bg-black/40',
};

/** The purple 2px button from the normal pre-draft screen (and its quieter sibling, with no border). */
export function LobbyButton({ variant = 'primary', className, type = 'button', ...props }: LobbyButtonProps) {
  return <button type={type} className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], className)} {...props} />;
}
