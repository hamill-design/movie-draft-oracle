import { DEFAULT_OG_IMAGE_URL, SITE_ORIGIN } from '@/config/socialShareMeta';
import { posterUrl, type PublicSpecDraftSummary } from '@/services/publicSpecDrafts';

/** Stable @id targets for cross-referencing from page-level JSON-LD */
export const siteOrganizationId = `${SITE_ORIGIN}/#organization`;
export const siteWebSiteId = `${SITE_ORIGIN}/#website`;
export const siteWebAppId = `${SITE_ORIGIN}/#webapp`;

const DEFAULT_APP_DESCRIPTION =
  'The movie drafting game for friends: fantasy movie drafts and a cinema drafting tool to pick films, compete, and see who knows movies best.';

/**
 * Sitewide graph (Organization + WebSite + WebApplication) for `index.html`.
 * Page routes can reference `siteOrganizationId` / `siteWebSiteId` via `isPartOf` / `publisher`.
 * Keep `index.html`’s embedded JSON-LD in sync with this function (same `@graph` when it changes).
 */
export function siteWideJsonLdGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': siteOrganizationId,
        name: 'Movie Drafter',
        url: SITE_ORIGIN,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_ORIGIN}/apple-touch-icon.png`,
        },
        sameAs: ['https://www.instagram.com/moviedrafter/'],
      },
      {
        '@type': 'WebSite',
        '@id': siteWebSiteId,
        name: 'Movie Drafter',
        url: SITE_ORIGIN,
        publisher: { '@id': siteOrganizationId },
      },
      {
        '@type': 'WebApplication',
        '@id': siteWebAppId,
        name: 'Movie Drafter',
        url: SITE_ORIGIN,
        description: DEFAULT_APP_DESCRIPTION,
        applicationCategory: 'Game',
        applicationSubCategory: 'Movie drafting game',
        operatingSystem: 'Web Browser',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        publisher: { '@id': siteOrganizationId },
      },
    ],
  };
}

function absolutePath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_ORIGIN}${p}`;
}

type WebPageKind = 'WebPage' | 'AboutPage' | 'ContactPage';

export function webPageNode(opts: {
  path: string;
  name: string;
  description: string;
  type?: WebPageKind;
}) {
  const pageUrl = absolutePath(opts.path);
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': `${pageUrl}#webpage`,
    name: opts.name,
    description: opts.description,
    url: pageUrl,
    isPartOf: { '@id': siteWebSiteId },
    publisher: { '@id': siteOrganizationId },
  };
}

/** BreadcrumbList node for use inside `@graph` (no top-level @context). */
export function breadcrumbListNode(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absolutePath(item.path),
    })),
  };
}

export function graphJsonLd(...nodes: Record<string, unknown>[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}

/** Theme hub: list of special-draft index cards linking to each theme URL */
export function themeHubItemListNode(drafts: PublicSpecDraftSummary[], pageDescription: string) {
  return {
    '@type': 'ItemList',
    name: 'Special drafts & eligible film lists',
    description: pageDescription,
    numberOfItems: drafts.length,
    itemListElement: drafts.map((d, i) => {
      const url = absolutePath(`/special-draft/${d.slug}`);
      const imageUrl = posterUrl(d.photo_url);
      return {
        '@type': 'ListItem',
        position: i + 1,
        url,
        item: {
          '@type': 'WebPage',
          name: d.name,
          description: d.description?.trim() || undefined,
          url,
          ...(imageUrl
            ? { image: { '@type': 'ImageObject', url: imageUrl } }
            : {}),
        },
      };
    }),
  };
}

export function articleNode(opts: {
  path: string;
  headline: string;
  description: string;
  idSuffix?: string;
}) {
  const pageUrl = absolutePath(opts.path);
  const id = `${pageUrl}${opts.idSuffix ?? '#article'}`;
  return {
    '@type': 'Article',
    '@id': id,
    headline: opts.headline,
    description: opts.description,
    url: pageUrl,
    image: DEFAULT_OG_IMAGE_URL,
    author: { '@id': siteOrganizationId },
    publisher: {
      '@id': siteOrganizationId,
    },
    mainEntityOfPage: pageUrl,
  };
}
