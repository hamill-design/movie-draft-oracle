import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { publicPlayApi } from '@/lib/publicPlayApi';

interface PublicNameFormProps {
  currentName?: string | null;
  onSaved: () => void;
  /** Why we're asking: the name in their settings couldn't be used (shown above the explanation). */
  reason?: string | null;
  /** Changing an existing name rather than choosing the first one. */
  onCancel?: () => void;
}

/**
 * The name strangers see. It normally comes from the player's settings automatically, so this form only appears
 * when that name can't be used (or when they choose to change it). It is separate from their account, is never their
 * email, and is checked on the server (length, characters, a word filter, uniqueness).
 */
export function PublicNameForm({ currentName, onSaved, reason, onCancel }: PublicNameFormProps) {
  const [name, setName] = useState(currentName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await publicPlayApi.setName(name);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that name.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-[#49474B] bg-[#0E0E0F] p-6 flex flex-col gap-4 max-w-[520px] mx-auto">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-brockmann text-xl font-medium text-white">{currentName ? 'Change your player name' : 'Choose your player name'}</h2>
        {reason && <p role="status" className="m-0 font-brockmann text-sm text-[#FFD60A]">{reason}</p>}
        <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">
          This is the name other players see at public tables. It's separate from your account and is never your email.
          3 to 20 characters: letters, numbers, spaces, dots, dashes or underscores.
        </p>
      </div>
      <label htmlFor="public-name" className="sr-only">Player name</label>
      <Input
        id="public-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        placeholder="e.g. Film Fan 99"
        autoComplete="off"
        className="bg-[#1D1D1F] border-[#49474B] text-white"
      />
      {error && <p role="alert" className="m-0 font-brockmann text-sm text-[#FF8A8A]">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving || name.trim().length < 3} className="bg-[#680AFF] hover:bg-[#794DFF] text-white">
          {saving ? 'Saving…' : 'Save name'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="text-[#BDC3C2] hover:text-white">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
