/**
 * Vercel Node runtime: dynamic 1200×630 PNG for a draft's Final Scores link preview.
 * Params-driven (no DB call) so it stays fast and simple.
 * Example: /api/og-scores?title=Final%20scores%3A%20The%20Tom%20Hanks%20Draft&subtitle=See%20who%20won
 */
import { ImageResponse } from '@vercel/og';
import { createElement } from 'react';

/** Node runtime: Edge bundling for Vite `/api` does not support `@vercel/og`. */
export const config = { runtime: 'nodejs' };

export default function handler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = (searchParams.get('title') || 'Final Scores').trim().slice(0, 90) || 'Final Scores';
    const subtitle =
      (searchParams.get('subtitle') || 'See who won on Movie Drafter').trim().slice(0, 120) ||
      'See who won on Movie Drafter';

    return new ImageResponse(
      createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(140deg, #100029 16%, #680AFF 45%, #160038 83%)',
            color: '#FCFFFF',
            padding: 64,
            justifyContent: 'center',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
        },
        // Eyebrow
        createElement(
          'div',
          {
            style: {
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '0.18em',
              opacity: 0.85,
              marginBottom: 18,
            },
          },
          'FINAL SCORES'
        ),
        // Title
        createElement(
          'div',
          {
            style: {
              fontSize: title.length > 48 ? 56 : 68,
              fontWeight: 800,
              lineHeight: 1.08,
              marginBottom: 20,
              letterSpacing: '-0.02em',
            },
          },
          title
        ),
        // Subtitle
        createElement(
          'div',
          { style: { fontSize: 30, opacity: 0.92, lineHeight: 1.35, maxWidth: 1000 } },
          subtitle
        ),
        // Footer brand
        createElement(
          'div',
          {
            style: {
              position: 'absolute',
              bottom: 48,
              left: 64,
              fontSize: 22,
              fontWeight: 600,
              opacity: 0.75,
              letterSpacing: '0.04em',
            },
          },
          'MOVIEDRAFTER.COM'
        )
      ),
      { width: 1200, height: 630 }
    );
  } catch {
    return new Response('Failed to render OG image', { status: 500 });
  }
}
