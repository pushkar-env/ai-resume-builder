/**
 * Deterministically reshapes a resume's sections into profile fields.
 *
 * This is the inverse of the profile -> resume mapping used when creating a
 * "Personalized Profile" resume (see routes/resumes.ts). Resume section content
 * is already structured, so no AI is needed — we just normalise shapes back into
 * the flatter profile model that the profile form / userProfilesTable expect.
 */

type SectionRow = {
  type: string;
  content: unknown;
};

export interface ExtractedProfile {
  name: string;
  email: string;
  phone: string;
  photo: string;
  jobTitle: string;
  location: string;
  socials: { label: string; url: string }[];
  aboutMe: string;
  yearsOfExperience: number | null;
  experience: {
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    location: string;
    description: string;
    bullets: string[];
    currentlyWorking: boolean;
  }[];
  skills: string[];
  projects: {
    name: string;
    description: string;
    technologiesUsed: string;
    url: string;
    github: string;
    bullets: string[];
  }[];
  certifications: {
    name: string;
    issuer: string;
    date: string;
    credentialUrl: string;
  }[];
  education: {
    school: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    gpa: string;
    gpaMode: string;
  }[];
}

const str = (v: unknown): string => (v == null ? "" : String(v)).trim();

/** Strip HTML tags + decode the handful of entities our editors emit. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resume descriptions can be plain text, newline-delimited, or rich HTML lists
 * (`<ul><li>…</li></ul>`). Normalise any of those into a clean bullet array.
 */
function descriptionToBullets(raw: unknown): string[] {
  const s = str(raw);
  if (!s) return [];

  if (/<li[\s>]/i.test(s)) {
    const items = [...s.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => stripHtml(m[1]))
      .filter(Boolean);
    if (items.length > 0) return items;
  }

  const cleaned = /<[a-z][\s\S]*>/i.test(s) ? stripHtml(s) : s;
  return cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•\-*\s]+/, "").trim())
    .filter(Boolean);
}

/** Pull a bullet array out of a section item, falling back to its description. */
function itemBullets(item: Record<string, unknown>): string[] {
  if (Array.isArray(item.bullets)) {
    const bullets = item.bullets.map(str).filter(Boolean);
    if (bullets.length > 0) return bullets;
  }
  return descriptionToBullets(item.description);
}

function asItems(content: unknown): Record<string, unknown>[] {
  if (!content || typeof content !== "object") return [];
  const items = (content as { items?: unknown }).items;
  return Array.isArray(items)
    ? items.filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    : [];
}

export function extractProfileFromResumeSections(
  sections: SectionRow[],
): ExtractedProfile {
  const byType = (type: string) => sections.find((s) => s.type === type);
  const contentOf = (type: string): Record<string, unknown> => {
    const c = byType(type)?.content;
    return c && typeof c === "object" ? (c as Record<string, unknown>) : {};
  };

  const personal = contentOf("personal");
  const summary = contentOf("summary");

  // --- Socials: prefer the structured array, fold in any legacy flat keys. ---
  const socialMap = new Map<string, string>();
  const pushSocial = (label: unknown, url: unknown) => {
    const l = str(label);
    const u = str(url);
    if (l && u) socialMap.set(l.toLowerCase(), u);
  };
  if (Array.isArray(personal.socials)) {
    for (const s of personal.socials as { label?: string; url?: string }[]) {
      pushSocial(s?.label, s?.url);
    }
  }
  // Legacy flat fields some templates still seed.
  pushSocial("Website", personal.website);
  pushSocial("GitHub", personal.github);
  pushSocial("LinkedIn", personal.linkedin);
  pushSocial("Twitter", personal.twitter);

  const labelCase = (k: string): string => {
    const map: Record<string, string> = {
      github: "GitHub",
      linkedin: "LinkedIn",
      twitter: "Twitter",
      leetcode: "LeetCode",
      portfolio: "Portfolio",
      website: "Website",
    };
    return map[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
  };
  const socials = [...socialMap.entries()].map(([label, url]) => ({
    label: labelCase(label),
    url,
  }));

  // --- Experience ---
  const experience = asItems(contentOf("experience")).map((item) => {
    const bullets = itemBullets(item);
    const endDate = str(item.endDate);
    return {
      company: str(item.company),
      title: str(item.title),
      startDate: str(item.startDate),
      endDate,
      location: str(item.location),
      description: bullets.join("\n"),
      bullets,
      currentlyWorking: /^present$/i.test(endDate) || item.currentlyWorking === true,
    };
  });

  // --- Skills: items may be {name, level} objects or bare strings. ---
  const skills = asItems(contentOf("skills"))
    .map((item) => str(item.name))
    .filter(Boolean);
  // Some skills sections store a plain string array under items.
  const rawSkillItems = (contentOf("skills").items as unknown[]) ?? [];
  if (skills.length === 0 && Array.isArray(rawSkillItems)) {
    for (const s of rawSkillItems) {
      const v = str(s);
      if (v) skills.push(v);
    }
  }

  // --- Projects ---
  const projects = asItems(contentOf("projects")).map((item) => {
    const bullets = itemBullets(item);
    return {
      name: str(item.name),
      description: bullets.join("\n"),
      technologiesUsed: str(item.technologiesUsed),
      url: str(item.url) || str(item.github),
      github: str(item.github),
      bullets,
    };
  });

  // --- Certifications ---
  const certifications = asItems(contentOf("certifications")).map((item) => ({
    name: str(item.name),
    issuer: str(item.issuer),
    date: str(item.date),
    credentialUrl: str(item.credentialUrl),
  }));

  // --- Education ---
  const education = asItems(contentOf("education")).map((item) => {
    const gpaMode = str(item.gpaMode).toLowerCase() === "percentage" ? "percentage" : "gpa";
    return {
      school: str(item.school),
      degree: str(item.degree),
      field: str(item.field),
      startDate: str(item.startDate),
      endDate: str(item.endDate),
      gpa: str(item.gpa),
      gpaMode,
    };
  });

  return {
    name: str(personal.name),
    email: str(personal.email),
    phone: str(personal.phone),
    photo: str(personal.photo),
    jobTitle: str(personal.jobTitle) || str(personal.title),
    location: str(personal.location),
    socials,
    aboutMe: str(summary.text),
    yearsOfExperience: null,
    experience,
    skills,
    projects,
    certifications,
    education,
  };
}
