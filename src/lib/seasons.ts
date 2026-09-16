// Universal quarterly season system: Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
// Quarters are computed from dates, never stored — mirrors the EXTRACT(YEAR/QUARTER ...)
// logic in the league_season_standings view.

export interface Quarter {
  year: number;
  quarter: 1 | 2 | 3 | 4;
}

export const getQuarter = (date: string | Date): Quarter => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return {
    year: d.getFullYear(),
    quarter: (Math.floor(d.getMonth() / 3) + 1) as 1 | 2 | 3 | 4,
  };
};

export const currentQuarter = (): Quarter => getQuarter(new Date());

export const quarterId = (q: Quarter): string => `${q.year}-Q${q.quarter}`;

export const parseQuarterId = (id: string): Quarter => {
  const [year, q] = id.split('-Q');
  return { year: Number(year), quarter: Number(q) as 1 | 2 | 3 | 4 };
};

export const quarterLabel = (q: Quarter): string => `Q${q.quarter} ${q.year}`;

export const quarterRange = (q: Quarter): { start: Date; end: Date } => {
  const start = new Date(q.year, (q.quarter - 1) * 3, 1);
  const end = new Date(q.year, q.quarter * 3, 1);
  return { start, end };
};

export const quartersEqual = (a: Quarter, b: Quarter): boolean =>
  a.year === b.year && a.quarter === b.quarter;

/** Sorts most recent first. */
export const compareQuartersDesc = (a: Quarter, b: Quarter): number =>
  b.year - a.year || b.quarter - a.quarter;
