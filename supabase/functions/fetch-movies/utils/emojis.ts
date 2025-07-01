
// Helper function to get movie emoji based on genre
export function getMovieEmoji(genreId: number): string {
  const emojiMap: { [key: number]: string } = {
    28: '💥', // Action
    12: '🗺️', // Adventure
    16: '🎨', // Animation
    35: '😂', // Comedy
    80: '🔫', // Crime
    99: '📽️', // Documentary
    18: '🎭', // Drama
    10751: '👨‍👩‍👧‍👦', // Family
    14: '🧙‍♂️', // Fantasy
    36: '🏛️', // History
    27: '👻', // Horror
    10402: '🎵', // Music
    9648: '🔍', // Mystery
    10749: '💕', // Romance
    878: '🚀', // Sci-Fi
    53: '😰', // Thriller
    10752: '⚔️', // War
    37: '🤠'  // Western
  };
  return emojiMap[genreId] || '🎬';
}

// Helper function to get person emoji based on department
export function getPersonEmoji(department: string): string {
  const emojiMap: { [key: string]: string } = {
    'Acting': '🎭',
    'Directing': '🎬',
    'Writing': '✍️',
    'Production': '🎞️',
    'Camera': '📷',
    'Editing': '✂️',
    'Sound': '🔊',
    'Art': '🎨',
    'Costume & Make-Up': '👗',
    'Visual Effects': '✨'
  };
  return emojiMap[department] || '👤';
}
