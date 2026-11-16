import { Link } from 'react-router-dom';

const LINKS = [
  { to: '/admin/quick-match', label: 'Quick Match pool', hint: 'Approve the years, actors and special drafts Quick Play can pick.' },
  { to: '/admin/reports', label: 'Player reports', hint: 'Review what players have reported.' },
];

const font = { fontFamily: 'Brockmann' } as const;

/**
 * The "Public Play" tab of the admin page: the two screens for running public play. Public play is open to
 * everyone, so there is no on/off switch here.
 */
export function PublicPlayAdminSection() {
  return (
    <section aria-label="Running public play" className="grid gap-3 sm:grid-cols-2">
      {LINKS.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="flex flex-col gap-1 rounded-[8px] border border-greyscale-blue-200 bg-ui-primary p-5 transition-colors hover:border-purple-300"
          style={font}
        >
          <span className="text-base font-semibold text-[#2b2f31]">{l.label}</span>
          <span className="text-sm text-greyscale-blue-600">{l.hint}</span>
        </Link>
      ))}
    </section>
  );
}
