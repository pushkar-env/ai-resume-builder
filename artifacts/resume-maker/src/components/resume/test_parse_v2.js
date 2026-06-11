const isContactLine = (
  line,
  email,
  phone,
  location
) => {
  const clean = line.trim().toLowerCase();
  if (!clean) return false;

  // Match email format
  if (clean.includes("@") && /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(clean)) {
    return true;
  }

  // Match phone format
  const digitsCount = (clean.match(/\d/g) || []).length;
  if (digitsCount >= 7 && /^[0-9+\s()-.]{7,25}$/.test(clean)) {
    return true;
  }

  // Match exact fields from sender context
  if (email && clean === email.trim().toLowerCase()) return true;
  if (phone && clean === phone.trim().toLowerCase()) return true;
  if (location && clean === location.trim().toLowerCase()) return true;

  return false;
};

function parseCoverLetterContent(
  content,
  fallbackRecipient,
  fallbackSender,
  senderEmail,
  senderPhone,
  senderLocation,
  companyName,
  companyLocation,
  jobTitle
) {
  const defaultResult = {
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
    subject: jobTitle ? `Application for ${jobTitle}${companyName ? ` at ${companyName}` : ""}` : ""
  };

  if (!content) {
    return defaultResult;
  }

  // Normalize HTML to text
  const normalized = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n");

  let textContent = normalized.replace(/<[^>]+>/g, " ");

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
  let headerLines = [];

  if (salutationIdx !== -1) {
    headerLines = lines.slice(0, salutationIdx);
  } else {
    // If no salutation found, assume lines up to first long line or paragraph-like line are header
    // But to be safe, let's check if the first 3-4 lines look like metadata
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
  const remainingHeaderLines = [];
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
  const finalDate = parsedDate || defaultResult.date;
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
  const getPunc = (s) => (s && !s.endsWith(",") && !s.endsWith(":") && !s.endsWith(".") ? s + "," : s);

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

// === TESTS ===
const content = `[Date]

Hiring Manager
Ecolab
Bengaluru East, Karnataka, India

Subject: Application for Software Engineer

Dear Hiring Manager,

As a backend-focused software engineer with a strong foundation in building scalable systems, I am eager to contribute to Ecolab's mission.

I look forward to discussing my background.

Sincerely,
Ritik Singh
ritikbandwal@gmail.com
+91-7499523687
Bengaluru, Karnataka, India`;

const result = parseCoverLetterContent(
  content,
  "Hiring Manager",
  "Ritik Singh",
  "ritikbandwal@gmail.com",
  "+91-7499523687",
  "Bengaluru, Karnataka, India",
  "Ecolab",
  "Bengaluru East, Karnataka, India",
  "Software Engineer"
);

console.log("Parsed result:", JSON.stringify(result, null, 2));
