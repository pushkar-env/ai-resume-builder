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

function parseCoverLetterContent(
  content,
  fallbackRecipient,
  fallbackSender,
  senderEmail,
  senderPhone,
  senderLocation,
  companyName,
  companyLocation
) {
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

  let textContent = normalized.replace(/<[^>]+>/g, " ");

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
  const salutationRegex = /^(dear|to\s+the|hello|hi|attention|re:)\b/i;
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
    const cleanLower = line.toLowerCase();
    
    if (fallbackSender && cleanLower === fallbackSender.toLowerCase()) {
      return false;
    }
    if (parsedSenderName && cleanLower === parsedSenderName.toLowerCase()) {
      return false;
    }
    if (isContactLine(line, senderEmail, senderPhone, senderLocation)) {
      return false;
    }
    
    // Filter out date, recipient, company, location if they appear in paragraphs
    if (cleanLower === "[date]" || /^[A-Za-z]+ \d{1,2}, \d{4}$/.test(line)) {
      return false;
    }
    if (fallbackRecipient && cleanLower === fallbackRecipient.toLowerCase()) {
      return false;
    }
    if (cleanLower === "hiring manager") {
      return false;
    }
    if (companyName && cleanLower === companyName.toLowerCase()) {
      return false;
    }
    if (companyLocation && cleanLower === companyLocation.toLowerCase()) {
      return false;
    }

    if (cleanLower.startsWith("dear ") || cleanLower.startsWith("sincerely") || cleanLower.startsWith("best regards")) {
      return false;
    }
    return true;
  });

  // Apply edited recipient/sender overrides over parsed text values
  if (salutation) {
    const match = salutation.match(/^(dear|hello|hi|to\s+the|attention|re:)\b/i);
    if (match) {
      const greeting = match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase();
      const parsedRecipient = salutation.slice(match[0].length).replace(/,$/, "").trim();
      
      if (!parsedRecipient) {
        salutation = `${greeting} ${fallbackRecipient || "Hiring Manager"}`;
      } else if (
        parsedRecipient.toLowerCase() === "hiring manager" && 
        fallbackRecipient && 
        fallbackRecipient.toLowerCase() !== "hiring manager"
      ) {
        salutation = `${greeting} ${fallbackRecipient}`;
      } else {
        salutation = `${greeting} ${parsedRecipient}`;
      }
    } else {
      const cleanSalutation = salutation.replace(/,$/, "").trim();
      if (
        fallbackRecipient && 
        cleanSalutation.toLowerCase() === "hiring manager" && 
        fallbackRecipient.toLowerCase() !== "hiring manager"
      ) {
        salutation = `Dear ${fallbackRecipient}`;
      } else {
        salutation = `Dear ${cleanSalutation}`;
      }
    }
  } else {
    salutation = `Dear ${fallbackRecipient || "Hiring Manager"}`;
  }

  if (fallbackSender) {
    parsedSenderName = fallbackSender;
  } else if (!parsedSenderName) {
    parsedSenderName = "Your Name";
  }

  if (!signOff) {
    signOff = "Yours Sincerely,";
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

const runTest = (name, content, fallbackRecipient, companyName, companyLocation) => {
  console.log(`=== Test: ${name} ===`);
  const parsed = parseCoverLetterContent(
    content,
    fallbackRecipient,
    "Ritik Singh",
    "ritikbandwal@gmail.com",
    "+91-7499523687",
    "Bengaluru, Karnataka, India",
    companyName,
    companyLocation
  );
  console.log(`Salutation: "${parsed.salutation}"`);
  console.log(`First paragraph: "${parsed.paragraphs[0]}"`);
  console.log();
};

// Case 1: content has "Dear Mr. Smith,", form field is "Hiring Manager"
runTest("Custom Salutation, Generic Form Field", `[Date]

Hiring Manager
Ecolab
Bengaluru East, Karnataka, India

Dear Mr. Smith,

As a backend-focused software engineer...`, "Hiring Manager", "Ecolab", "Bengaluru East, Karnataka, India");

// Case 2: content has "Dear Hiring Manager,", form field is "Jane Doe"
runTest("Generic Salutation, Custom Form Field", `[Date]

Hiring Manager
Ecolab
Bengaluru East, Karnataka, India

Dear Hiring Manager,

As a backend-focused software engineer...`, "Jane Doe", "Ecolab", "Bengaluru East, Karnataka, India");

// Case 3: content has "Dear Hiring Manager,", form field is "Hiring Manager"
runTest("Generic Salutation, Generic Form Field", `[Date]

Hiring Manager
Ecolab
Bengaluru East, Karnataka, India

Dear Hiring Manager,

As a backend-focused software engineer...`, "Hiring Manager", "Ecolab", "Bengaluru East, Karnataka, India");

// Case 4: content has no salutation, form field is "Jane Doe"
runTest("No Salutation in text, Custom Form Field", `[Date]

Hiring Manager
Ecolab
Bengaluru East, Karnataka, India

As a backend-focused software engineer...`, "Jane Doe", "Ecolab", "Bengaluru East, Karnataka, India");
