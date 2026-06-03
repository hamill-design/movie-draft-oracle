import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Spline from '@splinetool/react-spline';

const STEPS = [
  {
    title: 'Choose your draft format',
    body: "Pick from Draft by Filmography (an actor or director's catalog), Draft by Year (all films from a specific year), or a Special Draft with a curated theme like 90s thrillers or Best Picture winners.",
  },
  {
    title: 'Add your friends',
    body: 'Play locally with everyone on one device, or invite friends via email or using an invite code to participate in an online multiplayer draft. Or start a new draft based within your league to keep the group together.',
  },
  {
    title: 'Draft your roster',
    body: 'Take turns selecting movies into category slots based on genre, decade, Blockbuster or Academy Award. Strategy counts — the movie you want might get snatched before your pick.',
  },
  {
    title: 'See who wins',
    body: "Movie Drafter automatically scores each roster using real data — box office, critic scores, IMDb ratings, and award wins. You can also put it to a vote to see if you and your friends agree with the scores! The player with the highest average score wins bragging rights. Until the next round.",
  },
];

const SLIDE_DURATION = 4000;
const FADE_DURATION = 250;

export function HowItWorksSection() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const navigate = useNavigate();

  function goTo(index: number) {
    setVisible(false);
    setTimeout(() => {
      setActive(index);
      setVisible(true);
    }, FADE_DURATION);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      goTo((active + 1) % STEPS.length);
    }, SLIDE_DURATION);
    return () => clearTimeout(id);
  }, [active]);

  const step = STEPS[active];

  return (
    <section aria-label="How Movie Drafter works" className="w-full px-6 md:px-12 py-12 md:py-16">
      <div className="max-w-[1200px] mx-auto flex flex-row items-start gap-12 lg:gap-16">

        {/* ── Left: text + carousel ── */}
        <div className="flex flex-col gap-8 lg:w-[520px] shrink-0 pt-8">
          <h2 className="font-chaney font-normal text-5xl lg:text-[64px] leading-tight lg:leading-[64px] text-[#FAFEFF]">
            DRAFT Your<br />PERFECT Movie<br />Roster
          </h2>

          <div className="flex flex-col gap-6">
            <div
              className="flex flex-col gap-3 min-h-[160px]"
              style={{
                opacity: visible ? 1 : 0,
                transition: `opacity ${FADE_DURATION}ms ease`,
              }}
            >
              <h3 className="font-brockmann font-bold text-2xl lg:text-[32px] leading-9 tracking-widest text-[#907AFF]">
                {step.title}
              </h3>
              <p className="font-brockmann font-medium text-lg leading-7 text-[#BDC3C2]">
                {step.body}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-8 h-3 rounded-full border border-brand-primary transition-colors duration-300 p-0 cursor-pointer ${
                    i === active ? 'bg-brand-primary' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Spline ── */}
        {/*
          Wrapper defines the layout footprint (flex child).
          Inner absolute div expands the canvas beyond the wrapper with NO
          overflow:hidden — so nothing CSS-clips the animation. The canvas
          reaches the right viewport edge and gets 80px of buffer on the
          other three sides. Content scale stays tied to the wrapper width.
        */}
        <div className="w-full lg:flex-1 relative" style={{ height: '580px' }}>
          <div
            style={{
              position: 'absolute',
              top: '-80px',
              bottom: '-80px',
              left: '-80px',
              right: '-48px',
            }}
          >
            <Spline
              className="how-it-works-spline"
              scene="https://prod.spline.design/RowT8ilLMPFhNznc/scene.splinecode"
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            />
          </div>
        </div>

      </div>

      {/* CTA */}
      <div className="relative z-10 flex justify-center mt-10">
        <button
          onClick={() => navigate('/how-to-draft')}
          className="cursor-pointer px-[18px] py-3 bg-[#7142FF] hover:bg-[#5e32e0] rounded-[2px] font-brockmann font-semibold text-base text-white tracking-wide transition-colors"
        >
          Go to Complete Guide
        </button>
      </div>
    </section>
  );
}
