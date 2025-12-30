#!/usr/bin/env node

/**
 * Script to generate favicon PNGs from SVG
 * This script requires sharp to be installed: npm install sharp --save-dev
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SVG content for the favicon
const svgContent = `<svg width="32" height="32" viewBox="0 0 45 57" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M44.5008 0.690016V25.656C44.5008 26.0324 44.1876 26.3461 43.8118 26.3461H37.0787C36.7029 26.3461 36.3898 26.0324 36.3898 25.656V11.6048C36.3898 11.0403 35.7321 10.7266 35.2937 11.0716L22.7984 20.9828C22.5479 21.1709 22.2034 21.1709 21.9529 20.9828L9.17574 10.9775C8.73731 10.6325 8.07966 10.9775 8.07966 11.5107V25.656C8.07966 26.0324 7.76649 26.3461 7.3907 26.3461H0.688963C0.313165 26.3461 0 26.0324 0 25.656V0.690016C0 0.313644 0.313165 0 0.688963 0H7.86044C7.86044 0 8.14229 0.0627287 8.26756 0.125457L22.0155 10.6012C22.266 10.7893 22.6105 10.7893 22.8297 10.6012L36.2645 0.156822C36.2645 0.156822 36.5464 0 36.6716 0H43.8431C44.2189 0 44.5321 0.313644 44.5321 0.690016H44.5008Z" fill="#680AFF"/>
  <path d="M44.5008 43.5191C44.5008 51.6425 38.2688 56.6921 30.0325 56.6921H0.688963C0.313165 56.6921 0 56.3785 0 56.0021V31.0361C0 30.6597 0.313165 30.3461 0.688963 30.3461H30.0639C38.3001 30.3461 44.5321 35.3644 44.5321 43.5191H44.5008ZM36.1079 43.5191C36.1079 40.1317 33.54 37.5599 30.0639 37.5599H8.89389C8.51809 37.5599 8.20493 37.8735 8.20493 38.2499V48.7883C8.20493 49.1647 8.51809 49.4783 8.89389 49.4783H30.0325C33.54 49.4156 36.0766 46.8751 36.0766 43.5191H36.1079Z" fill="#680AFF"/>
</svg>`;

async function generateFavicons() {
  try {
    // Try to import sharp
    const sharp = (await import('sharp')).default;
    
    const publicDir = path.join(__dirname, 'public');
    
    // Generate 16x16 favicon
    await sharp(Buffer.from(svgContent))
      .resize(16, 16)
      .png()
      .toFile(path.join(publicDir, 'favicon-16x16.png'));
    
    console.log('✓ Generated favicon-16x16.png');
    
    // Generate 32x32 favicon
    await sharp(Buffer.from(svgContent))
      .resize(32, 32)
      .png()
      .toFile(path.join(publicDir, 'favicon-32x32.png'));
    
    console.log('✓ Generated favicon-32x32.png');
    
    // Generate 180x180 apple-touch-icon
    await sharp(Buffer.from(svgContent))
      .resize(180, 180)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    
    console.log('✓ Generated apple-touch-icon.png');
    
    // Generate 1200x630 Open Graph image
    const ogSvg = `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#100029;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#160038;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#100029;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bgGradient)"/>
      
      <!-- Logo -->
      <g transform="translate(600, 200)">
        <g transform="translate(-90, -28) scale(4)">
          <path d="M44.5008 0.690016V25.656C44.5008 26.0324 44.1876 26.3461 43.8118 26.3461H37.0787C36.7029 26.3461 36.3898 26.0324 36.3898 25.656V11.6048C36.3898 11.0403 35.7321 10.7266 35.2937 11.0716L22.7984 20.9828C22.5479 21.1709 22.2034 21.1709 21.9529 20.9828L9.17574 10.9775C8.73731 10.6325 8.07966 10.9775 8.07966 11.5107V25.656C8.07966 26.0324 7.76649 26.3461 7.3907 26.3461H0.688963C0.313165 26.3461 0 26.0324 0 25.656V0.690016C0 0.313644 0.313165 0 0.688963 0H7.86044C7.86044 0 8.14229 0.0627287 8.26756 0.125457L22.0155 10.6012C22.266 10.7893 22.6105 10.7893 22.8297 10.6012L36.2645 0.156822C36.2645 0.156822 36.5464 0 36.6716 0H43.8431C44.2189 0 44.5321 0.313644 44.5321 0.690016H44.5008Z" fill="#680AFF"/>
          <path d="M44.5008 43.5191C44.5008 51.6425 38.2688 56.6921 30.0325 56.6921H0.688963C0.313165 56.6921 0 56.3785 0 56.0021V31.0361C0 30.6597 0.313165 30.3461 0.688963 30.3461H30.0639C38.3001 30.3461 44.5321 35.3644 44.5321 43.5191H44.5008ZM36.1079 43.5191C36.1079 40.1317 33.54 37.5599 30.0639 37.5599H8.89389C8.51809 37.5599 8.20493 37.8735 8.20493 38.2499V48.7883C8.20493 49.1647 8.51809 49.4783 8.89389 49.4783H30.0325C33.54 49.4156 36.0766 46.8751 36.0766 43.5191H36.1079Z" fill="#680AFF"/>
        </g>
      </g>
      
      <!-- Title -->
      <text x="600" y="350" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#680AFF" text-anchor="middle">Movie Drafter</text>
      
      <!-- Subtitle -->
      <text x="600" y="420" font-family="Arial, sans-serif" font-size="36" fill="#D3CFFF" text-anchor="middle">Draft your favorite movies and compete with friends</text>
      
      <!-- Tagline -->
      <text x="600" y="480" font-family="Arial, sans-serif" font-size="24" fill="#907AFF" text-anchor="middle">Create fantasy movie drafts • Pick your favorites • See who wins</text>
    </svg>`;
    
    await sharp(Buffer.from(ogSvg))
      .jpeg({ quality: 90 })
      .toFile(path.join(publicDir, 'og-image.jpg'));
    
    console.log('✓ Generated og-image.jpg');
    
    console.log('\n✅ All favicon and OG image files generated successfully!');
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message.includes('sharp')) {
      console.error('\n❌ Error: sharp is not installed.');
      console.log('\nPlease install sharp first:');
      console.log('  npm install sharp --save-dev');
      console.log('\nThen run this script again:');
      console.log('  node generate-favicons.js');
      process.exit(1);
    } else {
      console.error('Error generating favicons:', error);
      process.exit(1);
    }
  }
}

generateFavicons();
