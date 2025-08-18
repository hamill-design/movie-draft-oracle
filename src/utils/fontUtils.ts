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
  console.log('Loading fonts for SVG...');
  
  const fonts = [
    { family: 'Brockmann', weight: 400, path: '/fonts/brockmann/brockmann-regular.woff2' },
    { family: 'Brockmann', weight: 500, path: '/fonts/brockmann/brockmann-medium.woff2' },
    { family: 'Brockmann', weight: 600, path: '/fonts/brockmann/brockmann-semibold.woff2' },
    { family: 'Brockmann', weight: 700, path: '/fonts/brockmann/brockmann-bold.woff2' },
    { family: 'Chaney', weight: 400, path: '/fonts/chaney/chaney-extended.woff2' },
  ];

  const fontFaces: string[] = [];
  let fontsLoaded = 0;

  // Load fonts with timeout and fallback
  const fontPromises = fonts.map(async (font) => {
    try {
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Font load timeout')), 3000);
      });
      
      const loadPromise = loadFontAsBase64(font.path);
      const base64 = await Promise.race([loadPromise, timeoutPromise]);
      
      if (base64) {
        fontsLoaded++;
        return `
          @font-face {
            font-family: '${font.family}';
            src: url('data:font/woff2;base64,${base64}') format('woff2');
            font-weight: ${font.weight};
            font-style: normal;
            font-display: swap;
          }
        `;
      }
    } catch (error) {
      console.warn(`Failed to load font ${font.family} ${font.weight}:`, error);
    }
    return '';
  });

  const results = await Promise.all(fontPromises);
  fontFaces.push(...results.filter(Boolean));
  
  console.log(`Loaded ${fontsLoaded}/${fonts.length} fonts for SVG generation`);

  // Use strong system font fallbacks to prevent canvas tainting
  return fontFaces.join('\n') + `
    text { 
      font-family: 'Brockmann', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
    }
    .chaney { 
      font-family: 'Chaney', 'Impact', 'Arial Black', -apple-system, BlinkMacSystemFont, sans-serif; 
      font-weight: 400; 
    }
    .brockmann { 
      font-family: 'Brockmann', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
      font-weight: 400; 
    }
    .brockmann-medium { 
      font-family: 'Brockmann', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
      font-weight: 500; 
    }
    .brockmann-semibold { 
      font-family: 'Brockmann', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
      font-weight: 600; 
    }
    .brockmann-bold { 
      font-family: 'Brockmann', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
      font-weight: 700; 
    }
  `;
};