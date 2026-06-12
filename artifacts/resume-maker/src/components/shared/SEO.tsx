import { Helmet } from "react-helmet-async";
import {
  BRAND_LOGO_PNG,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/brand";

export interface SEOProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
  /** Comma-separated keywords for discoverability (use sparingly; primary SEO is title + description). */
  keywords?: string;
  /** e.g. "index, follow" or "noindex, nofollow" for staging */
  robots?: string;
  /** JSON-LD objects; rendered as one script with @graph when multiple. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const FAVICON_LINKS = [
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
  {
    rel: "icon",
    type: "image/png",
    href: "/favicon-32x32.png",
    sizes: "32x32",
  },
  {
    rel: "icon",
    type: "image/png",
    href: "/favicon-16x16.png",
    sizes: "16x16",
  },
  {
    rel: "icon",
    type: "image/png",
    href: "/android-chrome-192x192.png",
    sizes: "192x192",
  },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
] as const;

export function SEO({
  title,
  description,
  canonicalUrl,
  ogImage,
  keywords,
  robots = "index, follow",
  jsonLd,
}: SEOProps) {
  const resolvedOgImage = ogImage || DEFAULT_OG_IMAGE;

  const graph =
    jsonLd == null ? null : Array.isArray(jsonLd) ? jsonLd : [jsonLd];

  const jsonLdString =
    graph && graph.length > 0
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        })
      : null;

  return (
    <Helmet htmlAttributes={{ lang: "en" }}>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="application-name" content={SITE_NAME} />
      <meta name="author" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}

      {FAVICON_LINKS.map((link) => (
        <link key={`${link.rel}-${link.href}`} {...link} />
      ))}
      <link rel="manifest" href="/site.webmanifest" />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
      <meta property="og:image" content={resolvedOgImage} />
      <meta property="og:image:alt" content={`${SITE_NAME} — ${title}`} />

      <meta name="twitter:site" content="@ResumeSensei" />
      <meta name="twitter:creator" content="@ResumeSensei" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={resolvedOgImage} />

      {jsonLdString ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString }}
        />
      ) : null}
    </Helmet>
  );
}

/** Shared Organization + WebSite nodes for JSON-LD @graph on marketing pages. */
export function brandJsonLdCore(): Record<string, unknown>[] {
  return [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: BRAND_LOGO_PNG,
        width: 192,
        height: 192,
      },
      description:
        "Resumesensei is an online resume builder with AI-assisted writing, ATS score insights, and exports that match the live preview.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description:
        "Build an ATS-friendly resume with AI guidance, 12 templates, live A4 preview, and PDF, DOCX, and JSON export.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
      alternateName: ["Resume Sensei", "ResumeSensei"],
    },
  ];
}
