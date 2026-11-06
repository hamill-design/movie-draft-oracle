import { X } from 'lucide-react';

/** The small cross on an invited seat: the host takes the invitation back (a mistyped address, say). */
export function RevokeInviteButton({ onRevoke, disabled }: { onRevoke: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Take back this invitation"
      title="Take back this invitation"
      disabled={disabled}
      onClick={onRevoke}
      className="flex h-6 w-6 items-center justify-center rounded-full border border-[#49474B] bg-[#0E0E0F] text-[#BDC3C2] transition-colors hover:text-white disabled:opacity-60"
    >
      <X size={12} aria-hidden />
    </button>
  );
}
