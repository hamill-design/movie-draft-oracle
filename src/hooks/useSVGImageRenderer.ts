import { useCallback } from 'react';
import {
  generateShareImageSVG,
  FORMAT_DIMS,
  type ShareImageData,
  type GenerateOptions,
  type ShareFormat,
} from '@/utils/svgImageTemplate';

const svgToCanvas = async (
  svgString: string,
  width: number,
  height: number
): Promise<HTMLCanvasElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        canvas.width = img.width || width;
        canvas.height = img.height || height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      } catch (error) {
        reject(new Error(`Failed to draw image to canvas: ${error}`));
      }
    };
    img.onerror = (error) => reject(new Error(`Failed to load SVG image: ${error}`));

    try {
      // Encode as a data URL (avoids blob-URL CORS tainting).
      const encodedSvg = btoa(unescape(encodeURIComponent(svgString)));
      img.src = `data:image/svg+xml;base64,${encodedSvg}`;
    } catch (error) {
      reject(new Error(`Failed to create SVG data URL: ${error}`));
    }
  });
};

export const useSVGImageRenderer = () => {
  const renderToCanvas = useCallback(
    async (data: ShareImageData, options: GenerateOptions = {}): Promise<string> => {
      const format: ShareFormat = options.format ?? 'story';
      const { width, height } = FORMAT_DIMS[format];

      const svgString = await generateShareImageSVG(data, options);
      const canvas = await svgToCanvas(svgString, width, height);
      return canvas.toDataURL('image/png', 1.0);
    },
    []
  );

  return { renderToCanvas };
};
