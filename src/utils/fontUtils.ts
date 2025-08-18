// Font loading and base64 conversion utilities for SVG generation

const loadFontAsBase64 = async (fontPath: string): Promise<string> => {
  try {
    const response = await fetch(fontPath);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.warn(`Failed to load font: ${fontPath}`, error);
    return '';
  }
};

export const generateFontCSS = async (): Promise<string> => {
  const fonts = [
    { family: 'Brockmann', weight: 400, path: '/fonts/brockmann/brockmann-regular.woff2' },
    { family: 'Brockmann', weight: 500, path: '/fonts/brockmann/brockmann-medium.woff2' },
    { family: 'Brockmann', weight: 600, path: '/fonts/brockmann/brockmann-semibold.woff2' },
    { family: 'Brockmann', weight: 700, path: '/fonts/brockmann/brockmann-bold.woff2' },
    { family: 'Chaney', weight: 400, path: '/fonts/chaney/chaney-extended.woff2' },
  ];

  const fontFaces: string[] = [];

  for (const font of fonts) {
    const base64 = await loadFontAsBase64(font.path);
    if (base64) {
      fontFaces.push(`
        @font-face {
          font-family: '${font.family}';
          src: url('data:font/woff2;base64,${base64}') format('woff2');
          font-weight: ${font.weight};
          font-style: normal;
        }
      `);
    }
  }

  return fontFaces.join('\n') + `
    text { font-family: 'Brockmann', 'Arial', sans-serif; }
    .chaney { font-family: 'Chaney', 'Arial Black', sans-serif; font-weight: 400; }
    .brockmann { font-family: 'Brockmann', 'Arial', sans-serif; font-weight: 400; }
    .brockmann-medium { font-family: 'Brockmann', 'Arial', sans-serif; font-weight: 500; }
    .brockmann-semibold { font-family: 'Brockmann', 'Arial', sans-serif; font-weight: 600; }
    .brockmann-bold { font-family: 'Brockmann', 'Arial', sans-serif; font-weight: 700; }
  `;
};