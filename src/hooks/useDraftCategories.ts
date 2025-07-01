
export const useDraftCategories = (theme: string | null) => {
  const yearCategories = [
    'Action/Adventure',
    'Animated',
    'Comedy',
    'Drama/Romance',
    'Sci-Fi/Fantasy',
    'Horror/Thriller',
    'Academy Award Nominee or Winner',
    'Blockbuster (minimum of $50 Mil)'
  ];

  const peopleCategories = [
    'Action/Adventure',
    'Animated',
    'Comedy',
    'Drama/Romance',
    'Sci-Fi/Fantasy',
    'Horror/Thriller',
    "70's",
    "80's",
    "90's",
    "2000's",
    "2010's",
    "2020's",
    'Academy Award Nominee or Winner',
    'Blockbuster (minimum of $50 Mil)'
  ];

  return theme === 'year' ? yearCategories : peopleCategories;
};
