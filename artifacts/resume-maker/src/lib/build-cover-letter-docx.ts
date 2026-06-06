import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from "docx";
import { parseCoverLetterContent } from "../components/resume/CoverLetterPreview";

const XML_TEXT_CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
const MAX_RUN_CHARS = 32_000;

function sanitizeWordText(input: string): string {
  let s = input.replace(XML_TEXT_CONTROL, "").replace(/\u00ad/g, "");
  if (s.length > MAX_RUN_CHARS) s = `${s.slice(0, MAX_RUN_CHARS)}…`;
  return s;
}

function hexToWordColor(hex: string): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length === 6) return h.toUpperCase();
  if (h.length === 3)
    return [...h]
      .map((c) => c + c)
      .join("")
      .toUpperCase();
  return "1A1A1A";
}

interface DocxCoverLetterData {
  title: string;
  sender: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
  };
  recipient: {
    hiringManagerName?: string | null;
    companyName?: string | null;
    companyLocation?: string | null;
  };
  jobTitle?: string | null;
  generatedContent: string;
  fontFamily?: string;
  accentColor?: string;
}

export async function buildCoverLetterDocx(data: DocxCoverLetterData): Promise<Blob> {
  const font = data.fontFamily === "serif" ? "Georgia" : data.fontFamily === "mono" ? "Courier New" : "Calibri";
  const accentColor = hexToWordColor(data.accentColor || "#1A1A1A");

  const runSize = 22; // 11pt
  const body: Paragraph[] = [];

  // 1. Sender Info (Header)
  if (data.sender.name) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: sanitizeWordText(data.sender.name),
            bold: true,
            size: 28, // 14pt
            font,
            color: accentColor,
          }),
        ],
      }),
    );
  }

  const contactParts: string[] = [];
  if (data.sender.email) contactParts.push(data.sender.email);
  if (data.sender.phone) contactParts.push(data.sender.phone);
  if (data.sender.location) contactParts.push(data.sender.location);

  if (contactParts.length > 0) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: sanitizeWordText(contactParts.join("  |  ")),
            size: 18, // 9pt
            font,
            color: "666666",
          }),
        ],
      }),
    );
  }

  // 2. Date
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  body.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: dateStr,
          size: runSize,
          font,
        }),
      ],
    }),
  );

  // 3. Recipient Info
  const recipientName = data.recipient.hiringManagerName || "Hiring Manager";
  body.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: sanitizeWordText(recipientName),
          bold: true,
          size: runSize,
          font,
        }),
      ],
    }),
  );

  if (data.recipient.companyName) {
    body.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: sanitizeWordText(data.recipient.companyName),
            size: runSize,
            font,
          }),
        ],
      }),
    );
  }

  if (data.recipient.companyLocation) {
    body.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: sanitizeWordText(data.recipient.companyLocation),
            size: runSize,
            font,
          }),
        ],
      }),
    );
  }

  // 4. Subject Line
  if (data.jobTitle) {
    body.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: `Subject: Application for ${data.jobTitle}${data.recipient.companyName ? ` at ${data.recipient.companyName}` : ""}`,
            bold: true,
            size: runSize,
            font,
          }),
        ],
      }),
    );
  }

  // 5. Parse Content
  const parsed = parseCoverLetterContent(
    data.generatedContent,
    data.recipient.hiringManagerName || "Hiring Manager",
    data.sender.name || "Your Name",
    data.sender.email,
    data.sender.phone,
    data.sender.location
  );

  // 6. Salutation
  body.push(
    new Paragraph({
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: sanitizeWordText(parsed.salutation),
          size: runSize,
          font,
        }),
      ],
    }),
  );

  // 7. Body Paragraphs (Clean, contact info and salutations stripped)
  for (const paragraphText of parsed.paragraphs) {
    body.push(
      new Paragraph({
        spacing: { after: 180, line: 360 }, // 1.5 line spacing
        children: [
          new TextRun({
            text: sanitizeWordText(paragraphText),
            size: runSize,
            font,
          }),
        ],
      }),
    );
  }

  // 8. Sign-off
  body.push(
    new Paragraph({
      spacing: { before: 180, after: 360 },
      children: [
        new TextRun({
          text: sanitizeWordText(parsed.signOff),
          size: runSize,
          font,
        }),
      ],
    }),
  );

  // 9. Sender Name
  body.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: sanitizeWordText(parsed.senderName),
          bold: true,
          size: runSize,
          font,
        }),
      ],
    }),
  );

  const doc = new Document({
    creator: "ResumeSensei",
    title: sanitizeWordText(data.title || "Cover Letter").slice(0, 255),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: body,
      },
    ],
  });

  return Packer.toBlob(doc);
}
