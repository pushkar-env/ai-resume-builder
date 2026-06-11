import type React from "react";
import { useMemo } from "react";
import { ResumeWatermark } from "./ResumeWatermark";

interface CoverLetterPreviewProps {
  content: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  senderLocation: string;
  recipientName: string;
  companyName: string;
  companyLocation: string;
  jobTitle: string;
  templateId: string;
  accentColor?: string;
  fontFamily?: string;
  zoom?: number;
  showWatermark?: boolean;
  showSignatureDesign?: boolean;
  fontSize?: number;
}

export interface ParsedCoverLetter {
  salutation: string;
  paragraphs: string[];
  signOff: string;
  senderName: string;
}

export const isContactLine = (
  line: string,
  email?: string | null,
  phone?: string | null,
  location?: string | null
): boolean => {
  const clean = line.trim().toLowerCase();
  if (!clean) return false;

  // Match email format
  if (clean.includes("@") && /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(clean)) {
    return true;
  }

  // Match phone format: at least 7 digits, allowed chars are spaces, parens, dashes, pluses
  const digitsCount = (clean.match(/\d/g) || []).length;
  if (digitsCount >= 7 && /^[0-9+\s()-.]{7,25}$/.test(clean)) {
    return true;
  }

  // Match exact fields from sender context
  if (email && clean === email.trim().toLowerCase()) return true;
  if (phone && clean === phone.trim().toLowerCase()) return true;
  if (location && clean === location.trim().toLowerCase()) return true;

  // Match typical address / contact labels
  const commonContactPatterns = [
    /^phone:/i,
    /^email:/i,
    /^address:/i,
    /^linkedin:/i,
    /^github:/i,
    /^portfolio:/i,
  ];
  if (commonContactPatterns.some((pat) => pat.test(clean))) {
    return true;
  }

  return false;
};

export interface ParsedCoverLetter {
  salutation: string;
  paragraphs: string[];
  signOff: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  senderLocation: string;
  recipientName: string;
  companyName: string;
  companyLocation: string;
  date: string;
  subject: string;
  showSignatureDesign?: boolean;
  fontSize?: number;
}

export function parseCoverLetterContent(
  content: string,
  fallbackRecipient: string,
  fallbackSender: string,
  senderEmail?: string | null,
  senderPhone?: string | null,
  senderLocation?: string | null,
  companyName?: string | null,
  companyLocation?: string | null,
  jobTitle?: string | null
): ParsedCoverLetter {
  const defaultResult: ParsedCoverLetter = {
    salutation: `Dear ${fallbackRecipient || "Hiring Manager"},`,
    paragraphs: [],
    signOff: "Yours Sincerely,",
    senderName: fallbackSender || "Your Name",
    senderEmail: senderEmail || "",
    senderPhone: senderPhone || "",
    senderLocation: senderLocation || "",
    recipientName: fallbackRecipient || "Hiring Manager",
    companyName: companyName || "",
    companyLocation: companyLocation || "",
    date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    subject: jobTitle ? `Application for ${jobTitle}${companyName ? ` at ${companyName}` : ""}` : "",
    showSignatureDesign: true
  };

  if (!content) {
    return defaultResult;
  }

  // Check if content is a JSON string
  try {
    const parsedJson = JSON.parse(content);
    if (parsedJson && (parsedJson.body !== undefined || parsedJson.closing !== undefined || parsedJson.signature !== undefined)) {
      const finalRecipientName = fallbackRecipient || "Hiring Manager";
      const finalCompanyName = companyName || "";
      const finalCompanyLocation = companyLocation || "";
      const finalSubject = jobTitle ? `Application for ${jobTitle}${companyName ? ` at ${companyName}` : ""}` : "";
      
      const bodyText = parsedJson.body || "";
      const paragraphs = bodyText
        .split("\n")
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);

      const finalSalutation = `Dear ${finalRecipientName},`;
      const getPunc = (s: string) => (s && !s.endsWith(",") && !s.endsWith(":") && !s.endsWith(".") ? s + "," : s);

      return {
        date: (parsedJson.date !== undefined && parsedJson.date.toLowerCase() !== "[date]" && parsedJson.date.trim() !== "") ? parsedJson.date : defaultResult.date,
        recipientName: finalRecipientName,
        companyName: finalCompanyName,
        companyLocation: finalCompanyLocation,
        subject: finalSubject,
        salutation: "",
        paragraphs: paragraphs,
        signOff: parsedJson.closing !== undefined ? getPunc(parsedJson.closing) : defaultResult.signOff,
        senderName: parsedJson.signature || fallbackSender || "Your Name",
        senderEmail: senderEmail || "",
        senderPhone: senderPhone || "",
        senderLocation: senderLocation || "",
        showSignatureDesign: parsedJson.showSignatureDesign !== undefined ? parsedJson.showSignatureDesign : true,
        fontSize: parsedJson.fontSize !== undefined ? Number(parsedJson.fontSize) : undefined
      };
    }
  } catch {
    // Fail silently and continue with legacy plain text parsing
  }

  // Normalize HTML to text
  const normalized = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n");

  let textContent = "";
  if (typeof DOMParser !== "undefined") {
    try {
      const parsed = new DOMParser().parseFromString(
        `<div>${normalized}</div>`,
        "text/html",
      );
      textContent = parsed.body.textContent ?? "";
    } catch {
      textContent = normalized.replace(/<[^>]+>/g, " ");
    }
  } else {
    textContent = normalized.replace(/<[^>]+>/g, " ");
  }

  const lines = textContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let salutationIdx = -1;
  let signOffIdx = -1;

  // 1. Find Salutation Index (within first 8 lines)
  const salutationRegex = /^(dear|to\s+the|hello|hi|attention|re:)\b/i;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    if (salutationRegex.test(lines[i]) || lines[i].endsWith(",")) {
      salutationIdx = i;
      break;
    }
  }

  // 2. Find Sign-off Index (within last 6 lines)
  const signOffRegex = /^(sincerely|yours|best|warm|regards|respectfully|thank\s+you|with)/i;
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 6); i--) {
    if (signOffRegex.test(lines[i])) {
      signOffIdx = i;
      break;
    }
  }

  // Parse Header (lines before salutation)
  let parsedDate = "";
  let parsedSubject = "";
  let parsedRecipientName = "";
  let parsedCompanyName = "";
  let parsedCompanyLocation = "";
  let headerLines: string[] = [];

  if (salutationIdx !== -1) {
    headerLines = lines.slice(0, salutationIdx);
  } else {
    // If no salutation found, check if first 3-5 lines look like metadata
    let headerEnd = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      const cleanLower = line.toLowerCase();
      if (
        cleanLower === "[date]" || 
        /^[A-Za-z]+ \d{1,2}, \d{4}$/.test(line) ||
        cleanLower.includes("hiring manager") ||
        (companyName && cleanLower.includes(companyName.toLowerCase())) ||
        (companyLocation && cleanLower.includes(companyLocation.toLowerCase()))
      ) {
        headerEnd = i + 1;
      }
    }
    headerLines = lines.slice(0, headerEnd);
  }

  // Parse header items
  const remainingHeaderLines: string[] = [];
  for (const line of headerLines) {
    const cleanLower = line.toLowerCase();
    
    // Check Date
    if (cleanLower === "[date]" || /^[A-Za-z]+ \d{1,2}, \d{4}$/.test(line)) {
      parsedDate = line;
      continue;
    }
    
    // Check Subject
    if (cleanLower.startsWith("subject:") || cleanLower.startsWith("re:")) {
      parsedSubject = line.replace(/^(subject:|re:)\s*/i, "").trim();
      continue;
    }

    // Skip sender info if accidentally placed in header
    if (isContactLine(line, senderEmail, senderPhone, senderLocation)) {
      continue;
    }
    if (fallbackSender && cleanLower === fallbackSender.toLowerCase()) {
      continue;
    }

    remainingHeaderLines.push(line);
  }

  // Assign remaining header lines to recipient block
  if (remainingHeaderLines.length > 0) {
    parsedRecipientName = remainingHeaderLines[0];
    if (remainingHeaderLines.length > 1) {
      parsedCompanyName = remainingHeaderLines[1];
    }
    if (remainingHeaderLines.length > 2) {
      parsedCompanyLocation = remainingHeaderLines.slice(2).join(", ");
    }
  }

  // Parse Footer (lines at or after sign-off)
  let parsedSignOff = "";
  let parsedSenderName = "";
  let parsedSenderEmail = "";
  let parsedSenderPhone = "";
  let parsedSenderLocation = "";

  if (signOffIdx !== -1) {
    parsedSignOff = lines[signOffIdx];
    if (signOffIdx + 1 < lines.length) {
      parsedSenderName = lines[signOffIdx + 1];
    }
    
    // Parse sender contact details after the name
    for (let i = signOffIdx + 2; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("@")) {
        parsedSenderEmail = line;
      } else if ((line.match(/\d/g) || []).length >= 7) {
        parsedSenderPhone = line;
      } else {
        parsedSenderLocation = line;
      }
    }
  } else {
    // If no sign-off found, check if the last line matches the sender's name
    const lastLine = lines[lines.length - 1];
    if (fallbackSender && lastLine.toLowerCase() === fallbackSender.toLowerCase()) {
      parsedSenderName = lastLine;
    }
  }

  // Extract body paragraphs
  const startBodyIdx = salutationIdx !== -1 ? salutationIdx + 1 : headerLines.length;
  const endBodyIdx = signOffIdx !== -1 ? signOffIdx : lines.length - (parsedSenderName ? 1 : 0);
  
  const rawBodyLines = lines.slice(startBodyIdx, endBodyIdx);
  const bodyParagraphs = rawBodyLines.filter((line) => {
    const cleanLower = line.toLowerCase();
    
    // Skip remaining matches to prevent leaks
    if (fallbackSender && cleanLower === fallbackSender.toLowerCase()) return false;
    if (parsedSenderName && cleanLower === parsedSenderName.toLowerCase()) return false;
    if (isContactLine(line, senderEmail, senderPhone, senderLocation)) return false;
    if (cleanLower === "[date]" || /^[A-Za-z]+ \d{1,2}, \d{4}$/.test(line)) return false;
    if (cleanLower.startsWith("subject:") || cleanLower.startsWith("re:")) return false;
    if (cleanLower.startsWith("dear ") || cleanLower.startsWith("sincerely") || cleanLower.startsWith("best regards")) return false;
    
    return true;
  });

  // Resolve values (parsed || fallback)
  const finalDate = (!parsedDate || parsedDate.toLowerCase() === "[date]") ? defaultResult.date : parsedDate;
  const finalSubject = parsedSubject || defaultResult.subject;
  const finalRecipientName = parsedRecipientName || defaultResult.recipientName;
  const finalCompanyName = parsedCompanyName || defaultResult.companyName;
  const finalCompanyLocation = parsedCompanyLocation || defaultResult.companyLocation;
  
  let finalSalutation = "";
  if (salutationIdx !== -1) {
    const rawSal = lines[salutationIdx];
    const match = rawSal.match(/^(dear|hello|hi|to\s+the|attention|re:)\b/i);
    if (match) {
      const greeting = match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase();
      const rec = rawSal.slice(match[0].length).replace(/,$/, "").trim();
      if (!rec) {
        finalSalutation = `${greeting} ${finalRecipientName}`;
      } else if (
        rec.toLowerCase() === "hiring manager" && 
        finalRecipientName.toLowerCase() !== "hiring manager"
      ) {
        finalSalutation = `${greeting} ${finalRecipientName}`;
      } else {
        finalSalutation = `${greeting} ${rec}`;
      }
    } else {
      const cleanSal = rawSal.replace(/,$/, "").trim();
      if (cleanSal.toLowerCase() === "hiring manager" && finalRecipientName.toLowerCase() !== "hiring manager") {
        finalSalutation = `Dear ${finalRecipientName}`;
      } else {
        finalSalutation = `Dear ${cleanSal}`;
      }
    }
  } else {
    finalSalutation = `Dear ${finalRecipientName}`;
  }

  const finalSignOff = parsedSignOff || defaultResult.signOff;
  const finalSenderName = parsedSenderName || defaultResult.senderName;
  const finalSenderEmail = parsedSenderEmail || defaultResult.senderEmail;
  const finalSenderPhone = parsedSenderPhone || defaultResult.senderPhone;
  const finalSenderLocation = parsedSenderLocation || defaultResult.senderLocation;

  // Add standard comma punctuation to salutation and sign-off if missing
  const getPunc = (s: string) => (s && !s.endsWith(",") && !s.endsWith(":") && !s.endsWith(".") ? s + "," : s);

  return {
    date: finalDate,
    recipientName: finalRecipientName,
    companyName: finalCompanyName,
    companyLocation: finalCompanyLocation,
    subject: finalSubject,
    salutation: getPunc(finalSalutation),
    paragraphs: bodyParagraphs,
    signOff: getPunc(finalSignOff),
    senderName: finalSenderName,
    senderEmail: finalSenderEmail,
    senderPhone: finalSenderPhone,
    senderLocation: finalSenderLocation
  };
}

export const CoverLetterPreview: React.FC<CoverLetterPreviewProps> = ({
  content,
  senderName,
  senderEmail,
  senderPhone,
  senderLocation,
  recipientName,
  companyName,
  companyLocation,
  jobTitle,
  templateId = "classic",
  accentColor = "#1e3a8a",
  fontFamily = "sans",
  zoom = 1,
  showWatermark = false,
  showSignatureDesign,
  fontSize,
}) => {
  const finalFontClass = useMemo(() => {
    if (fontFamily === "serif") return "font-serif";
    if (fontFamily === "mono") return "font-mono";
    return "font-sans";
  }, [fontFamily]);

  const parsed = useMemo(() => {
    const p = parseCoverLetterContent(
      content,
      recipientName,
      senderName,
      senderEmail,
      senderPhone,
      senderLocation,
      companyName,
      companyLocation,
      jobTitle
    );
    if (showSignatureDesign !== undefined) {
      p.showSignatureDesign = showSignatureDesign;
    }
    return p;
  }, [content, recipientName, senderName, senderEmail, senderPhone, senderLocation, companyName, companyLocation, jobTitle, showSignatureDesign]);

  const activeFontSize = fontSize || parsed.fontSize || 16;

  const dateStr = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  const wordCount = useMemo(() => {
    return content ? content.split(/\s+/).filter(Boolean).length : 0;
  }, [content]);

  // Premium dynamic scaling parameters based on both font size and word count to prevent page overflow
  const scale = useMemo(() => {
    const fs = activeFontSize;
    
    // Relative text sizes
    const textXs = `text-[${Math.max(9, Math.round(fs * 0.78))}px]`;
    const textSm = `text-[${Math.max(10, Math.round(fs * 0.90))}px]`;
    const textBase = `text-[${fs}px]`;
    const textLg = `text-[${Math.round(fs * 1.15)}px]`;
    const textXl = `text-[${Math.round(fs * 1.35)}px]`;
    const text2xl = `text-[${Math.round(fs * 1.65)}px]`;
    const text3xl = `text-[${Math.round(fs * 2.0)}px]`;

    // Space / Padding scales based on both font size and word count to ensure single-page fit
    const isLarge = fs >= 17.5 || wordCount > 320;
    const isMedium = fs >= 15.5 || wordCount > 250;

    return {
      xs: textXs,
      sm: textSm,
      base: textBase,
      lg: textLg,
      xl: textXl,
      xxl: text2xl,
      xxxl: text3xl,
      bodyFont: `${textBase} leading-relaxed`,
      paragraphSpacing: isLarge ? "space-y-2.5" : isMedium ? "space-y-3.5" : "space-y-4.5",
      padding: isLarge ? "pt-5 pb-5 px-7" : isMedium ? "pt-7 pb-7 px-9" : "pt-10 pb-10 px-10",
      headerMargin: isLarge ? "mb-2.5 mt-0" : isMedium ? "mb-4.5 mt-0" : "mb-6.5 mt-1",
      itemMargin: isLarge ? "mb-2" : isMedium ? "mb-3.5" : "mb-5",
      footerMargin: isLarge ? "mt-3 pt-2.5 border-t" : isMedium ? "mt-5 pt-3.5 border-t" : "mt-8.5 pt-4.5 border-t",
      footerMarginNoBorder: isLarge ? "mt-3" : isMedium ? "mt-5" : "mt-8.5",
      subjectMargin: isLarge ? "mb-2.5" : "mb-4",
      salutationMargin: isLarge ? "mb-2" : "mb-4",
    };
  }, [wordCount, activeFontSize]);

  const renderedTemplate = useMemo(() => {
    switch (templateId) {
      case "modern":
        return (
          <div className={`h-full flex flex-col text-slate-800 relative ${scale.padding}`}>
            {/* Top Border Accent */}
            <div
              className="absolute top-0 inset-x-0 h-3"
              style={{ backgroundColor: accentColor }}
            />
            <div>
              {/* Header */}
              <div className={`flex justify-between items-start ${scale.headerMargin}`}>
                <div>
                  <h1
                    className="text-3xl font-extrabold tracking-tight"
                    style={{ color: accentColor }}
                  >
                    {parsed.senderName || "Your Name"}
                  </h1>
                  <p className="text-slate-500 font-medium text-xs mt-1 uppercase tracking-wider">
                    Applicant
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500 space-y-1">
                  {parsed.senderEmail && <p>{parsed.senderEmail}</p>}
                  {parsed.senderPhone && <p>{parsed.senderPhone}</p>}
                  {parsed.senderLocation && <p>{parsed.senderLocation}</p>}
                </div>
              </div>

              {/* Recipient Details & Date */}
              <div className={`grid grid-cols-2 gap-4 text-sm ${scale.itemMargin}`}>
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Attention
                  </p>
                  <p className="font-bold text-slate-700">
                    {parsed.recipientName || "Hiring Manager"}
                  </p>
                  {parsed.companyName && <p className="text-slate-600">{parsed.companyName}</p>}
                  {parsed.companyLocation && (
                    <p className="text-slate-500 text-xs">{parsed.companyLocation}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Date
                  </p>
                  <p className="text-slate-600">{parsed.date}</p>
                </div>
              </div>

              {/* Subject */}
              {parsed.subject && (
                <div className={`${scale.subjectMargin} border-l-4 pl-3 py-1`} style={{ borderLeftColor: accentColor }}>
                  <p className="font-bold text-slate-800 text-sm">
                    RE: {parsed.subject}
                  </p>
                </div>
              )}

              {/* Salutation */}
              {parsed.salutation && (
                <p className={`font-bold text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>
              )}

              {/* Body */}
              <div className={`${scale.paragraphSpacing} ${scale.bodyFont} text-slate-700 leading-relaxed text-justify`}>
                {parsed.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>

            {/* Footer / Sign-off */}
            <div className={`${scale.footerMargin} border-slate-100`}>
              <p className="text-slate-500 text-xs mb-1">{parsed.signOff}</p>
              <div className="py-1">
                <p 
                  className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none" 
                  style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                >
                  {parsed.senderName}
                </p>
              </div>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{parsed.senderName}</p>
            </div>
          </div>
        );

      case "minimal":
        return (
          <div className={`h-full flex flex-col text-zinc-800 ${scale.padding}`}>
            <div>
              {/* Header */}
              <div className={`text-center border-b ${wordCount > 330 ? "pb-3" : wordCount > 260 ? "pb-5" : "pb-8"} ${scale.headerMargin}`} style={{ borderBottomColor: accentColor }}>
                <h1 className="text-2xl font-light tracking-widest uppercase" style={{ color: accentColor }}>
                  {parsed.senderName || "Your Name"}
                </h1>
                <div className="flex justify-center items-center gap-4 text-xs text-zinc-400 mt-3 font-light">
                  {parsed.senderEmail && <span>{parsed.senderEmail}</span>}
                  {parsed.senderPhone && <span>•</span>}
                  {parsed.senderPhone && <span>{parsed.senderPhone}</span>}
                  {parsed.senderLocation && <span>•</span>}
                  {parsed.senderLocation && <span>{parsed.senderLocation}</span>}
                </div>
              </div>

              {/* Date */}
              <p className={`text-zinc-400 text-xs tracking-wider ${scale.salutationMargin}`}>
                {parsed.date.toUpperCase()}
              </p>

              {/* Recipient details */}
              <div className={`text-xs space-y-1 text-zinc-500 font-light ${scale.itemMargin}`}>
                <p className="font-semibold text-zinc-800 text-sm">
                  {parsed.recipientName || "Hiring Manager"}
                </p>
                {parsed.companyName && <p>{parsed.companyName}</p>}
                {parsed.companyLocation && <p>{parsed.companyLocation}</p>}
              </div>

              {/* Subject */}
              {parsed.subject && (
                <p className={`font-bold text-xs uppercase tracking-wider ${scale.subjectMargin}`} style={{ color: accentColor }}>
                  Subject: {parsed.subject}
                </p>
              )}

              {/* Salutation */}
              {parsed.salutation && (
                <p className={`font-medium text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>
              )}

              {/* Body */}
              <div className={`${scale.paragraphSpacing} ${scale.bodyFont} text-zinc-600 leading-relaxed`}>
                {parsed.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>

            {/* Footer / Sign-off */}
            <div className={`${scale.footerMarginNoBorder}`}>
              <p className="text-zinc-400 text-xs mb-1">{parsed.signOff}</p>
              {parsed.showSignatureDesign !== false && (
                <div className="py-1">
                  <p 
                    className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none" 
                    style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                  >
                    {parsed.senderName}
                  </p>
                </div>
              )}
              <p className="font-bold text-zinc-800 text-sm mt-0.5">{parsed.senderName}</p>
            </div>
          </div>
        );

      case "creative":
        return (
          <div className={`h-full flex flex-col text-slate-800 relative overflow-hidden ${scale.padding}`}>
            {/* Left Accent Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2.5"
              style={{ backgroundColor: accentColor }}
            />
            <div>
              {/* Header */}
              <div className={`flex justify-between items-start pl-4 ${scale.headerMargin}`}>
                <div>
                  <h1 className="text-4xl font-black tracking-tight uppercase leading-none">
                    {parsed.senderName || "Your Name"}
                  </h1>
                  {parsed.subject && (
                    <p
                      className="text-xs font-bold tracking-widest uppercase mt-2"
                      style={{ color: accentColor }}
                    >
                      RE: {parsed.subject}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                  {parsed.senderEmail && <p className="font-semibold">{parsed.senderEmail}</p>}
                  {parsed.senderPhone && <p>{parsed.senderPhone}</p>}
                  {parsed.senderLocation && <p className="text-slate-400">{parsed.senderLocation}</p>}
                </div>
              </div>

              {/* Divider */}
              <div className={`h-px bg-slate-200 w-full pl-4 ${scale.itemMargin}`} />

              {/* Recipient Details & Date */}
              <div className={`pl-4 grid grid-cols-2 gap-4 text-sm ${scale.itemMargin}`}>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    To
                  </h3>
                  <p className="font-bold text-slate-800">
                    {parsed.recipientName || "Hiring Manager"}
                  </p>
                  {parsed.companyName && (
                    <p className="font-medium text-slate-600">{parsed.companyName}</p>
                  )}
                  {parsed.companyLocation && (
                    <p className="text-slate-400 text-xs">{parsed.companyLocation}</p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Date
                  </h3>
                  <p className="font-medium text-slate-700">{parsed.date}</p>
                </div>
              </div>

              {/* Salutation */}
              {parsed.salutation && (
                <p className={`pl-4 font-bold text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>
              )}

              {/* Body */}
              <div className={`pl-4 text-slate-700 leading-relaxed text-justify ${scale.paragraphSpacing} ${scale.bodyFont}`}>
                {parsed.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>

            {/* Footer / Sign-off */}
            <div className={`pl-4 border-t border-slate-100 flex justify-between items-end ${scale.footerMargin}`}>
              <div>
                <p className="text-slate-400 text-xs mb-1">{parsed.signOff}</p>
                {parsed.showSignatureDesign !== false && (
                  <div className="py-1">
                    <p 
                      className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none" 
                      style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                    >
                      {parsed.senderName}
                    </p>
                  </div>
                )}
                <p className="font-bold text-slate-800 text-sm mt-0.5">{parsed.senderName}</p>
              </div>
              <div
                className="w-12 h-1.5 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          </div>
        );

      case "elegant":
        return (
          <div className={`h-full flex flex-col text-stone-800 ${scale.padding}`}>
            <div>
              {/* Header */}
              <div className={`text-center ${scale.headerMargin}`}>
                <h1 className="text-3xl tracking-normal text-stone-900" style={{ color: accentColor }}>
                  {parsed.senderName || "Your Name"}
                </h1>
                <div className="flex justify-center items-center gap-3 text-xs text-stone-500 mt-2 italic">
                  {parsed.senderEmail && <span>{parsed.senderEmail}</span>}
                  {parsed.senderPhone && <span>•</span>}
                  {parsed.senderPhone && <span>{parsed.senderPhone}</span>}
                  {parsed.senderLocation && <span>•</span>}
                  {parsed.senderLocation && <span>{parsed.senderLocation}</span>}
                </div>
                <div
                  className="w-24 h-0.5 mx-auto mt-6"
                  style={{ backgroundColor: accentColor }}
                />
              </div>

              {/* Recipient Details & Date */}
              <div className={`flex justify-between items-start text-xs ${scale.itemMargin}`}>
                <div className="space-y-1">
                  <p className="font-bold text-stone-700 text-sm italic">
                    To:
                  </p>
                  <p className="font-semibold text-stone-800">
                    {parsed.recipientName || "Hiring Manager"}
                  </p>
                  {parsed.companyName && <p>{parsed.companyName}</p>}
                  {parsed.companyLocation && <p>{parsed.companyLocation}</p>}
                </div>
                <div className="text-right">
                  <p className="text-stone-500 italic mb-1">Written on</p>
                  <p className="font-medium text-stone-800">{parsed.date}</p>
                </div>
              </div>

              {/* Subject */}
              {parsed.subject && (
                <div className={`border-b pb-2 ${scale.subjectMargin}`} style={{ borderBottomColor: accentColor }}>
                  <p className="font-bold text-xs tracking-wide uppercase italic" style={{ color: accentColor }}>
                    RE: {parsed.subject}
                  </p>
                </div>
              )}

              {/* Salutation */}
              {parsed.salutation && (
                <p className={`font-semibold text-sm italic ${scale.salutationMargin}`}>{parsed.salutation}</p>
              )}

              {/* Body */}
              <div className={`text-stone-700 text-justify ${scale.paragraphSpacing} ${scale.bodyFont}`}>
                {parsed.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>

            {/* Footer / Sign-off */}
            <div className={`text-right ${scale.footerMarginNoBorder}`}>
              <p className="text-stone-500 text-xs italic mb-1">{parsed.signOff}</p>
              {parsed.showSignatureDesign !== false && (
                <div className="py-1 flex justify-end">
                  <p 
                    className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none text-right" 
                    style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                  >
                    {parsed.senderName}
                  </p>
                </div>
              )}
              <p className="font-bold text-stone-800 text-sm mt-0.5">{parsed.senderName}</p>
            </div>
          </div>
        );

      case "professional":
        return (
          <div className={`h-full flex flex-col text-slate-800 ${scale.padding}`}>
            <div>
              {/* Header */}
              <div className={`flex justify-between items-stretch border-b-2 pb-4 ${scale.headerMargin}`} style={{ borderBottomColor: accentColor }}>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: accentColor }}>
                    {parsed.senderName || "Your Name"}
                  </h1>
                  {parsed.subject && (
                    <p className="text-slate-500 text-xs mt-1 font-semibold uppercase tracking-wider">
                      RE: {parsed.subject}
                    </p>
                  )}
                </div>
                <div className="border-l-2 pl-6 text-xs text-slate-600 space-y-1 flex flex-col justify-center" style={{ borderLeftColor: accentColor }}>
                  {parsed.senderEmail && <p>{parsed.senderEmail}</p>}
                  {parsed.senderPhone && <p>{parsed.senderPhone}</p>}
                  {parsed.senderLocation && <p>{parsed.senderLocation}</p>}
                </div>
              </div>

              {/* Date */}
              <p className={`text-slate-500 text-xs font-semibold ${scale.salutationMargin}`}>
                {parsed.date}
              </p>

              {/* Recipient Details */}
              <div className={`text-xs text-slate-600 space-y-1 ${scale.itemMargin}`}>
                <p className="font-bold text-slate-800 text-sm">
                  {parsed.recipientName || "Hiring Manager"}
                </p>
                {parsed.companyName && (
                  <p className="font-semibold">{parsed.companyName}</p>
                )}
                {parsed.companyLocation && <p>{parsed.companyLocation}</p>}
              </div>

              {/* Salutation */}
              {parsed.salutation && (
                <p className={`font-bold text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>
              )}

              {/* Body */}
              <div className={`text-slate-700 text-justify ${scale.paragraphSpacing} ${scale.bodyFont}`}>
                {parsed.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>

            {/* Footer / Sign-off */}
            <div className={`border-t border-slate-100 ${scale.footerMargin}`}>
              <p className="text-slate-500 text-xs mb-1">{parsed.signOff}</p>
              {parsed.showSignatureDesign !== false && (
                <div className="py-1">
                  <p 
                    className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none" 
                    style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                  >
                    {parsed.senderName}
                  </p>
                </div>
              )}
              <p className="font-bold text-slate-900 text-sm mt-0.5">{parsed.senderName}</p>
            </div>
          </div>
        );

      case "startup":
        return (
          <div className={`h-full flex flex-col text-neutral-800 bg-neutral-50/10 ${scale.padding}`}>
            <div>
              {/* Header */}
              <div className={`flex justify-between items-start gap-4 ${scale.headerMargin}`}>
                <div>
                  <h1 className="text-3xl font-black tracking-tight" style={{ color: accentColor }}>
                    {parsed.senderName || "Your Name"}
                  </h1>
                  {parsed.senderLocation && (
                    <p className="text-neutral-500 text-xs font-semibold mt-1">
                      {parsed.senderLocation}
                    </p>
                  )}
                </div>
                <div className="text-xs text-neutral-600 space-y-1 bg-neutral-100/60 p-3 rounded-lg border border-neutral-200/50">
                  {parsed.senderEmail && <p className="font-mono">{parsed.senderEmail}</p>}
                  {parsed.senderPhone && <p className="font-mono">{parsed.senderPhone}</p>}
                </div>
              </div>

              {/* Date & Recipient Grid */}
              <div className={`grid grid-cols-2 gap-4 text-xs border-y py-3 ${scale.itemMargin}`} style={{ borderTopColor: `${accentColor}30`, borderBottomColor: `${accentColor}30` }}>
                <div>
                  <span className="text-neutral-400 font-mono text-[10px] uppercase block mb-1">
                    To
                  </span>
                  <p className="font-bold text-neutral-900">
                    {parsed.recipientName || "Hiring Manager"}
                  </p>
                  {parsed.companyName && <p className="text-neutral-700">{parsed.companyName}</p>}
                </div>
                <div className="text-right">
                  <span className="text-neutral-400 font-mono text-[10px] uppercase block mb-1">
                    Date
                  </span>
                  <p className="font-semibold text-neutral-700">{parsed.date}</p>
                </div>
              </div>

              {/* Subject */}
              {parsed.subject && (
                <div className={`${scale.subjectMargin}`}>
                  <span className="text-neutral-50 text-[10px] font-mono uppercase px-2 py-0.5 rounded" style={{ backgroundColor: accentColor }}>
                    Role: {parsed.subject}
                  </span>
                </div>
              )}

              {/* Salutation */}
              {parsed.salutation && (
                <p className={`font-bold text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>
              )}

              {/* Body */}
              <div className={`text-neutral-700 ${scale.paragraphSpacing} ${scale.bodyFont}`}>
                {parsed.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>

            {/* Footer / Sign-off */}
            <div className={`border-t ${scale.footerMargin}`} style={{ borderTopColor: `${accentColor}30` }}>
              <div>
                <p className="text-neutral-500 text-xs mb-1">{parsed.signOff}</p>
                {parsed.showSignatureDesign !== false && (
                  <div className="py-1">
                    <p 
                      className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none" 
                      style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                    >
                      {parsed.senderName}
                    </p>
                  </div>
                )}
                <p className="font-bold text-neutral-900 text-sm mt-0.5">{parsed.senderName}</p>
              </div>
            </div>
          </div>
        );

      case "classic":
      default:
        return (
          <div className={`h-full flex flex-col text-slate-800 ${scale.padding}`}>
            <div>
              {/* Header */}
              <div className={`text-center border-b pb-4 ${scale.headerMargin}`} style={{ borderBottomColor: accentColor }}>
                <h1 className="text-3xl font-bold tracking-tight" style={{ color: accentColor }}>
                  {parsed.senderName || "Your Name"}
                </h1>
                <div className="flex justify-center items-center gap-4 text-xs text-slate-500 mt-2">
                  {parsed.senderEmail && <span>{parsed.senderEmail}</span>}
                  {parsed.senderPhone && <span>|</span>}
                  {parsed.senderPhone && <span>{parsed.senderPhone}</span>}
                  {parsed.senderLocation && <span>|</span>}
                  {parsed.senderLocation && <span>{parsed.senderLocation}</span>}
                </div>
              </div>

              {/* Date */}
              <p className={`text-slate-700 text-sm ${scale.salutationMargin}`}>{parsed.date}</p>

              {/* Recipient Details */}
              <div className={`text-sm text-slate-750 ${scale.itemMargin}`}>
                <p className="font-bold text-slate-900">
                  {parsed.recipientName || "Hiring Manager"}
                </p>
                {parsed.companyName && <p>{parsed.companyName}</p>}
                {parsed.companyLocation && <p>{parsed.companyLocation}</p>}
              </div>

              {/* Subject */}
              {parsed.subject && (
                <p className={`font-bold text-sm ${scale.subjectMargin}`} style={{ color: accentColor }}>
                  Subject: {parsed.subject}
                </p>
              )}

              {/* Salutation */}
              {parsed.salutation && (
                <p className={`font-bold text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>
              )}

              {/* Body */}
              <div className={`text-slate-750 text-justify ${scale.paragraphSpacing} ${scale.bodyFont}`}>
                {parsed.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>

            {/* Footer / Sign-off */}
            <div className={`border-t border-slate-100 ${scale.footerMargin}`}>
              <p className="text-slate-500 text-xs mb-1">{parsed.signOff}</p>
              {parsed.showSignatureDesign !== false && (
                <div className="py-1">
                  <p 
                    className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none" 
                    style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                  >
                    {parsed.senderName}
                  </p>
                </div>
              )}
              <p className="font-bold text-slate-900 text-sm mt-0.5">{parsed.senderName}</p>
            </div>
          </div>
        );
    }
  }, [
    templateId,
    recipientName,
    companyName,
    companyLocation,
    jobTitle,
    accentColor,
    dateStr,
    scale,
    wordCount,
    parsed,
    senderEmail,
    senderPhone,
    senderLocation,
  ]);

  return (
    <div
      className="a4-page relative bg-white shadow-[0_4px_40px_rgba(0,0,0,0.12)] print:mb-0 print:shadow-none cover-letter-preview-root"
      style={{
        width: 794,
        height: 1123,
        overflow: "hidden",
        zoom,
        transformOrigin: "top center",
      }}
    >
      <style>{`
        .cover-letter-preview-root {
          font-size: ${activeFontSize}px;
        }
        .cover-letter-preview-root .text-xs {
          font-size: ${Math.max(9, Math.round(activeFontSize * 0.78))}px !important;
        }
        .cover-letter-preview-root .text-sm {
          font-size: ${Math.max(10, Math.round(activeFontSize * 0.90))}px !important;
        }
        .cover-letter-preview-root .text-base {
          font-size: ${activeFontSize}px !important;
        }
        .cover-letter-preview-root .text-lg {
          font-size: ${Math.round(activeFontSize * 1.15)}px !important;
        }
        .cover-letter-preview-root .text-xl {
          font-size: ${Math.round(activeFontSize * 1.35)}px !important;
        }
        .cover-letter-preview-root .text-2xl {
          font-size: ${Math.round(activeFontSize * 1.65)}px !important;
        }
        .cover-letter-preview-root .text-3xl {
          font-size: ${Math.round(activeFontSize * 2.0)}px !important;
        }
      `}</style>
      <div className={`h-full w-full relative ${finalFontClass}`}>
        {renderedTemplate}
      </div>
      {showWatermark && (
        <div className="absolute inset-x-0 bottom-2 z-[10] flex justify-center pointer-events-none">
          <ResumeWatermark backgroundColor="#ffffff" />
        </div>
      )}
    </div>
  );
};

export default CoverLetterPreview;
