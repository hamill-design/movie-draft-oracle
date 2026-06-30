import { generateFontCSS } from './fontUtils';

/**
 * Output size presets:
 * - `portrait` = 4:5 (1080×1350) — Instagram feed / post (IG's current recommended size)
 * - `story`    = 9:16 (1080×1920) — Instagram / Facebook / WhatsApp Stories, vertical
 * - `square`   = 1:1 (1080×1080) — universal (X, Facebook, Reddit, WhatsApp)
 */
export type ShareFormat = 'portrait' | 'story' | 'square';

/** Which story the image tells. */
export type ShareVariant = 'leaderboard' | 'my-team' | 'full-list';

export interface ShareScoredMovie {
  title: string;
  score: number;
  playerName: string;
  poster?: string;
  year?: number;
  genre?: string;
  category?: string;
  pickNumber?: number;
}

export interface ShareImageData {
  title: string;
  teamScores: Array<{
    playerName: string;
    averageScore: number;
    completedPicks: number;
    totalPicks: number;
  }>;
  totalMovies: number;
  /** leaderboard highlights */
  bestMovie?: ShareScoredMovie;
  firstPick?: ShareScoredMovie;
  /** my-team variant */
  focusPlayer?: string;
  focusPlayerScore?: number;
  focusPlayerPicks?: ShareScoredMovie[];
  /** full-list variant (ordered by pick) */
  allPicks?: ShareScoredMovie[];
  /** full-list "invite to vote" CTA */
  voteUrl?: string;
  votingOpen?: boolean;
}

export interface GenerateOptions {
  format?: ShareFormat;
  variant?: ShareVariant;
}

export const FORMAT_DIMS: Record<ShareFormat, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

interface FormatStyle {
  /** main-container padding */
  pad: string;
  /** gap between sections (px) */
  gap: number;
  /** title font size (px) */
  titleSize: number;
  /** leaderboard: include the FIRST PICK / HIGHEST SCORER poster cards (small drafts only) */
  showMovieCards: boolean;
}

const FORMAT_STYLE: Record<ShareFormat, FormatStyle> = {
  square: { pad: '88px 24px 160px', gap: 24, titleSize: 56, showMovieCards: false },
  portrait: { pad: '120px 24px 176px', gap: 32, titleSize: 60, showMovieCards: false },
  story: { pad: '160px 24px 200px', gap: 48, titleSize: 64, showMovieCards: true },
};

/** Vertical space (px) for the list of rows, per format. Conservative so content never clips. */
const ROWS_BUDGET: Record<ShareFormat, number> = { square: 540, portrait: 770, story: 1320 };
/** Reduced leaderboard budget when the two poster highlight cards are also shown (small drafts). */
const LEADERBOARD_BUDGET_WITH_CARDS = 360;
const ROW_GAP = 10;

interface RowFit {
  rowH: number;
  shown: number;
  more: number;
}

/**
 * Fit `count` rows into `budget` px: pick a row height between min/max. If they don't all fit
 * even at min height, show as many as fit and report the remainder for a "+N more" row.
 * This is what makes the images max-safe — nothing ever clips, and leaderboards never silently
 * drop players up to what physically fits.
 */
const fitRows = (count: number, budget: number, minRow: number, maxRow: number): RowFit => {
  if (count <= 0) return { rowH: maxRow, shown: 0, more: 0 };
  const ideal = Math.floor(budget / count) - ROW_GAP;
  if (ideal >= maxRow) return { rowH: maxRow, shown: count, more: 0 };
  if (ideal >= minRow) return { rowH: ideal, shown: count, more: 0 };
  const fit = Math.max(1, Math.floor(budget / (minRow + ROW_GAP)));
  const shown = count > fit ? Math.max(1, fit - 1) : fit;
  return { rowH: minRow, shown, more: count - shown };
};

const clampNum = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, Math.round(v)));

const moreRow = (count: number, label: string): string =>
  `<div class="more-row">+${count} more ${esc(label)}</div>`;

const POSTER_PLACEHOLDER =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI5OCIgZmlsbD0iI0Y1RjVGNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjVGNUY1Ii8+PC9zdmc+';

/** Escape user-supplied text so movie titles / names with &, <, > can't break the SVG/HTML markup. */
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const convertImageToBase64 = async (url: string): Promise<string> => {
  try {
    if (!url || url.trim() === '') return POSTER_PLACEHOLDER;
    if (url.startsWith('data:')) return url;

    const testImg = new Image();
    testImg.crossOrigin = 'anonymous';

    const imageLoadPromise = new Promise<string>((resolve, reject) => {
      testImg.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');
          canvas.width = testImg.width;
          canvas.height = testImg.height;
          ctx.drawImage(testImg, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (canvasError) {
          // Fallback to fetch method
          try {
            const response = await fetch(url, { mode: 'cors', headers: { Accept: 'image/*' } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('FileReader failed'));
            reader.readAsDataURL(blob);
          } catch (fetchError) {
            reject(fetchError);
          }
        }
      };
      testImg.onerror = () => reject(new Error('Image failed to load'));
    });

    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Image load timeout')), 10000);
    });

    testImg.src = url;
    return await Promise.race([imageLoadPromise, timeoutPromise]);
  } catch (error) {
    console.warn('Failed to convert image to base64:', url, error);
    return POSTER_PLACEHOLDER;
  }
};

/** "THE [NAME] DRAFT" title with the middle words highlighted purple. */
const renderTitleHtml = (rawTitle: string): string => {
  const titleParts = rawTitle.split(' ').filter(Boolean);
  let processedTitle: string;
  let highlightStartIndex: number;
  let highlightEndIndex: number;

  if (
    titleParts.length === 0 ||
    titleParts[0].toUpperCase() !== 'THE' ||
    titleParts[titleParts.length - 1].toUpperCase() !== 'DRAFT'
  ) {
    const nameWords = titleParts.filter(
      (word) => word.toUpperCase() !== 'THE' && word.toUpperCase() !== 'DRAFT'
    );
    processedTitle = `THE ${nameWords.join(' ')} DRAFT`;
    highlightStartIndex = 1;
    highlightEndIndex = nameWords.length;
  } else {
    processedTitle = rawTitle;
    highlightStartIndex = 1;
    highlightEndIndex = titleParts.length - 2;
  }

  const titleWords = processedTitle.split(' ');
  return `<h1 class="title">${titleWords
    .map((word, index) =>
      index >= highlightStartIndex && index <= highlightEndIndex
        ? `<span class="highlight">${esc(word)}</span>`
        : esc(word)
    )
    .join(' ')}</h1>`;
};

const rankCard = (playerName: string, score: number, index: number, fit: RowFit): string => {
  const nameFont = clampNum(fit.rowH * 0.42, 20, 32);
  const scoreFont = clampNum(fit.rowH * 0.66, 30, 48);
  const padV = clampNum((fit.rowH - 48) / 2, 4, 20); // rank medal is fixed at 48px
  return `
  <div class="score-card" style="padding:${padV}px 20px;">
    <div class="rank-circle rank-${index + 1}"><span>${index + 1}</span></div>
    <div class="player-name" style="font-size:${nameFont}px;">${esc(playerName)}</div>
    <div class="player-score" style="font-size:${scoreFont}px;">${score.toFixed(1)}</div>
  </div>`;
};

const movieCard = (movie: ShareScoredMovie, sectionTitle: string, posterSrc: string): string => `
  <div class="section">
    <h2 class="section-title">${esc(sectionTitle)}</h2>
    <div class="movie-card">
      <img class="movie-poster" src="${posterSrc}" alt="${esc(movie.title)} poster" />
      <div class="movie-info">
        <div class="movie-top-section">
          <h3 class="movie-title">${esc(movie.title)}</h3>
          <p class="movie-details">${movie.year ? `${esc(movie.year)} • ` : ''}${esc(movie.genre || '')}</p>
          <div class="movie-pick-category">
            <div class="pick-circle">${esc(movie.pickNumber ?? 1)}</div>
            ${movie.category ? `<div class="category-badge">${esc(movie.category)}</div>` : ''}
          </div>
        </div>
        <div class="movie-score">${movie.score.toFixed(2)}</div>
      </div>
    </div>
  </div>`;

/** Compact text row used by my-team and full-list (no posters → fast, many rows fit). */
const listRow = (movie: ShareScoredMovie, showPlayer: boolean, fit: RowFit): string => {
  const num = clampNum(fit.rowH * 0.6, 30, 44);
  const titleFont = clampNum(fit.rowH * 0.42, 18, 30);
  const subFont = clampNum(fit.rowH * 0.3, 13, 22);
  const scoreFont = clampNum(fit.rowH * 0.58, 26, 40);
  const padV = clampNum((fit.rowH - num) / 2, 6, 18);
  return `
  <div class="list-card" style="padding:${padV}px 20px;">
    <div class="list-num" style="width:${num}px;height:${num}px;font-size:${clampNum(num * 0.5, 14, 24)}px;">${esc(movie.pickNumber ?? '•')}</div>
    <div class="list-main">
      <div class="list-title" style="font-size:${titleFont}px;">${esc(movie.title)}</div>
      <div class="list-sub" style="font-size:${subFont}px;">${showPlayer ? esc(movie.playerName) : esc(movie.category || '')}</div>
    </div>
    <div class="list-score" style="font-size:${scoreFont}px;">${movie.score.toFixed(1)}</div>
  </div>`;
};

const renderLeaderboardBody = (
  data: ShareImageData,
  format: ShareFormat,
  firstPickPoster: string,
  bestMoviePoster: string
): string => {
  const sorted = [...data.teamScores].sort((a, b) => b.averageScore - a.averageScore);
  const playerCount = sorted.length;
  const showCards = FORMAT_STYLE[format].showMovieCards && playerCount <= 6;
  const budget = showCards ? LEADERBOARD_BUDGET_WITH_CARDS : ROWS_BUDGET[format];
  const fit = fitRows(playerCount, budget, 56, 88);
  const scores =
    sorted
      .slice(0, fit.shown)
      .map((team, index) => rankCard(team.playerName, team.averageScore, index, fit))
      .join('') + (fit.more > 0 ? moreRow(fit.more, 'players') : '');

  const highlights = showCards
    ? `${data.firstPick ? movieCard(data.firstPick, 'FIRST PICK', firstPickPoster) : ''}
       ${data.bestMovie ? movieCard(data.bestMovie, 'HIGHEST SCORER', bestMoviePoster) : ''}`
    : '';

  return `
    ${renderTitleHtml(data.title)}
    <div class="section">
      <h2 class="section-title">TOP SCORES</h2>
      <div class="scores-container">${scores}</div>
    </div>
    ${highlights}`;
};

const renderMyTeamBody = (data: ShareImageData, format: ShareFormat): string => {
  const player = data.focusPlayer || data.teamScores[0]?.playerName || 'Player';
  const score = data.focusPlayerScore ?? data.teamScores.find((t) => t.playerName === player)?.averageScore ?? 0;
  const all = data.focusPlayerPicks || [];
  const fit = fitRows(all.length, ROWS_BUDGET[format], 40, 68);
  const rows =
    all
      .slice(0, fit.shown)
      .map((p) => listRow(p, false, fit))
      .join('') + (fit.more > 0 ? moreRow(fit.more, 'picks') : '');

  return `
    ${renderTitleHtml(data.title)}
    <div class="section">
      <div class="team-header">
        <div class="team-name">${esc(player)}</div>
        <div class="team-score-pill"><span class="team-score-label">AVG</span><span class="team-score-val">${score.toFixed(1)}</span></div>
      </div>
      <div class="scores-container">${rows}</div>
    </div>`;
};

const renderFullListBody = (data: ShareImageData, format: ShareFormat): string => {
  const all = data.allPicks || [];
  const ctaReserve = data.votingOpen && data.voteUrl ? 140 : 0;
  const fit = fitRows(all.length, ROWS_BUDGET[format] - ctaReserve, 40, 68);
  const rows =
    all
      .slice(0, fit.shown)
      .map((p) => listRow(p, true, fit))
      .join('') + (fit.more > 0 ? moreRow(fit.more, 'picks') : '');

  const voteCta =
    data.votingOpen && data.voteUrl
      ? `<div class="vote-cta">
           <div class="vote-cta-title">VOTE NOW</div>
           <div class="vote-cta-url">${esc(data.voteUrl.replace(/^https?:\/\//, ''))}</div>
         </div>`
      : '';

  return `
    ${renderTitleHtml(data.title)}
    <div class="section">
      <h2 class="section-title">THE DRAFT BOARD</h2>
      <div class="scores-container">${rows}</div>
    </div>
    ${voteCta}`;
};

const buildStyles = (fontCSS: string, format: ShareFormat): string => {
  const { pad: containerPad, gap, titleSize } = FORMAT_STYLE[format];
  const containerGap = `${gap}px`;

  return `
    ${fontCSS}

    .main-container {
      display: flex;
      flex-direction: column;
      padding: ${containerPad};
      gap: ${containerGap};
      font-family: 'Brockmann', Arial, sans-serif;
    }

    .title {
      font-family: 'CHANEY', serif;
      font-size: ${titleSize}px;
      font-weight: 400;
      letter-spacing: 2.56px;
      text-align: center;
      color: #FCFFFF;
      margin: 0;
      line-height: ${titleSize}px;
    }
    .title .highlight { color: #7142FF; }

    .section { display: flex; flex-direction: column; gap: 24px; }
    .section-title {
      font-family: 'Brockmann', Arial, sans-serif;
      font-size: 48px; font-weight: 700; letter-spacing: 1.92px;
      text-align: center; color: #FCFFFF; margin: 0;
    }

    .scores-container { display: flex; flex-direction: column; gap: 10px; }

    .more-row {
      display: flex; align-items: center; justify-content: center;
      padding: 8px; color: #BCB2FF; font-weight: 500; font-size: 24px;
      font-family: 'Brockmann', Arial, sans-serif;
    }

    .score-card {
      display: flex; align-items: center; padding: 20px;
      background: #0E0E0F; border: 1px solid #49474B; border-radius: 8px; gap: 16px;
    }
    .rank-circle {
      width: 48px; height: 48px; position: relative; display: flex;
      align-items: center; justify-content: center;
      font-family: 'Brockmann', Arial, sans-serif; font-size: 24px; font-weight: 700;
      color: #2B2D2D; flex-shrink: 0;
    }
    .rank-circle::before { content: ''; position: absolute; width: 48px; height: 48px; border-radius: 50%; z-index: 1; }
    .rank-circle::after { content: ''; position: absolute; width: 42px; height: 42px; border-radius: 50%; z-index: 2; }
    .rank-circle span { position: relative; z-index: 3; }
    .rank-1::before { background: linear-gradient(to bottom right, #FFF2B2, #F0AA11); }
    .rank-1::after { background: #FFD60A; }
    .rank-2::before { background: linear-gradient(to bottom right, #E5E5E5, #666666); }
    .rank-2::after { background: #CCCCCC; }
    .rank-3::before { background: linear-gradient(to bottom right, #FFAE78, #95430C); }
    .rank-3::after { background: #DE7E3E; }
    .rank-4::before, .rank-5::before, .rank-6::before, .rank-7::before, .rank-8::before { background: #907AFF; }
    .rank-4::after, .rank-5::after, .rank-6::after, .rank-7::after, .rank-8::after { background: #907AFF; }

    .player-name {
      font-family: 'Brockmann', Arial, sans-serif; font-size: 32px; font-weight: 500;
      color: #FCFFFF; flex-grow: 1; margin: 0;
    }
    .player-score {
      font-family: 'Brockmann', Arial, sans-serif; font-size: 48px; font-weight: 900;
      color: #7142FF; margin: 0;
    }

    /* my-team header */
    .team-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .team-name {
      font-family: 'Brockmann', Arial, sans-serif; font-size: 44px; font-weight: 700; color: #FCFFFF; margin: 0;
    }
    .team-score-pill {
      display: flex; align-items: baseline; gap: 8px; padding: 8px 20px;
      background: #25015E; border: 1.86px solid #907AFF; border-radius: 9999px;
    }
    .team-score-label { font-size: 22px; font-weight: 500; color: #BCB2FF; }
    .team-score-val { font-size: 40px; font-weight: 700; color: #FCFFFF; }

    /* compact list rows */
    .list-card {
      display: flex; align-items: center; padding: 16px 20px;
      background: #0E0E0F; border: 1px solid #49474B; border-radius: 8px; gap: 16px;
    }
    .list-num {
      width: 44px; height: 44px; border: 1.86px solid #7142FF; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Brockmann', Arial, sans-serif; font-size: 24px; font-weight: 400; color: #FCFFFF; flex-shrink: 0;
    }
    .list-main { display: flex; flex-direction: column; flex-grow: 1; min-width: 0; gap: 2px; }
    .list-title { font-size: 30px; font-weight: 600; color: #FCFFFF; }
    .list-sub { font-size: 22px; font-weight: 400; color: #BCB2FF; }
    .list-score { font-size: 40px; font-weight: 900; color: #7142FF; flex-shrink: 0; }

    /* full-list vote CTA */
    .vote-cta {
      display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px;
      background: #7142FF; border-radius: 12px;
    }
    .vote-cta-title { font-size: 44px; font-weight: 700; letter-spacing: 1.92px; color: #FCFFFF; }
    .vote-cta-url { font-size: 26px; font-weight: 500; color: #EDEBFF; }

    /* movie highlight cards (leaderboard / story) */
    .movie-card {
      display: flex; padding: 24px; background: #0E0E0F; border: 1px solid #49474B;
      border-radius: 4px; gap: 16px; align-items: flex-start;
    }
    .movie-poster { width: 200px; height: 298px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
    .movie-info { display: flex; flex-direction: column; flex-grow: 1; height: 298px; justify-content: space-between; }
    .movie-title { font-size: 36px; font-weight: 600; color: #FCFFFF; margin: 0; line-height: 1.2; }
    .movie-details { font-size: 24px; font-weight: 400; color: #FCFFFF; margin: 0; }
    .movie-top-section { display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
    .movie-pick-category { display: flex; align-items: center; gap: 16px; }
    .pick-circle {
      width: 52px; height: 52px; background: #7142FF; border: 1.86px solid #7142FF; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 33px; font-weight: 400; color: #fcffff; flex-shrink: 0;
    }
    .category-badge {
      padding: 8px 16px; background: #25015E; border: 1.86px solid #907AFF; border-radius: 8px;
      font-size: 24px; font-weight: 500; color: #fcffff;
    }
    .movie-score { font-size: 48px; font-weight: 900; color: #7142FF; margin: 0; text-align: right; }
  `;
};

const MOVIEDRAFTER_LOGO = `
  <svg width="828" height="39" viewBox="0 0 428 27" fill="none">
    <path d="M44.5008 0.690016V25.656C44.5008 26.0324 44.1876 26.3461 43.8118 26.3461H37.0787C36.7029 26.3461 36.3898 26.0324 36.3898 25.656V11.6048C36.3898 11.0403 35.7321 10.7266 35.2937 11.0716L22.7984 20.9828C22.5479 21.1709 22.2034 21.1709 21.9529 20.9828L9.17574 10.9775C8.73731 10.6325 8.07966 10.9775 8.07966 11.5107V25.656C8.07966 26.0324 7.76649 26.3461 7.3907 26.3461H0.688963C0.313165 26.3461 0 26.0324 0 25.656V0.690016C0 0.313644 0.313165 0 0.688963 0H7.86044C7.86044 0 8.14229 0.0627287 8.26756 0.125457L22.0155 10.6012C22.266 10.7893 22.6105 10.7893 22.8297 10.6012L36.2645 0.156822C36.2645 0.156822 36.5464 0 36.6716 0H43.8431C44.2189 0 44.5321 0.313644 44.5321 0.690016H44.5008Z" fill="#FCFFFF"/>
    <path d="M85.5485 26.3461H48.689C48.3132 26.3461 48 26.0324 48 25.656V0.690016C48 0.313644 48.3132 0 48.689 0H85.5485C85.9243 0 86.2375 0.313644 86.2375 0.690016V25.656C86.2375 26.0324 85.9243 26.3461 85.5485 26.3461ZM77.9699 18.3795V7.87245C77.9699 7.49608 77.6567 7.18244 77.2809 7.18244H56.9565C56.5807 7.18244 56.2676 7.49608 56.2676 7.87245V18.3795C56.2676 18.7559 56.5807 19.0695 56.9565 19.0695H77.2809C77.6567 19.0695 77.9699 18.7559 77.9699 18.3795Z" fill="#FCFFFF"/>
    <path d="M127.302 0.940931L116.247 25.907C116.153 26.1579 115.902 26.3147 115.621 26.3147H100.338V26.1265L89.1894 0.940931C89.0015 0.50183 89.3147 0 89.8158 0H97.1438C97.4257 0 97.6449 0.156822 97.7701 0.407737L105.599 18.6618C105.693 18.9127 105.944 19.0695 106.226 19.0695H110.203C110.485 19.0695 110.704 18.9127 110.829 18.6618L118.627 0.407737C118.721 0.156822 118.971 0 119.253 0H126.675C127.176 0 127.49 0.50183 127.302 0.940931Z" fill="#FCFFFF"/>
    <path d="M152.01 7.93518V18.3795C152.01 18.7559 152.323 19.0695 152.699 19.0695H165.132C165.508 19.0695 165.821 19.3832 165.821 19.7595V25.656C165.821 26.0324 165.508 26.3461 165.132 26.3461H130.684C130.308 26.3461 129.995 26.0324 129.995 25.656V19.7595C129.995 19.3832 130.308 19.0695 130.684 19.0695H143.085C143.461 19.0695 143.774 18.7559 143.774 18.3795V7.93518C143.774 7.55881 143.461 7.24517 143.085 7.24517H130.684C130.308 7.24517 129.995 6.93152 129.995 6.55515V0.690016C129.995 0.313644 130.308 0 130.684 0H165.132C165.508 0 165.821 0.313644 165.821 0.690016V6.58651C165.821 6.96289 165.508 7.27653 165.132 7.27653H152.699C152.323 7.27653 152.01 7.59017 152.01 7.96655V7.93518Z" fill="#FCFFFF"/>
    <path d="M177.815 7.15107V9.78568H202.743C203.119 9.78568 203.432 10.0993 203.432 10.4757V15.9645C203.432 16.3408 203.119 16.6545 202.743 16.6545H177.815V19.2263H205.311C205.687 19.2263 206 19.54 206 19.9164V25.7188C206 26.0951 205.687 26.4088 205.311 26.4088H170.237C169.861 26.4088 169.548 26.0951 169.548 25.7188V0.690016C169.548 0.313644 169.861 0 170.237 0H205.311C205.687 0 206 0.313644 206 0.690016V6.49242C206 6.86879 205.687 7.18244 205.311 7.18244H177.815V7.15107Z" fill="#FCFFFF"/>
    <path d="M266.501 13.2357C266.501 21.3591 260.269 26.4088 252.033 26.4088H222.689C222.313 26.4088 222 26.0951 222 25.7188V0.75273C222 0.376358 222.313 0.0627136 222.689 0.0627136H252.064C260.3 0.0627136 266.532 5.08101 266.532 13.2357H266.501ZM258.108 13.2357C258.108 9.84839 255.54 7.27652 252.064 7.27652H230.894C230.518 7.27652 230.205 7.59016 230.205 7.96653V18.505C230.205 18.8813 230.518 19.195 230.894 19.195H252.033C255.54 19.1322 258.077 16.5917 258.077 13.2357H258.108Z" fill="#FCFFFF"/>
    <path d="M315.448 0.564546C315.355 0.282267 315.104 0.0627136 314.791 0.0627136H300.824C300.51 0.0627136 300.26 0.282267 300.166 0.564546L293.809 24.6837L290.113 19.0695C289.926 18.7559 289.988 18.3795 290.301 18.1599C292.838 16.3095 294.279 13.4239 294.279 10.2248C294.279 4.61055 289.832 0.0627136 283.13 0.0627136H269.507C269.131 0.0627136 268.818 0.376358 268.818 0.75273V25.7188C268.818 26.0951 269.131 26.4088 269.507 26.4088H276.459C276.835 26.4088 277.148 26.0951 277.148 25.7188V21.0455C277.148 20.6691 277.462 20.3555 277.837 20.3555H281.47C281.721 20.3555 281.94 20.4809 282.065 20.7005L285.228 26.0638C285.353 26.2833 285.572 26.4088 285.823 26.4088H301.231C301.544 26.4088 301.794 26.1892 301.888 25.9069L302.703 22.7391C302.765 22.4255 303.047 22.2373 303.36 22.2373H312.348C312.661 22.2373 312.912 22.4569 313.006 22.7391L313.82 25.9069C313.883 26.2206 314.164 26.4088 314.478 26.4088H321.461C321.9 26.4088 322.244 26.001 322.119 25.5619L315.542 0.595908L315.448 0.564546ZM283.099 13.1103H277.775C277.399 13.1103 277.086 12.7966 277.086 12.4203V7.9979C277.086 7.62152 277.399 7.30788 277.775 7.30788H283.099C284.664 7.30788 285.98 8.59382 285.98 10.1934C285.98 11.793 284.664 13.0789 283.099 13.0789V13.1103ZM310.031 14.8981H305.552C305.114 14.8981 304.801 14.4903 304.895 14.0512L306.617 7.33925H308.935L310.657 14.0512C310.782 14.4903 310.438 14.8981 309.999 14.8981H310.031Z" fill="#FCFFFF"/>
    <path d="M373.603 0.0627271H325.125C324.749 0.0627271 324.436 0.376372 324.436 0.752744V25.7188C324.436 26.0951 324.749 26.4088 325.125 26.4088H332.046C332.422 26.4088 332.735 26.0951 332.735 25.7188V18.6618C332.735 18.2854 333.048 17.9718 333.424 17.9718H350.961C351.337 17.9718 351.65 17.6581 351.65 17.2818V11.4794C351.65 11.103 351.337 10.7893 350.961 10.7893H332.767V7.27653H356.661C357.037 7.27653 357.35 7.59017 357.35 7.96654V25.6874C357.35 26.0638 357.663 26.3774 358.039 26.3774H364.96C365.336 26.3774 365.649 26.0638 365.649 25.6874V7.96654C365.649 7.59017 365.962 7.27653 366.338 7.27653H373.729C374.104 7.27653 374.417 6.96289 374.417 6.58651V0.690017C374.417 0.313644 374.104 0 373.729 0L373.603 0.0627271Z" fill="#FCFFFF"/>
    <path d="M385.472 7.2138V9.8484H395.4C395.775 9.8484 396.089 10.162 396.089 10.5384V16.0272C396.089 16.4035 395.775 16.7172 395.4 16.7172H385.472V19.2263H397.936C398.312 19.2263 398.625 19.54 398.625 19.9164V25.7501C398.625 26.1265 398.312 26.4401 397.936 26.4401H377.894C377.518 26.4401 377.205 26.1265 377.205 25.7501V0.784102C377.205 0.40773 377.518 0.0940857 377.894 0.0940857H397.936C398.312 0.0940857 398.625 0.40773 398.625 0.784102V6.58651C398.625 6.96288 398.312 7.27652 397.936 7.27652H385.472V7.2138Z" fill="#FCFFFF"/>
    <path d="M401.976 0.75273C401.976 0.376358 402.289 0.0627136 402.665 0.0627136H416.288C423.021 0.0627136 427.436 4.61055 427.436 10.2248C427.436 13.4239 425.996 16.3095 423.459 18.1599C423.177 18.3795 423.083 18.7559 423.271 19.0695L427.405 25.3424C427.687 25.7815 427.405 26.4088 426.841 26.4088H418.918C418.668 26.4088 418.448 26.2833 418.323 26.0638L415.16 20.7005C415.035 20.4809 414.816 20.3555 414.565 20.3555H410.933C410.557 20.3555 410.244 20.6691 410.244 21.0455V25.7188C410.244 26.0951 409.93 26.4088 409.555 26.4088H402.602C402.227 26.4088 401.913 26.0951 401.913 25.7188V0.75273H401.976ZM416.288 13.1103C417.853 13.1103 419.169 11.8243 419.169 10.2248C419.169 8.62518 417.853 7.33925 416.288 7.33925H410.964C410.588 7.33925 410.275 7.65289 410.275 8.02926V12.4516C410.275 12.828 410.588 13.1416 410.964 13.1416H416.288V13.1103Z" fill="#FCFFFF"/>
  </svg>`;

/**
 * Build a branded share image (SVG string) for the chosen story + size.
 * Backwards compatible: `generateShareImageSVG(data)` renders the leaderboard story (1080×1920) as before.
 */
export const generateShareImageSVG = async (
  data: ShareImageData,
  options: GenerateOptions = {}
): Promise<string> => {
  const format: ShareFormat = options.format ?? 'story';
  const variant: ShareVariant = options.variant ?? 'leaderboard';
  const { width, height } = FORMAT_DIMS[format];

  // Posters are only needed for the leaderboard highlight cards (formats that show them).
  const needPosters =
    variant === 'leaderboard' && FORMAT_STYLE[format].showMovieCards && data.teamScores.length <= 6;
  const [firstPickPoster, bestMoviePoster] = needPosters
    ? await Promise.all([
        data.firstPick?.poster ? convertImageToBase64(data.firstPick.poster) : Promise.resolve(POSTER_PLACEHOLDER),
        data.bestMovie?.poster ? convertImageToBase64(data.bestMovie.poster) : Promise.resolve(POSTER_PLACEHOLDER),
      ])
    : [POSTER_PLACEHOLDER, POSTER_PLACEHOLDER];

  const fontCSS = await generateFontCSS();

  let body: string;
  if (variant === 'my-team') {
    body = renderMyTeamBody(data, format);
  } else if (variant === 'full-list') {
    body = renderFullListBody(data, format);
  } else {
    body = renderLeaderboardBody(data, format, firstPickPoster, bestMoviePoster);
  }

  const logoX = Math.round((width - 828) / 2);
  const logoY = height - 136;

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="16%" stop-color="#100029"/>
      <stop offset="50%" stop-color="#160038"/>
      <stop offset="86%" stop-color="#100029"/>
    </linearGradient>
    <style>
      <![CDATA[
        ${buildStyles(fontCSS, format)}
      ]]>
    </style>
  </defs>

  <rect width="100%" height="100%" fill="url(#backgroundGradient)"/>

  <foreignObject x="0" y="0" width="${width}" height="${logoY - 16}">
    <div xmlns="http://www.w3.org/1999/xhtml" class="main-container">
      ${body}
    </div>
  </foreignObject>

  <g transform="translate(${logoX}, ${logoY})">
    ${MOVIEDRAFTER_LOGO}
  </g>
</svg>
  `.trim();
};
