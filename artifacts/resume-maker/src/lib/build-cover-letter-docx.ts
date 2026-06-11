import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
  convertMillimetersToTwip,
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

export async function buildCoverLetterDocx(
  data: DocxCoverLetterData,
  options?: { includeWatermark?: boolean },
): Promise<Blob> {
  const font = data.fontFamily === "serif" ? "Georgia" : data.fontFamily === "mono" ? "Courier New" : "Calibri";
  const accentColor = hexToWordColor(data.accentColor || "#1A1A1A");

  const runSize = 22; // 11pt
  const body: Paragraph[] = [];

  // 1. Parse Content
  const parsed = parseCoverLetterContent(
    data.generatedContent,
    data.recipient.hiringManagerName || "Hiring Manager",
    data.sender.name || "Your Name",
    data.sender.email,
    data.sender.phone,
    data.sender.location,
    data.recipient.companyName,
    data.recipient.companyLocation,
    data.jobTitle
  );

  // 2. Sender Info (Header)
  if (parsed.senderName) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: sanitizeWordText(parsed.senderName),
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
  if (parsed.senderEmail) contactParts.push(parsed.senderEmail);
  if (parsed.senderPhone) contactParts.push(parsed.senderPhone);
  if (parsed.senderLocation) contactParts.push(parsed.senderLocation);

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

  // 3. Date
  if (parsed.date) {
    body.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: sanitizeWordText(parsed.date),
            size: runSize,
            font,
          }),
        ],
      }),
    );
  }

  // 4. Recipient Info
  if (parsed.recipientName) {
    body.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: sanitizeWordText(parsed.recipientName),
            bold: true,
            size: runSize,
            font,
          }),
        ],
      }),
    );
  }

  if (parsed.companyName) {
    body.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: sanitizeWordText(parsed.companyName),
            size: runSize,
            font,
          }),
        ],
      }),
    );
  }

  if (parsed.companyLocation) {
    body.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: sanitizeWordText(parsed.companyLocation),
            size: runSize,
            font,
          }),
        ],
      }),
    );
  }

  // 5. Subject Line
  if (parsed.subject) {
    body.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: `Subject: ${sanitizeWordText(parsed.subject)}`,
            bold: true,
            size: runSize,
            font,
          }),
        ],
      }),
    );
  }

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

  if (options?.includeWatermark) {
    const site = "https://resumesensei.com/";
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 80 },
        children: [
          new TextRun({ text: "Created at ", size: 16, color: "94A3B8", font }),
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: "resumesensei.com",
                style: "Hyperlink",
                size: 16,
                font,
              }),
            ],
            link: site,
          }),
        ],
      }),
    );
  }

  const doc = new Document({
    creator: "ResumeSensei",
    title: sanitizeWordText(data.title || "Cover Letter").slice(0, 255),
    subject: "Professional cover letter",
    description: "Professional cover letter created with ResumeSensei",
    keywords: "cover letter, job application, professional correspondence",
    styles: {
      default: {
        document: {
          run: { font, size: runSize },
          paragraph: {
            spacing: { line: 276 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
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
