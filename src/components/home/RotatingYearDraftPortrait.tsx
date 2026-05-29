import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const SIZE = 124;
const HALF = SIZE / 2;
const ROTATE_MS = 4000;
const CUBE_MS = 650;

const yearSvgModules = import.meta.glob<string>(
  '@/assets/home/year-drafts/*.svg',
  { eager: true, import: 'default' },
);

type YearTile = { label: string; src: string };

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildYearTiles(): YearTile[] {
  return Object.entries(yearSvgModules).map(([path, src]) => {
    const file = path.split('/').pop() ?? 'year';
    const label = file.replace(/\.svg$/i, '').replace(/-1$/, '');
    return { label, src };
  });
}

function CubeFace({
  tile,
  transform,
  isFront,
}: {
  tile: YearTile;
  transform: string;
  isFront: boolean;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-xl bg-transparent"
      style={{
        transform,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      <img
        src={tile.src}
        alt={isFront ? `Draft by year: ${tile.label}` : ''}
        aria-hidden={!isFront}
        className="h-full w-full object-contain p-1"
        draggable={false}
      />
    </div>
  );
}

type RotatingYearDraftPortraitProps = {
  className?: string;
};

export function RotatingYearDraftPortrait({ className }: RotatingYearDraftPortraitProps) {
  const [order] = useState(() => shuffle(buildYearTiles()));
  const [displayIndex, setDisplayIndex] = useState(0);
  const [queuedIndex, setQueuedIndex] = useState(1);
  const [cubeRotation, setCubeRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const displayIndexRef = useRef(0);
  const queuedIndexRef = useRef(queuedIndex);
  const cubeTimerRef = useRef<number | null>(null);

  displayIndexRef.current = displayIndex;
  queuedIndexRef.current = queuedIndex;

  useEffect(() => {
    if (order.length <= 1) return;

    const runTransition = () => {
      setIsAnimating(true);
      setCubeRotation(-90);

      if (cubeTimerRef.current != null) window.clearTimeout(cubeTimerRef.current);
      cubeTimerRef.current = window.setTimeout(() => {
        const nextDisplay = queuedIndexRef.current;
        const nextQueued = (nextDisplay + 1) % order.length;

        setIsAnimating(false);
        setCubeRotation(0);
        setDisplayIndex(nextDisplay);
        setQueuedIndex(nextQueued);
        displayIndexRef.current = nextDisplay;
        queuedIndexRef.current = nextQueued;
        cubeTimerRef.current = null;
      }, CUBE_MS);
    };

    const id = window.setInterval(runTransition, ROTATE_MS);
    return () => {
      window.clearInterval(id);
      if (cubeTimerRef.current != null) window.clearTimeout(cubeTimerRef.current);
    };
  }, [order.length]);

  const displayTile = order[displayIndex];
  const queuedTile = order[queuedIndex];
  const ariaLabel = displayTile
    ? `Draft by year: ${displayTile.label}`
    : 'Draft by Year';

  if (!displayTile) {
    return (
      <div
        className={cn(
          'h-[124px] w-[124px] shrink-0 rounded-xl bg-transparent',
          className,
        )}
        aria-label="Draft by Year"
      />
    );
  }

  return (
    <div
      className={cn('h-[124px] w-[124px] shrink-0 overflow-visible', className)}
      style={{ perspective: `${SIZE * 5}px` }}
      title={displayTile.label}
      aria-label={ariaLabel}
    >
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateY(${cubeRotation}deg)`,
          transition: isAnimating
            ? `transform ${CUBE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
            : 'none',
        }}
      >
        <CubeFace
          tile={displayTile}
          transform={`rotateY(0deg) translateZ(${HALF}px)`}
          isFront
        />
        {order.length > 1 && queuedTile && (
          <CubeFace
            tile={queuedTile}
            transform={`rotateY(90deg) translateZ(${HALF}px)`}
            isFront={false}
          />
        )}
      </div>
    </div>
  );
}
