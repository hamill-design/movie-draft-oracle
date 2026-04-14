/**
 * Vercel Edge: dynamic 1200×630 PNG for Open Graph / Discord / Twitter previews.
 * Example: /api/og?title=My%20Draft&subtitle=Join%20on%20Movie%20Drafter
 */
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = (searchParams.get('title') || 'Movie Drafter').trim() || 'Movie Drafter';
    const subtitle =
      (searchParams.get('subtitle') || 'Movie drafting game with friends').trim() ||
      'Movie drafting game with friends';

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(140deg, #100029 16%, #680AFF 45%, #160038 83%)',
            color: '#FCFFFF',
            padding: 56,
            justifyContent: 'center',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              fontSize: title.length > 48 ? 48 : 56,
              fontWeight: 800,
              lineHeight: 1.12,
              marginBottom: 20,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 30, opacity: 0.92, lineHeight: 1.35, maxWidth: 1000 }}>{subtitle}</div>
          <div
            style={{
              position: 'absolute',
              bottom: 44,
              left: 56,
              fontSize: 22,
              fontWeight: 600,
              opacity: 0.75,
              letterSpacing: '0.04em',
            }}
          >
            MOVIEDRAFTER.COM
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch {
    return new Response('Failed to render OG image', { status: 500 });
  }
}
