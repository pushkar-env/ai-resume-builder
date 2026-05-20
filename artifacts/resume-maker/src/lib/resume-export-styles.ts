/**
 * Shared CSS for resume preview, PDF (print), and export iframe.
 * Keeps screen preview faithful while normalizing print/pagination behavior.
 */
export const RESUME_EXPORT_CSS = `
  /* Rich text: pasted Word/Docs often set oversized inline font-size */
  .a4-page .resume-text,
  .a4-page .resume-text * {
    font-size: inherit !important;
    line-height: inherit !important;
  }

  /* Allow content to grow beyond one A4 page (preview + print) */
  .a4-page {
    overflow: visible;
    height: auto;
    max-height: none;
    min-height: 1123px;
    box-sizing: border-box;
  }

  .a4-page .resume-preview-root,
  .a4-page .resume-preview-watermark-shell,
  .a4-page .resume-preview-zoom-region {
    overflow: visible;
    max-height: none;
    min-height: 0;
  }

  .a4-page[data-watermarked] {
    height: auto;
    max-height: none;
  }

  .a4-page[data-watermarked] .resume-preview-zoom-region {
    overflow: visible;
    flex: none;
  }

  /* Avoid clipping in two-column templates */
  .a4-page .resume-template-columns-main {
    overflow: visible;
  }

  /* Prefer keeping logical blocks together when paginating */
  .resume-export-block {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .resume-export-grid {
    break-inside: auto;
    page-break-inside: auto;
  }

  .resume-export-grid > div {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  @media print {
    html, body {
      margin: 0;
      padding: 0;
      background: white;
    }

    .a4-page {
      width: 794px !important;
      min-height: 1123px !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      box-shadow: none !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
    }

    .a4-page[data-watermarked] {
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
    }

    /* CSS zoom is unreliable in print and can yield blank pages */
    .resume-preview-zoom-region,
    .resume-preview-zoom-region * {
      zoom: 1 !important;
    }

    .a4-page .resume-preview-root,
    .a4-page .resume-preview-watermark-shell,
    .a4-page .resume-preview-zoom-region,
    .a4-page .resume-preview-zoom-region > div {
      overflow: visible !important;
      max-height: none !important;
      flex: none !important;
    }

    .a4-page[data-watermarked] .resume-preview-zoom-region {
      padding-bottom: 28px;
    }

    [data-resume-watermark] {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 794px;
      z-index: 9999;
      background: transparent;
    }
  }
`;

/** Print-specific overrides injected into the PDF export iframe */
export const RESUME_PDF_EXPORT_CSS = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: white; }
  body { display: block; }
  .a4-page {
    box-shadow: none !important;
    width: 794px !important;
    margin: 0 auto !important;
  }
  ${RESUME_EXPORT_CSS}
`;
