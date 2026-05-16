import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  buildExportHtml,
  getExportPageElement,
  mountExportIframe,
} from "@/lib/export-resume-html";

/** 2× raster for sharp text when embedded in PDF. */
const CANVAS_SCALE = 2;
const JPEG_QUALITY = 0.92;

async function capturePageCanvas(pageEl: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(pageEl, {
    scale: CANVAS_SCALE,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
    width: A4_WIDTH_PX,
    windowWidth: A4_WIDTH_PX,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDoc) => {
      const clonedPage = clonedDoc.querySelector<HTMLElement>(".a4-page");
      if (clonedPage) {
        clonedPage.style.boxShadow = "none";
        clonedPage.style.transform = "none";
      }
    },
  });
}

function canvasToPdfBlob(canvas: HTMLCanvasElement): Blob {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [A4_WIDTH_PX, A4_HEIGHT_PX],
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage([A4_WIDTH_PX, A4_HEIGHT_PX]);
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;
  }

  return pdf.output("blob");
}

/**
 * Builds a PDF blob from the live builder preview (WYSIWYG).
 * Does not use the browser print dialog — works when printing is blocked.
 */
export async function buildResumePdfBlob(resumeTitle: string): Promise<Blob> {
  const html = buildExportHtml(resumeTitle);
  if (!html) {
    throw new Error("Could not capture resume preview");
  }

  const iframe = await mountExportIframe(html);
  try {
    const pageEl = getExportPageElement(iframe);
    const canvas = await capturePageCanvas(pageEl);
    return canvasToPdfBlob(canvas);
  } finally {
    iframe.remove();
  }
}
