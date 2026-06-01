/**
 * Shared CSS for resume preview (injected in ResumePreview) and PDF export iframe.
 */

/** Pasted rich HTML: normalize inner nodes to the parent `.resume-text` size (Tailwind `text-[Npx]`). */
export const RESUME_RICH_TEXT_CSS = `
  .a4-page .resume-text * {
    font-size: 1em !important;
  }
`;

/** Screen + print: page geometry, rich text, multi-page PDF breaks */
export const RESUME_EXPORT_CSS = `
  ${RESUME_RICH_TEXT_CSS}

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
  }
  body {
    display: block;
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
`;
