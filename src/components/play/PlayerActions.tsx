import { useState } from 'react';
import { DropdownSelect } from '@/components/ui/dropdown-select';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { publicPlayApi, type ReportReason } from '@/lib/publicPlayApi';
import { REPORT_REASONS } from '@/config/publicPlay';

interface PlayerActionsProps {
  userId: string;
  name: string;
  draftId: string;
}

/** The "..." menu on another player: block them or report them. */
export function PlayerActions({ userId, name, draftId }: PlayerActionsProps) {
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const block = async () => {
    try {
      await publicPlayApi.blockPlayer(userId);
      toast({ title: `${name} blocked`, description: "You won't be seated at the same table again." });
    } catch (err) {
      toast({ title: "Couldn't block", description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const report = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await publicPlayApi.reportPlayer(userId, draftId, reason, details.trim());
      toast({ title: 'Report sent', description: 'Thank you. We review every report.' });
      setReportOpen(false);
      setDetails('');
    } catch (err) {
      toast({ title: "Couldn't send the report", description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`} className="h-8 w-8 text-[#BDC3C2] hover:text-white">
            <MoreHorizontal size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-[#49474B] bg-[#1D1D1F] text-white">
          <DropdownMenuItem onSelect={() => setReportOpen(true)}>Report {name}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void block()}>Block {name}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="border-[#49474B] bg-[#0E0E0F] text-white sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="font-brockmann">Report {name}</DialogTitle>
            <DialogDescription className="font-brockmann text-sm text-[#BDC3C2]">
              Tell us what happened. Reports are private: the player won't know it was you.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={report} className="flex flex-col gap-3">
            <label htmlFor="report-reason" className="font-brockmann text-sm font-medium">Reason</label>
            <DropdownSelect id="report-reason" value={reason} onChange={(v) => setReason(v as ReportReason)} options={REPORT_REASONS.map((r) => ({ value: r.value, label: r.label }))} />
            <label htmlFor="report-details" className="font-brockmann text-sm font-medium">Details <span className="text-xs text-[#BDC3C2]">(optional)</span></label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={4}
              className="border-[#49474B] bg-[#1D1D1F] text-white"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReportOpen(false)} className="border-[#49474B] bg-transparent text-white">Cancel</Button>
              <Button type="submit" disabled={sending} className="bg-[#680AFF] hover:bg-[#794DFF] text-white">{sending ? 'Sending…' : 'Send report'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
