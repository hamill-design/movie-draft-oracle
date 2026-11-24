import { useEffect, useState } from 'react';
import { publicPlayApi } from '@/lib/publicPlayApi';

/**
 * A small count of player reports still waiting for review. Shows nothing when there are none (or when the
 * count can't be loaded). Admin pages only: the database refuses anyone else.
 */
export function OpenReportsBadge({ className = '' }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => {
      publicPlayApi
        .adminReports('open')
        .then((rows) => { if (alive) setCount(rows.length); })
        .catch(() => { /* no badge is better than an error on the admin page */ });
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      window.removeEventListener('focus', load);
    };
  }, []);

  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} open ${count === 1 ? 'report' : 'reports'}`}
      className={`inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#B3261E] px-1.5 text-xs font-semibold leading-5 text-white ${className}`}
      style={{ fontFamily: 'Brockmann' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
