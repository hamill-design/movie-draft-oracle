import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { publicPlayApi, type PublicPlayMode } from '@/lib/publicPlayApi';

const OPTIONS: { value: PublicPlayMode; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: 'Nobody can use public play, not even you.' },
  { value: 'admin_only', label: 'Just me (testing)', hint: 'Only the admin account can see and use it. This is the safe default.' },
  { value: 'on', label: 'Everyone', hint: 'Every signed-in player can host and join public tables.' },
];

interface PublicPlayAdminSwitchProps {
  mode: PublicPlayMode;
  onChanged: () => void;
}

/** The master switch for public play. Visible only to the admin account; enforced in the database. */
export function PublicPlayAdminSwitch({ mode, onChanged }: PublicPlayAdminSwitchProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState<PublicPlayMode | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = async (next: PublicPlayMode) => {
    setSaving(true);
    try {
      await publicPlayApi.setMode(next);
      toast({ title: 'Public play updated', description: OPTIONS.find((o) => o.value === next)?.hint });
      onChanged();
    } catch (err) {
      toast({ title: "Couldn't change the switch", description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
      setPending(null);
    }
  };

  const choose = (next: PublicPlayMode) => {
    if (next === mode) return;
    if (next === 'on') setPending(next);
    else void apply(next);
  };

  return (
    <section aria-labelledby="pp-admin-heading" className="rounded-lg border border-[#FFD60A]/40 bg-[#1B1700] p-5 flex flex-col gap-3">
      <div>
        <h2 id="pp-admin-heading" className="m-0 font-brockmann text-base font-semibold text-[#FFD60A]">Admin: who can use public play?</h2>
        <p className="m-0 font-brockmann text-xs text-[#E6D98A]">Only you can see this panel.</p>
      </div>
      <div role="radiogroup" aria-labelledby="pp-admin-heading" className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer flex-col gap-1 rounded border p-3 font-brockmann ${mode === o.value ? 'border-[#FFD60A] bg-[#2A2400]' : 'border-[#49474B] bg-[#1D1D1F] hover:border-[#FFD60A]/60'}`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <input type="radio" name="pp-mode" checked={mode === o.value} disabled={saving} onChange={() => choose(o.value)} />
              {o.label}
            </span>
            <span className="text-xs text-[#BDC3C2]">{o.hint}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 font-brockmann text-sm">
        <Link to="/admin/quick-match" className="text-[#FFD60A] underline">Approve what Quick Match uses</Link>
        <Link to="/admin/reports" className="text-[#FFD60A] underline">Review player reports</Link>
      </div>

      <AlertDialog open={pending === 'on'} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="border-[#49474B] bg-[#0E0E0F] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-brockmann">Open public play to everyone?</AlertDialogTitle>
            <AlertDialogDescription className="font-brockmann text-[#BDC3C2]">
              Any signed-in player will be able to host tables and play with strangers. Make sure you've tried it yourself,
              checked how you'll handle reports, and reviewed the Terms and Privacy Policy. You can switch it back at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#49474B] bg-transparent text-white">Not yet</AlertDialogCancel>
            <AlertDialogAction className="bg-[#680AFF] hover:bg-[#794DFF] text-white" onClick={() => void apply('on')}>Open to everyone</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
