/**
 * Shared CSS for resume preview (injected in ResumePreview) and PDF export iframe.
 */

/** Pasted rich HTML: normalize inner nodes to the parent `.resume-text` size (Tailwind `text-[Npx]`). */
export const RESUME_RICH_TEXT_CSS = `
  .a4-page .resume-text * {
    font-size: 1em !important;
  }
`;

export const RESUME_SECTION_HEADER_CSS = `
  .resume-section-header {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
  }
`;

/** Screen + print: page geometry, rich text, multi-page PDF breaks */
export const RESUME_EXPORT_CSS = `
  ${RESUME_RICH_TEXT_CSS}
  ${RESUME_SECTION_HEADER_CSS}

  .a4-page {
    box-sizing: border-box;
  }

  @media print {
    .a4-page {
      page-break-after: always;
      break-after: page;
    }
    .a4-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  }
`;

export const RESUME_PDF_EXPORT_CSS = `
  @page {
    size: A4;
    margin: 0;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: white;
    width: 210mm;
    overflow: visible;
    color-scheme: light;
  }
  body {
    display: block;
    font-kerning: normal;
    font-variant-ligatures: common-ligatures contextual;
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  img, svg {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  img {
    image-rendering: auto;
  }
  p, li {
    orphans: 2;
    widows: 2;
  }
  [data-resume-export-target],
  .resume-paged-view {
    display: block !important;
    width: 210mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
  }
  .a4-page {
    box-shadow: none !important;
    width: 210mm !important;
    height: 297mm !important;
    max-height: 297mm !important;
    margin: 0 auto !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    page-break-after: always;
    break-after: page;
  }
  .a4-page:last-child {
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  ${RESUME_RICH_TEXT_CSS}
  ${RESUME_SECTION_HEADER_CSS}
`;

/**
 * Continuous single-flow export (see `flattenPaginatedPreviewForPrint`).
 *
 * The on-screen preview paginates by slicing one tall layout into fixed A4 windows
 * using offsets the USER's browser measured. When the exporting browser is not the
 * same engine as the server's Chromium (every iOS browser is WebKit, plus desktop
 * Safari/Firefox), those offsets don't match the server's layout and content gets
 * clipped by each window's `overflow:hidden`. For those clients we collapse the
 * windows into one flow and let the server's Chromium repaginate natively — this is
 * device-independent, so it can never truncate.
 */
export const RESUME_PDF_CONTINUOUS_CSS = `
  .resume-print-canvas {
    display: block !important;
    width: 210mm !important;
    min-height: 0 !important;
    height: auto !important;
    max-height: none !important;
    margin: 0 auto !important;
    overflow: visible !important;
    box-shadow: none !important;
  }
  /* Let the print engine break between blocks, never through them. */
  .resume-print-canvas .resume-export-block,
  .resume-print-canvas .resume-export-grid > div,
  .resume-print-canvas .grid > div {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .resume-print-canvas .resume-section-header {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
  }
  /* Two-column templates: don't force a page-tall column, which fights fragmentation. */
  .resume-print-canvas [data-resume-two-col-root],
  .resume-print-canvas [data-resume-sidebar] {
    min-height: 0 !important;
  }
  /* Free-plan footer: position:fixed repeats it once per printed page in Chromium. */
  .resume-print-watermark {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    top: auto !important;
    z-index: 2147483000 !important;
    display: flex !important;
    justify-content: center !important;
  }
`;
