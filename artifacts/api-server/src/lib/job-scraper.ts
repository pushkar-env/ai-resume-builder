import puppeteer from "puppeteer";
import { completeResumeAiJson } from "./resume-ai-chat";
import { logger } from "./logger";

export async function scrapeJobUrl(url: string) {
  logger.info({ url }, "Scraping job URL");

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate with timeout
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });

    // Wait a short bit for any client-side renders
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Extract body innerText
    const pageText = await page.evaluate(() => {
      const doc = (globalThis as any).document;
      const bodyClone = doc.body.cloneNode(true) as any;
      const selectorsToRemove = [
        "script",
        "style",
        "noscript",
        "header",
        "footer",
        "nav",
        "iframe",
        "link",
        ".cookie-banner",
        "#cookie-banner",
      ];
      selectorsToRemove.forEach((sel) => {
        bodyClone.querySelectorAll(sel).forEach((el: any) => el.remove());
      });
      return bodyClone.innerText;
    });

    await browser.close();
    browser = null;

    if (!pageText || pageText.trim().length === 0) {
      throw new Error(
        "Could not extract text content from the job URL. The website might be blocking scrapers.",
      );
    }

    // Call OpenAI to structure this text
    const prompt = `
You are a job description scraper assistant. Below is the raw text content extracted from a job posting web page.
Please analyze the text and extract the following details as a JSON object:
- jobTitle: The exact title of the job role as it appears on the web page. Do NOT generalize, simplify, or rephrase the title (e.g., if the web page lists the title as "Software Development Engineer - Amazon Photos" or "Engineering Division - , AI Research - Vice President", extract that full string exactly; do not shorten it or change it in any way).
- companyName: The name of the company hiring.
- location: The location of the job (e.g. "San Francisco, CA" or "Remote").
- description: The core job description/requirements, cleaned up (no side bar navigation links, no cookie policies, no advertisement text, just the actual job description text).

Raw Web Page Text:
"""
${pageText.slice(0, 15000)}
"""

Provide the output strictly in the following JSON format:
{
  "jobTitle": string or null,
  "companyName": string or null,
  "location": string or null,
  "description": string
}
`;

    const result = await completeResumeAiJson<{
      jobTitle: string | null;
      companyName: string | null;
      location: string | null;
      description: string;
    }>(prompt, "Extract job details from URL", "standard");

    return result;
  } catch (error: any) {
    logger.error({ error: error.message, url }, "Failed to scrape job URL");
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    throw new Error(error.message || "Failed to scrape job page");
  }
}
