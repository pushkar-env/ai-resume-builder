import { Helmet } from "react-helmet-async";

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

export function SEO({
  title,
  description,
  canonicalUrl,
  ogImage,
  keywords,
  robots = "index, follow",
  jsonLd,
}: SEOProps) {
  const siteName = "ResumeSensei";
  const defaultOgImage = "https://resumesensei.com/bluemascot.svg";

  const graph =
    jsonLd == null
      ? null
      : Array.isArray(jsonLd)
        ? jsonLd
        : [jsonLd];

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
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_US" />
      {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
      <meta property="og:image" content={ogImage || defaultOgImage} />
      <meta property="og:image:alt" content={`${siteName} — ${title}`} />

      <meta name="twitter:site" content="@ResumeSensei" />
      <meta name="twitter:creator" content="@ResumeSensei" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage || defaultOgImage} />

      {jsonLdString ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString }}
        />
      ) : null}
    </Helmet>
  );
}
