import { PDFParse } from "pdf-parse";
import fs from "fs";

async function run() {
  try {
    const parser = new PDFParse({ data: fs.readFileSync("test.pdf") });
    const pdfData = await parser.getText();
    console.log("Success, length:", pdfData.text.length);
  } catch(e) {
    console.error(e);
  }
}

run();
