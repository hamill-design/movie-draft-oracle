
// AdSense Configuration
// Replace these values with your actual Google AdSense account details

export const ADSENSE_CONFIG = {
  // Your Google AdSense Publisher ID (starts with ca-pub-)
  publisherId: 'ca-pub-9345315552399786', // Google AdSense Publisher ID
  
  // Ad slot IDs for different ad units
  adSlots: {
    banner: '1234567890',        // 728x90 banner ad
    bannerMobile: '1234567891',  // 320x50 mobile banner
    sidebar: '1234567892',       // 300x250 sidebar ad
    inline: '1234567893',        // Fluid inline ad
    footer: '1234567894',        // Footer ad
  },
  
  // Ad sizes
  sizes: {
    banner: { width: '728px', height: '90px' },
    bannerMobile: { width: '320px', height: '50px' },
    sidebar: { width: '300px', height: '250px' },
    square: { width: '300px', height: '300px' },
  }
};

// Environment check - disable ads in development if needed
export const ADS_ENABLED = process.env.NODE_ENV === 'production';
