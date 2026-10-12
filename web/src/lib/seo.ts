import type { Metadata } from 'next';
import type { PublicSeo } from './publicApi';

// Turns what `api` resolved for a page (SEO-01) into the tags a search engine or a link
// preview reads: title, description, canonical link, Open Graph and Twitter card, and
// robots when the page is hidden from search. The page's own address is the canonical one
// unless staff gave another; only `web` knows its own origin (D-030).

/**
 * `https://corrick.example.com`, from PUBLIC_SITE_URL_TEMPLATE with `{subdomain}` replaced. When
 * it isn't set: in production, https on PUBLIC_ROOT_DOMAIN (which tenant resolution already
 * needs), so a forgotten variable never points every canonical link at a development address;
 * in development, the local address.
 */
export function siteOrigin(subdomain: string): string {
  const fallback =
    process.env.NODE_ENV === 'production'
      ? `https://{subdomain}.${process.env.PUBLIC_ROOT_DOMAIN ?? 'lvh.me'}`
      : 'http://{subdomain}.lvh.me:3000';
  const template = process.env.PUBLIC_SITE_URL_TEMPLATE || fallback;
  return template.replace('{subdomain}', subdomain).replace(/\/+$/, '');
}

export function pageMetadata(input: { seo: PublicSeo; origin: string; path: string; siteName: string; article: boolean }): Metadata {
  const { seo, origin, path, siteName, article } = input;
  const url = `${origin}${path}`;
  const image = seo.social.image;
  return {
    title: seo.title,
    ...(seo.description && { description: seo.description }),
    alternates: { canonical: seo.canonicalUrl ?? url },
    ...(seo.noindex && { robots: { index: false, follow: false } }),
    openGraph: {
      type: article ? 'article' : 'website',
      siteName,
      url: seo.canonicalUrl ?? url,
      title: seo.social.title,
      ...(seo.social.description && { description: seo.social.description }),
      ...(image && { images: [{ url: image.url, alt: image.alt }] }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: seo.social.title,
      ...(seo.social.description && { description: seo.social.description }),
      ...(image && { images: [image.url] }),
    },
  };
}

/** A type's listing (`/events`): a plain title, its own address, and a card with no picture. */
export function listingMetadata(input: { origin: string; path: string; typeName: string; siteName: string }): Metadata {
  const title = `${input.typeName} · ${input.siteName}`;
  const url = `${input.origin}${input.path}`;
  return {
    title,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: input.siteName, url, title },
    twitter: { card: 'summary', title },
  };
}

/** The address nobody has: a tab title that says so, on the site's own name (B-15). */
export function notFoundMetadata(siteName: string): Metadata {
  return { title: `Page not found · ${siteName}` };
}
