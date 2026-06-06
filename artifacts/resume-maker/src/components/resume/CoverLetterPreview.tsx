import type React from "react";
import { useMemo } from "react";

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

export function parseCoverLetterContent(
  content: string,
  fallbackRecipient: string,
  fallbackSender: string,
  senderEmail?: string | null,
  senderPhone?: string | null,
  senderLocation?: string | null
): ParsedCoverLetter {
  if (!content) {
    return {
      salutation: `Dear ${fallbackRecipient || "Hiring Manager"},`,
      paragraphs: [],
      signOff: "Yours Sincerely,",
      senderName: fallbackSender || "Your Name",
    };
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

  let salutation = "";
  let signOff = "";
  let parsedSenderName = "";
  let bodyStartIdx = 0;
  let bodyEndIdx = lines.length;

  // 1. Parse Salutation (from the top)
  const salutationRegex = /^(dear|to\s+the|hello|hi|attention|re:)/i;
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    if (salutationRegex.test(lines[i]) || lines[i].endsWith(",")) {
      salutation = lines[i];
      bodyStartIdx = i + 1;
      break;
    }
  }

  // 2. Parse Sign-off & Sender Name (from the bottom)
  const signOffRegex = /^(sincerely|yours|best|warm|regards|respectfully|thank\s+you|with)/i;
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
    if (signOffRegex.test(lines[i])) {
      signOff = lines[i];
      bodyEndIdx = i;
      if (i + 1 < lines.length) {
        parsedSenderName = lines[i + 1];
      }
      break;
    }
  }

  // If we found a sender name but no sign-off, check if the last line is just the sender's name
  if (!signOff && lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    if (fallbackSender && lastLine.toLowerCase() === fallbackSender.toLowerCase()) {
      parsedSenderName = lastLine;
      bodyEndIdx = lines.length - 1;
    }
  }

  // Extract body lines
  const rawBodyLines = lines.slice(bodyStartIdx, bodyEndIdx);

  // Filter out any contact lines or empty lines
  const bodyParagraphs = rawBodyLines.filter((line) => {
    if (fallbackSender && line.toLowerCase() === fallbackSender.toLowerCase()) {
      return false;
    }
    if (parsedSenderName && line.toLowerCase() === parsedSenderName.toLowerCase()) {
      return false;
    }
    if (isContactLine(line, senderEmail, senderPhone, senderLocation)) {
      return false;
    }
    const cleanLower = line.toLowerCase();
    if (cleanLower.startsWith("dear ") || cleanLower.startsWith("sincerely") || cleanLower.startsWith("best regards")) {
      return false;
    }
    return true;
  });

  // Fallback defaults
  if (!salutation) {
    salutation = `Dear ${fallbackRecipient || "Hiring Manager"},`;
  }
  if (!signOff) {
    signOff = "Yours Sincerely,";
  }
  if (!parsedSenderName) {
    parsedSenderName = fallbackSender || "Your Name";
  }

  // Ensure salutation ends with comma if not already punctuated
  if (salutation && !salutation.endsWith(",") && !salutation.endsWith(":") && !salutation.endsWith(".")) {
    salutation = salutation + ",";
  }
  
  // Ensure sign-off ends with comma if not already punctuated
  if (signOff && !signOff.endsWith(",")) {
    signOff = signOff + ",";
  }

  return {
    salutation,
    paragraphs: bodyParagraphs,
    signOff,
    senderName: parsedSenderName,
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
}) => {
  const finalFontClass = useMemo(() => {
    if (fontFamily === "serif") return "font-serif";
    if (fontFamily === "mono") return "font-mono";
    return "font-sans";
  }, [fontFamily]);

  const parsed = useMemo(() => {
    return parseCoverLetterContent(
      content,
      recipientName,
      senderName,
      senderEmail,
      senderPhone,
      senderLocation
    );
  }, [content, recipientName, senderName, senderEmail, senderPhone, senderLocation]);

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

  // Premium dynamic scaling parameters based on word count to prevent page overflow
  const scale = useMemo(() => {
    if (wordCount > 340) {
      return {
        bodyFont: "text-[13px] leading-normal",
        paragraphSpacing: "space-y-2",
        padding: "pt-5 pb-5 px-8",
        headerMargin: "mb-3 mt-0",
        itemMargin: "mb-2",
        footerMargin: "mt-3 pt-2 border-t",
        footerMarginNoBorder: "mt-3",
        subjectMargin: "mb-2",
        salutationMargin: "mb-2",
      };
    } else if (wordCount > 270) {
      return {
        bodyFont: "text-[14px] leading-normal",
        paragraphSpacing: "space-y-3",
        padding: "pt-7 pb-7 px-9",
        headerMargin: "mb-4 mt-0",
        itemMargin: "mb-3",
        footerMargin: "mt-5 pt-3 border-t",
        footerMarginNoBorder: "mt-5",
        subjectMargin: "mb-3.5",
        salutationMargin: "mb-3",
      };
    } else {
      return {
        bodyFont: "text-[15px] leading-relaxed",
        paragraphSpacing: "space-y-4.5",
        padding: "pt-9 pb-9 px-10",
        headerMargin: "mb-6 mt-1",
        itemMargin: "mb-5",
        footerMargin: "mt-7 pt-4 border-t",
        footerMarginNoBorder: "mt-7",
        subjectMargin: "mb-5",
        salutationMargin: "mb-4",
      };
    }
  }, [wordCount]);

  const renderedTemplate = useMemo(() => {
    switch (templateId) {
      case "modern":
        return (
          <div className={`h-full flex flex-col justify-between text-slate-800 relative ${scale.padding}`}>
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
                  {senderEmail && <p>{senderEmail}</p>}
                  {senderPhone && <p>{senderPhone}</p>}
                  {senderLocation && <p>{senderLocation}</p>}
                </div>
              </div>

              {/* Recipient Details & Date */}
              <div className={`grid grid-cols-2 gap-4 text-sm ${scale.itemMargin}`}>
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Attention
                  </p>
                  <p className="font-bold text-slate-700">
                    {recipientName || "Hiring Manager"}
                  </p>
                  {companyName && <p className="text-slate-600">{companyName}</p>}
                  {companyLocation && (
                    <p className="text-slate-500 text-xs">{companyLocation}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Date
                  </p>
                  <p className="text-slate-600">{dateStr}</p>
                </div>
              </div>

              {/* Subject */}
              {jobTitle && (
                <div className={`${scale.subjectMargin} border-l-4 pl-3 py-1`} style={{ borderLeftColor: accentColor }}>
                  <p className="font-bold text-slate-800 text-sm">
                    RE: Application for {jobTitle}
                    {companyName ? ` at ${companyName}` : ""}
                  </p>
                </div>
              )}

              {/* Salutation */}
              <p className={`font-bold text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>

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
          <div className={`h-full flex flex-col justify-between text-zinc-800 ${scale.padding}`}>
            <div>
              {/* Header */}
              <div className={`text-center border-b ${wordCount > 330 ? "pb-3" : wordCount > 260 ? "pb-5" : "pb-8"} ${scale.headerMargin}`} style={{ borderBottomColor: accentColor }}>
                <h1 className="text-2xl font-light tracking-widest uppercase" style={{ color: accentColor }}>
                  {parsed.senderName || "Your Name"}
                </h1>
                <div className="flex justify-center items-center gap-4 text-xs text-zinc-400 mt-3 font-light">
                  {senderEmail && <span>{senderEmail}</span>}
                  {senderPhone && <span>•</span>}
                  {senderPhone && <span>{senderPhone}</span>}
                  {senderLocation && <span>•</span>}
                  {senderLocation && <span>{senderLocation}</span>}
                </div>
              </div>

              {/* Date */}
              <p className={`text-zinc-400 text-xs tracking-wider ${scale.salutationMargin}`}>
                {dateStr.toUpperCase()}
              </p>

              {/* Recipient details */}
              <div className={`text-xs space-y-1 text-zinc-500 font-light ${scale.itemMargin}`}>
                <p className="font-semibold text-zinc-800 text-sm">
                  {recipientName || "Hiring Manager"}
                </p>
                {companyName && <p>{companyName}</p>}
                {companyLocation && <p>{companyLocation}</p>}
              </div>

              {/* Subject */}
              {jobTitle && (
                <p className={`font-bold text-xs uppercase tracking-wider ${scale.subjectMargin}`} style={{ color: accentColor }}>
                  Subject: {jobTitle}
                </p>
              )}

              {/* Salutation */}
              <p className={`font-medium text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>

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
              <div className="py-1">
                <p 
                  className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none" 
                  style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                >
                  {parsed.senderName}
                </p>
              </div>
              <p className="font-bold text-zinc-800 text-sm mt-0.5">{parsed.senderName}</p>
            </div>
          </div>
        );

      case "creative":
        return (
          <div className={`h-full flex flex-col justify-between text-slate-800 relative overflow-hidden ${scale.padding}`}>
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
                  {jobTitle && (
                    <p
                      className="text-xs font-bold tracking-widest uppercase mt-2"
                      style={{ color: accentColor }}
                    >
                      Applying for: {jobTitle}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                  {senderEmail && <p className="font-semibold">{senderEmail}</p>}
                  {senderPhone && <p>{senderPhone}</p>}
                  {senderLocation && <p className="text-slate-400">{senderLocation}</p>}
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
                    {recipientName || "Hiring Manager"}
                  </p>
                  {companyName && (
                    <p className="font-medium text-slate-600">{companyName}</p>
                  )}
                  {companyLocation && (
                    <p className="text-slate-400 text-xs">{companyLocation}</p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Date
                  </h3>
                  <p className="font-medium text-slate-700">{dateStr}</p>
                </div>
              </div>

              {/* Salutation */}
              <p className={`pl-4 font-bold text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>

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
              <div
                className="w-12 h-1.5 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          </div>
        );

      case "elegant":
        return (
          <div className={`h-full flex flex-col justify-between text-stone-800 ${scale.padding}`}>
            <div>
              {/* Header */}
              <div className={`text-center ${scale.headerMargin}`}>
                <h1 className="text-3xl tracking-normal text-stone-900" style={{ color: accentColor }}>
                  {parsed.senderName || "Your Name"}
                </h1>
                <div className="flex justify-center items-center gap-3 text-xs text-stone-500 mt-2 italic">
                  {senderEmail && <span>{senderEmail}</span>}
                  {senderPhone && <span>•</span>}
                  {senderPhone && <span>{senderPhone}</span>}
                  {senderLocation && <span>•</span>}
                  {senderLocation && <span>{senderLocation}</span>}
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
                    {recipientName || "Hiring Manager"}
                  </p>
                  {companyName && <p>{companyName}</p>}
                  {companyLocation && <p>{companyLocation}</p>}
                </div>
                <div className="text-right">
                  <p className="text-stone-500 italic mb-1">Written on</p>
                  <p className="font-medium text-stone-800">{dateStr}</p>
                </div>
              </div>

              {/* Subject */}
              {jobTitle && (
                <div className={`border-b pb-2 ${scale.subjectMargin}`} style={{ borderBottomColor: accentColor }}>
                  <p className="font-bold text-xs tracking-wide uppercase italic" style={{ color: accentColor }}>
                    RE: {jobTitle}
                  </p>
                </div>
              )}

              {/* Salutation */}
              <p className={`font-semibold text-sm italic ${scale.salutationMargin}`}>{parsed.salutation}</p>

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
              <div className="py-1 flex justify-end">
                <p 
                  className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none text-right" 
                  style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                >
                  {parsed.senderName}
                </p>
              </div>
              <p className="font-bold text-stone-800 text-sm mt-0.5">{parsed.senderName}</p>
            </div>
          </div>
        );

      case "professional":
        return (
          <div className={`h-full flex flex-col justify-between text-slate-800 ${scale.padding}`}>
            <div>
              {/* Header */}
              <div className={`flex justify-between items-stretch border-b-2 pb-4 ${scale.headerMargin}`} style={{ borderBottomColor: accentColor }}>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: accentColor }}>
                    {parsed.senderName || "Your Name"}
                  </h1>
                  {jobTitle && (
                    <p className="text-slate-500 text-xs mt-1 font-semibold uppercase tracking-wider">
                      Position: {jobTitle}
                    </p>
                  )}
                </div>
                <div className="border-l-2 pl-6 text-xs text-slate-600 space-y-1 flex flex-col justify-center" style={{ borderLeftColor: accentColor }}>
                  {senderEmail && <p>{senderEmail}</p>}
                  {senderPhone && <p>{senderPhone}</p>}
                  {senderLocation && <p>{senderLocation}</p>}
                </div>
              </div>

              {/* Date */}
              <p className={`text-slate-500 text-xs font-semibold ${scale.salutationMargin}`}>
                {dateStr}
              </p>

              {/* Recipient Details */}
              <div className={`text-xs text-slate-600 space-y-1 ${scale.itemMargin}`}>
                <p className="font-bold text-slate-800 text-sm">
                  {recipientName || "Hiring Manager"}
                </p>
                {companyName && (
                  <p className="font-semibold">{companyName}</p>
                )}
                {companyLocation && <p>{companyLocation}</p>}
              </div>

              {/* Salutation */}
              <p className={`font-bold text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>

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
              <div className="py-1">
                <p 
                  className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none" 
                  style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                >
                  {parsed.senderName}
                </p>
              </div>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{parsed.senderName}</p>
            </div>
          </div>
        );

      case "startup":
        return (
          <div className={`h-full flex flex-col justify-between text-neutral-800 bg-neutral-50/10 ${scale.padding}`}>
            <div>
              {/* Header */}
              <div className={`flex justify-between items-start gap-4 ${scale.headerMargin}`}>
                <div>
                  <h1 className="text-3xl font-black tracking-tight" style={{ color: accentColor }}>
                    {parsed.senderName || "Your Name"}
                  </h1>
                  {senderLocation && (
                    <p className="text-neutral-500 text-xs font-semibold mt-1">
                      {senderLocation}
                    </p>
                  )}
                </div>
                <div className="text-xs text-neutral-600 space-y-1 bg-neutral-100/60 p-3 rounded-lg border border-neutral-200/50">
                  {senderEmail && <p className="font-mono">{senderEmail}</p>}
                  {senderPhone && <p className="font-mono">{senderPhone}</p>}
                </div>
              </div>

              {/* Date & Recipient Grid */}
              <div className={`grid grid-cols-2 gap-4 text-xs border-y py-3 ${scale.itemMargin}`} style={{ borderTopColor: `${accentColor}30`, borderBottomColor: `${accentColor}30` }}>
                <div>
                  <span className="text-neutral-400 font-mono text-[10px] uppercase block mb-1">
                    To
                  </span>
                  <p className="font-bold text-neutral-900">
                    {recipientName || "Hiring Manager"}
                  </p>
                  {companyName && <p className="text-neutral-700">{companyName}</p>}
                </div>
                <div className="text-right">
                  <span className="text-neutral-400 font-mono text-[10px] uppercase block mb-1">
                    Date
                  </span>
                  <p className="font-semibold text-neutral-700">{dateStr}</p>
                </div>
              </div>

              {/* Subject */}
              {jobTitle && (
                <div className={`${scale.subjectMargin}`}>
                  <span className="text-neutral-50 text-[10px] font-mono uppercase px-2 py-0.5 rounded" style={{ backgroundColor: accentColor }}>
                    Role: {jobTitle}
                  </span>
                </div>
              )}

              {/* Salutation */}
              <p className={`font-bold text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>

              {/* Body */}
              <div className={`text-neutral-700 ${scale.paragraphSpacing} ${scale.bodyFont}`}>
                {parsed.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>

            {/* Footer / Sign-off */}
            <div className={`border-t flex justify-between items-center ${scale.footerMargin}`} style={{ borderTopColor: `${accentColor}30` }}>
              <div>
                <p className="text-neutral-500 text-xs mb-1">{parsed.signOff}</p>
                <div className="py-1">
                  <p 
                    className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none" 
                    style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                  >
                    {parsed.senderName}
                  </p>
                </div>
                <p className="font-bold text-neutral-900 text-sm mt-0.5">{parsed.senderName}</p>
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">
                Generated via ResumeSensei
              </div>
            </div>
          </div>
        );

      case "classic":
      default:
        return (
          <div className={`h-full flex flex-col justify-between text-slate-800 ${scale.padding}`}>
            <div>
              {/* Header */}
              <div className={`text-center border-b pb-4 ${scale.headerMargin}`} style={{ borderBottomColor: accentColor }}>
                <h1 className="text-3xl font-bold tracking-tight" style={{ color: accentColor }}>
                  {parsed.senderName || "Your Name"}
                </h1>
                <div className="flex justify-center items-center gap-4 text-xs text-slate-500 mt-2">
                  {senderEmail && <span>{senderEmail}</span>}
                  {senderPhone && <span>|</span>}
                  {senderPhone && <span>{senderPhone}</span>}
                  {senderLocation && <span>|</span>}
                  {senderLocation && <span>{senderLocation}</span>}
                </div>
              </div>

              {/* Date */}
              <p className={`text-slate-700 text-sm ${scale.salutationMargin}`}>{dateStr}</p>

              {/* Recipient Details */}
              <div className={`text-sm text-slate-750 ${scale.itemMargin}`}>
                <p className="font-bold text-slate-900">
                  {recipientName || "Hiring Manager"}
                </p>
                {companyName && <p>{companyName}</p>}
                {companyLocation && <p>{companyLocation}</p>}
              </div>

              {/* Subject */}
              {jobTitle && (
                <p className={`font-bold text-sm ${scale.subjectMargin}`} style={{ color: accentColor }}>
                  Subject: Application for {jobTitle}
                </p>
              )}

              {/* Salutation */}
              <p className={`font-bold text-sm ${scale.salutationMargin}`}>{parsed.salutation}</p>

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
              <div className="py-1">
                <p 
                  className="text-2xl font-normal tracking-wide select-none pointer-events-none leading-none" 
                  style={{ fontFamily: "'Caveat', cursive", color: accentColor }}
                >
                  {parsed.senderName}
                </p>
              </div>
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
      className="a4-page relative bg-white shadow-[0_4px_40px_rgba(0,0,0,0.12)] print:mb-0 print:shadow-none"
      style={{
        width: 794,
        height: 1123,
        overflow: "hidden",
        zoom,
        transformOrigin: "top center",
      }}
    >
      <div className={`h-full w-full relative ${finalFontClass}`}>
        {renderedTemplate}
      </div>
    </div>
  );
};

export default CoverLetterPreview;
