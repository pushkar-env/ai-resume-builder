import puppeteer, { type Browser, type Page } from "puppeteer";
import { logger } from "./logger";

const PDF_RENDER_TIMEOUT_MS =
  Number(process.env.PDF_RENDER_TIMEOUT_MS) || 45_000;
const PDF_SET_CONTENT_TIMEOUT_MS =
  Number(process.env.PDF_SET_CONTENT_TIMEOUT_MS) || 20_000;
const PDF_FONT_WAIT_MS = Number(process.env.PDF_FONT_WAIT_MS) || 3_000;
const MAX_CONCURRENT_PDF_JOBS =
  Number(process.env.PDF_MAX_CONCURRENT_JOBS) || 2;

const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-translate",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-first-run",
  "--safebrowsing-disable-auto-update",
];

let browserPromise: Promise<Browser> | null = null;
let activePdfJobs = 0;
const pdfJobWaiters: Array<() => void> = [];

function acquirePdfSlot(): Promise<void> {
  if (activePdfJobs < MAX_CONCURRENT_PDF_JOBS) {
    activePdfJobs += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    pdfJobWaiters.push(() => {
      activePdfJobs += 1;
      resolve();
    });
  });
}

function releasePdfSlot(): void {
  activePdfJobs = Math.max(0, activePdfJobs - 1);
  const next = pdfJobWaiters.shift();
  if (next) next();
}

async function launchBrowser(): Promise<Browser> {
  logger.info("Launching headless Chrome for PDF export");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: PUPPETEER_ARGS,
  });

  browser.on("disconnected", () => {
    logger.warn("PDF browser disconnected; will relaunch on next export");
    browserPromise = null;
  });

  return browser;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }
  return browserPromise;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function configurePage(page: Page): Promise<void> {
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
  await page.emulateMediaType("print");

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const type = request.resourceType();
    if (type === "document" || type === "stylesheet" || type === "font") {
      request.continue();
      return;
    }
    if (type === "image" || type === "media" || type === "websocket") {
      request.abort();
      return;
    }
    request.continue();
  });
}

async function waitForFonts(page: Page): Promise<void> {
  await withTimeout(
    page.evaluate(async () => {
      const doc = (
        globalThis as unknown as {
          document?: { fonts?: { ready: Promise<void> } };
        }
      ).document;
      if (!doc?.fonts?.ready) return;
      await doc.fonts.ready;
    }),
    PDF_FONT_WAIT_MS,
    "Font loading",
  ).catch(() => undefined);
}

async function renderPdfOnPage(page: Page, html: string): Promise<Buffer> {
  await configurePage(page);

  await withTimeout(
    page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: PDF_SET_CONTENT_TIMEOUT_MS,
    }),
    PDF_SET_CONTENT_TIMEOUT_MS + 1_000,
    "PDF HTML render",
  );

  await waitForFonts(page);

  const pdfBuffer = await withTimeout(
    page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    }),
    PDF_RENDER_TIMEOUT_MS,
    "PDF generation",
  );

  return Buffer.from(pdfBuffer);
}

export async function renderResumePdf(html: string): Promise<Buffer> {
  await acquirePdfSlot();

  let page: Page | null = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    try {
      return await renderPdfOnPage(page, html);
    } catch (firstError) {
      logger.warn(
        { error: String(firstError) },
        "PDF render failed; retrying with a fresh browser",
      );
      browserPromise = null;
      try {
        await browser.close();
      } catch {
        /* ignore */
      }

      const retryBrowser = await getBrowser();
      if (page) {
        try {
          await page.close();
        } catch {
          /* ignore */
        }
      }
      page = await retryBrowser.newPage();
      return await renderPdfOnPage(page, html);
    }
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        /* ignore */
      }
    }
    releasePdfSlot();
  }
}

export async function closePdfBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  try {
    await browser.close();
  } catch {
    /* ignore */
  }
}

process.on("SIGTERM", () => {
  void closePdfBrowser();
});
process.on("SIGINT", () => {
  void closePdfBrowser();
});
