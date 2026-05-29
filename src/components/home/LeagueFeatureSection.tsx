import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Spline from '@splinetool/react-spline';
import type { Application } from '@splinetool/react-spline';

export function LeagueFeatureSection() {
  const navigate = useNavigate();

  const trophyRef = useRef<{ rotation: { x: number; y: number } } | null>(null);
  const originalRot = useRef({ x: 0, y: 0 });
  const targetRot = useRef({ x: 0, y: 0 });
  const currentRot = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  function onLoad(spline: Application) {
    const trophy = spline.findObjectByName('TROPHY');
    if (!trophy) return;
    trophyRef.current = trophy as { rotation: { x: number; y: number } };
    originalRot.current = { x: trophy.rotation.x, y: trophy.rotation.y };
  }

  useEffect(() => {
    function tick() {
      const t = trophyRef.current;
      if (t) {
        currentRot.current.x += (targetRot.current.x - currentRot.current.x) * 0.05;
        currentRot.current.y += (targetRot.current.y - currentRot.current.y) * 0.05;
        t.rotation.x = originalRot.current.x + currentRot.current.x;
        t.rotation.y = originalRot.current.y + currentRot.current.y;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    targetRot.current = { x: ny * -0.209, y: nx * 0.209 };
  }

  function handleMouseLeave() {
    targetRot.current = { x: 0, y: 0 };
  }

  return (
    <section
      className="w-full h-full py-6 px-6"
      style={{ background: 'linear-gradient(160deg, #0d0020 0%, #160038 50%, #0d0020 100%)' }}
    >
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center gap-0">

        {/* ── Spline column ── */}
        <div
          className="md:w-1/2 w-full flex items-center justify-center"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div style={{ width: '100%', aspectRatio: '1 / 1', mixBlendMode: 'screen', pointerEvents: 'none' }}>
            <Spline
              scene="https://prod.spline.design/JZV0l51zUqAIg-WW/scene.splinecode"
              onLoad={onLoad}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        {/* ── Text column ── */}
        <div className="flex flex-col gap-6 md:w-1/2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/40 bg-purple-900/30 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span className="text-xs font-brockmann font-semibold text-purple-300 uppercase tracking-widest">
              New Feature
            </span>
          </div>

          <h2 className="font-chaney font-normal text-4xl md:text-5xl lg:text-[56px] leading-tight text-greyscale-blue-100">
            Play in a<br />League
          </h2>

          <p className="font-brockmann text-base md:text-lg leading-relaxed text-greyscale-blue-300 max-w-md">
            Compete across multiple drafts with the same group. Track standings, earn points every season, and find out who's the real film expert in your circle.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/league/create')}
              className="px-6 py-3 rounded-[2px] bg-[#7142FF] hover:bg-[#5e32e0] font-brockmann font-semibold text-sm text-white transition-colors"
            >
              Create a League
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
