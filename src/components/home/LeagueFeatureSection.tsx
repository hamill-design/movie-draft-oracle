import { useNavigate } from 'react-router-dom';

export function LeagueFeatureSection() {
  const navigate = useNavigate();

  return (
    <section
      aria-label="Play in a Movie Drafter League"
      className="w-full h-full py-6 px-6"
      style={{ background: 'linear-gradient(160deg, #0d0020 0%, #160038 50%, #0d0020 100%)' }}
    >
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center gap-0">

        {/* ── Trophy column ── */}
        <div className="md:w-1/2 w-full flex items-center justify-center">
          <div style={{ width: '100%', aspectRatio: '1 / 1' }}>
            <img
              src="/images/home/league-trophy.png"
              alt="Movie Drafter league trophy"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
