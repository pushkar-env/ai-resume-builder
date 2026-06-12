import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, resumesTable, resumeSectionsTable, userProfilesTable } from "@workspace/db";
import {
  CreateResumeBody,
  UpdateResumeBody,
  GetResumeParams,
  UpdateResumeParams,
  DeleteResumeParams,
  DuplicateResumeParams,
  ExportResumeParams,
  ExportResumeBody,
  GetAtsScoreParams,
  GetAtsScoreQueryParams,
  OptimizeResumeParams,
  OptimizeResumeBody,
  OptimizeResumeResponse,
  ListResumesResponse,
  GetResumeResponse,
  UpdateResumeResponse,
  ExportResumeResponse,
  GetAtsScoreResponse,
} from "@workspace/api-zod";
import { getAuth, clerkClient } from "@clerk/express";
import { logger } from "../lib/logger";
import multer from "multer";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import {
  clipAiInput,
  completeResumeAiJson,
} from "../lib/resume-ai-chat";
import { sendAiRouteError } from "../lib/ai-route-error";
import { formatSectionsForAiAnalysis } from "../lib/resume-ai-serialize";
import { optimizeResumeWithAi, rephraseJobTitle } from "../lib/optimize-resume-ai";
import { renderResumePdf } from "../lib/pdf-renderer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const toJSON = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function normalizeUrl(url: unknown): string {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

function normalizeSocialUrl(url: string, platform: string): string {
  let u = url.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("@")) u = u.slice(1);

  const plat = platform.toLowerCase();
  if (plat === "github" && !u.toLowerCase().includes("github.com")) {
    u = `github.com/${u}`;
  } else if (plat === "linkedin" && !u.toLowerCase().includes("linkedin.com")) {
    u = `linkedin.com/in/${u}`;
  } else if (
    (plat === "twitter" || plat === "x") &&
    !u.toLowerCase().includes("twitter.com") &&
    !u.toLowerCase().includes("x.com")
  ) {
    u = `x.com/${u}`;
  } else if (plat === "leetcode" && !u.toLowerCase().includes("leetcode.com")) {
    u = `leetcode.com/${u}`;
  } else if (plat === "behance" && !u.toLowerCase().includes("behance.net")) {
    u = `behance.net/${u}`;
  } else if (plat === "dribbble" && !u.toLowerCase().includes("dribbble.com")) {
    u = `dribbble.com/${u}`;
  }
  return `https://${u}`;
}

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: any): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}

// Pre-filled starter data so a new resume is immediately viewable in any template.
// Users can edit fields or remove items they don't need.
const SEEDED_SECTIONS = [
  {
    type: "personal",
    title: "Personal Details",
    displayOrder: 0,
    content: {
      name: "Alex Morgan",
      jobTitle: "Senior Software Engineer",
      title: "Senior Software Engineer",
      email: "alex.morgan@example.com",
      phone: "+1 (555) 123-4567",
      location: "San Francisco, CA",
      website: "alexmorgan.dev",
      github: "github.com/alexm",
      linkedin: "linkedin.com/in/alexm",
      twitter: "",
      photo: "",
      nationality: "American",
      dateOfBirth: "1991-04-12",
      languages: "English, Spanish",
    },
  },
  {
    type: "summary",
    title: "Professional Summary",
    displayOrder: 1,
    content: {
      text: "Senior engineer with 8+ years building scalable distributed systems. Led teams of 10+ at high-growth startups and Fortune 500 companies. Passionate about elegant code, mentorship, and shipping products that delight users.",
    },
  },
  {
    type: "experience",
    title: "Work Experience",
    displayOrder: 2,
    content: {
      items: [
        {
          title: "Staff Engineer",
          company: "Stripe",
          location: "San Francisco, CA",
          startDate: "2022",
          endDate: "Present",
          bullets: [
            "Led migration of payments infrastructure to Kubernetes serving 100B+ requests/year",
            "Mentored 8 engineers and grew team velocity 3x through pairing program",
            "Designed event-driven architecture reducing P99 latency by 65%",
          ],
        },
        {
          title: "Senior Engineer",
          company: "Airbnb",
          location: "San Francisco, CA",
          startDate: "2019",
          endDate: "2022",
          bullets: [
            "Built core booking platform handling $50B+ annual transactions",
            "Reduced page load time by 40% through React performance optimization",
          ],
        },
        {
          title: "Software Engineer",
          company: "Uber",
          location: "San Francisco, CA",
          startDate: "2017",
          endDate: "2019",
          bullets: [
            "Developed real-time pricing algorithms for ride matching service",
          ],
        },
      ],
    },
  },
  {
    type: "education",
    title: "Education",
    displayOrder: 3,
    content: {
      items: [
        {
          school: "Stanford University",
          degree: "M.S.",
          field: "Computer Science",
          startDate: "2015",
          endDate: "2017",
          gpa: "9.8",
        },
        {
          school: "UC Berkeley",
          degree: "B.S.",
          field: "Computer Science",
          startDate: "2011",
          endDate: "2015",
          gpa: "8.5",
        },
      ],
    },
  },
  {
    type: "skills",
    title: "Skills",
    displayOrder: 4,
    content: {
      items: [
        { name: "TypeScript", level: 95 },
        { name: "Python", level: 90 },
        { name: "React", level: 95 },
        { name: "Node.js", level: 90 },
        { name: "Go", level: 80 },
        { name: "AWS", level: 85 },
        { name: "Kubernetes", level: 85 },
        { name: "PostgreSQL", level: 90 },
      ],
    },
  },
  {
    type: "projects",
    title: "Projects",
    displayOrder: 5,
    content: {
      items: [
        {
          name: "OpenSource SDK",
          description: "TypeScript SDK with 50k+ monthly downloads",
          url: "github.com/alex/sdk",
        },
        {
          name: "ML Trading Bot",
          description: "Reinforcement learning algorithmic trading platform",
          url: "",
        },
      ],
    },
  },
  {
    type: "certifications",
    title: "Certifications",
    displayOrder: 6,
    content: {
      items: [
        {
          name: "AWS Solutions Architect",
          issuer: "Amazon Web Services",
          date: "2023",
          credentialUrl: "",
        },
        {
          name: "Kubernetes CKA",
          issuer: "CNCF",
          date: "2022",
          credentialUrl: "",
        },
      ],
    },
  },
];

/** Same section titles/order/types as SEEDED_SECTIONS — empty content for blank-start resumes. */
const EMPTY_SECTIONS = [
  {
    type: "personal",
    title: "Personal Details",
    displayOrder: 0,
    content: {
      name: "",
      jobTitle: "",
      title: "",
      email: "",
      phone: "",
      location: "",
      photo: "",
      socials: [],
    },
  },
  {
    type: "summary",
    title: "Professional Summary",
    displayOrder: 1,
    content: { text: "" },
  },
  {
    type: "experience",
    title: "Work Experience",
    displayOrder: 2,
    content: { items: [] },
  },
  {
    type: "education",
    title: "Education",
    displayOrder: 3,
    content: { items: [] },
  },
  { type: "skills", title: "Skills", displayOrder: 4, content: { items: [] } },
  {
    type: "projects",
    title: "Projects",
    displayOrder: 5,
    content: { items: [] },
  },
  {
    type: "certifications",
    title: "Certifications",
    displayOrder: 6,
    content: { items: [] },
  },
];

router.get(
  "/resumes",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const resumes = await db
      .select()
      .from(resumesTable)
      .where(eq(resumesTable.userId, userId))
      .orderBy(desc(resumesTable.updatedAt));
    res.json(ListResumesResponse.parse(toJSON(resumes)));
  },
);

router.post(
  "/resumes",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const parsed = CreateResumeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const defaultColors: Record<string, string> = {
      "silicon-valley": "#000000",
      faang: "#000000",
      nova: "#64748b",
      "executive-pro": "#92400e",
      "creative-pro": "#0d9488",
      midnight: "#d4a853",
      "ats-clean": "#1f2937",
      academic: "#1e40af",
      "corporate-navy": "#1e3a5f",
      compact: "#000000",
      european: "#000000",
      "two-column": "#0d9488",
    };
    const defaultFonts: Record<string, string> = {
      "silicon-valley": "Merriweather, serif",
      faang: "Manrope, sans-serif",
      nova: "Poppins, sans-serif",
      "executive-pro": "Merriweather, serif",
      "creative-pro": "Poppins, sans-serif",
      midnight: "Manrope, sans-serif",
      "ats-clean": "Merriweather, serif",
      academic: "Merriweather, serif",
      "corporate-navy": "Inter, sans-serif",
      compact: "Merriweather, serif",
      european: "Inter, sans-serif",
      "two-column": "Manrope, sans-serif",
    };
    const defaultColor = defaultColors[parsed.data.templateId] ?? "#000000";
    const defaultFont =
      defaultFonts[parsed.data.templateId] ?? "Inter, sans-serif";

    const [resume] = await db
      .insert(resumesTable)
      .values({
        userId,
        title: parsed.data.title,
        templateId: parsed.data.templateId,
        accentColor: parsed.data.accentColor ?? defaultColor,
        fontFamily: parsed.data.fontFamily ?? defaultFont,
        fontColor: parsed.data.fontColor ?? "#111827",
        backgroundColor: parsed.data.backgroundColor ?? "#ffffff",
      })
      .returning();

    const startPrefilled = parsed.data.startPrefilled !== false;
    const prefillType = (parsed.data as any).prefillType ?? (startPrefilled ? "starter" : "empty");

    let sectionBlueprint: any[] = SEEDED_SECTIONS;
    if (prefillType === "empty") {
      sectionBlueprint = EMPTY_SECTIONS;
    } else if (prefillType === "personal") {
      const [profile] = await db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, userId));

      let personalContent = {
        name: "",
        jobTitle: "",
        title: "",
        email: "",
        phone: "",
        location: "",
        photo: "",
        socials: [] as any[],
        website: "",
        nationality: "",
        dateOfBirth: "",
        languages: "",
      };

      if (profile) {
        personalContent = {
          ...personalContent,
          name: profile.name || "",
          jobTitle: profile.jobTitle || "",
          title: profile.jobTitle || "",
          email: profile.email || "",
          phone: profile.phone || "",
          location: profile.location || "",
          photo: profile.photo || "",
          socials: (profile.socials as any[]) || [],
          website: profile.socials?.find(s => s.label.toLowerCase() === "portfolio" || s.label.toLowerCase() === "website")?.url || ""
        };
      } else {
        try {
          const clerkUser = await clerkClient.users.getUser(userId);
          personalContent.name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();
          personalContent.email = clerkUser.emailAddresses[0]?.emailAddress || "";
          personalContent.phone = clerkUser.phoneNumbers[0]?.phoneNumber || "";
          personalContent.photo = clerkUser.imageUrl || "";
        } catch (err) {
          logger.error({ err }, "Failed to fetch Clerk user fallback for personal prefill");
        }
      }

      sectionBlueprint = SEEDED_SECTIONS.map((s) => {
        if (s.type === "personal") {
          return {
            ...s,
            content: personalContent,
          };
        }
        if (profile) {
          if (s.type === "summary") {
            return {
              ...s,
              content: { text: profile.aboutMe || "" },
            };
          }
          if (s.type === "experience") {
            const mappedExperience = (profile.experience || []).map((exp: any) => {
              let bullets = Array.isArray(exp.bullets) ? exp.bullets : [];
              if (bullets.length === 0 && exp.description) {
                bullets = (exp.description || "")
                  .split(/\r?\n/)
                  .map((line: string) => line.replace(/^[•\-\*\s]+/, "").trim())
                  .filter(Boolean);
              }
              return {
                title: exp.title || "",
                company: exp.company || "",
                location: exp.location || "",
                startDate: exp.startDate || "",
                endDate: exp.endDate || "",
                bullets: bullets.length > 0 ? bullets : [exp.description || ""],
              };
            });
            return {
              ...s,
              content: { items: mappedExperience },
            };
          }
          if (s.type === "skills") {
            const mappedSkills = (profile.skills || []).map((skillName: string) => ({
              name: skillName,
              level: 90,
            }));
            return {
              ...s,
              content: { items: mappedSkills },
            };
          }
          if (s.type === "projects") {
            const mappedProjects = (profile.projects || []).map((proj: any) => {
              let description = proj.description || "";
              if (Array.isArray(proj.bullets) && proj.bullets.length > 0) {
                description = "<ul>" + proj.bullets.map((b: string) => `<li>${b}</li>`).join("") + "</ul>";
              }
              return {
                name: proj.name || "",
                description: description,
                url: proj.url || proj.github || "",
              };
            });
            return {
              ...s,
              content: { items: mappedProjects },
            };
          }
          if (s.type === "certifications") {
            const mappedCertifications = (profile.certifications || []).map((cert: any) => ({
              name: cert.name || "",
              issuer: cert.issuer || "",
              date: cert.date || "",
              credentialUrl: cert.credentialUrl || "",
            }));
            return {
              ...s,
              content: { items: mappedCertifications },
            };
          }
        }
        return s;
      });
    }

    const sectionsToInsert = sectionBlueprint.map((s) => ({
      ...s,
      resumeId: resume.id,
    }));
    const sections = await db
      .insert(resumeSectionsTable)
      .values(sectionsToInsert)
      .returning();

    res.status(201).json(toJSON({ ...resume, sections }));
  },
);

router.post(
  "/resumes/import",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    try {
      let extractedText = "";

      if (
        file.mimetype === "application/pdf" ||
        file.originalname.toLowerCase().endsWith(".pdf")
      ) {
        const parser = new PDFParse({ data: file.buffer });
        const pdfData = await parser.getText();
        extractedText = pdfData.text;
      } else if (
        file.mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.originalname.toLowerCase().endsWith(".docx")
      ) {
        const docxData = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = docxData.value;
      } else {
        res
          .status(400)
          .json({
            error: "Unsupported file type. Please upload a PDF or DOCX file.",
          });
        return;
      }

      if (!extractedText || extractedText.trim().length === 0) {
        res
          .status(400)
          .json({ error: "Could not extract text from the file." });
        return;
      }

      const prompt = `Parse this resume text into structured JSON.

Rules:
- socials: LinkedIn, GitHub, Portfolio, etc. as {label, url} with PascalCase labels
- education gpa: numeric only; gpaMode "gpa" or "percentage"
- dates: "Mon YYYY" or "YYYY"; current roles end with "Present"

Return JSON:
{"title":"","personal":{"name":"","jobTitle":"","email":"","phone":"","location":"","website":"","socials":[{"label":"","url":""}]},"summary":{"text":""},"experience":[{"title":"","company":"","location":"","startDate":"","endDate":"","bullets":[""]}],"education":[{"school":"","degree":"","field":"","startDate":"","endDate":"","gpa":"","gpaMode":"gpa"}],"skills":[{"name":"","level":90}],"projects":[{"name":"","description":"","url":""}],"certifications":[{"name":"","issuer":"","date":"","credentialUrl":""}]}

Resume text:
"""${clipAiInput(extractedText, 12_000)}"""`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsedData: any;
      try {
        parsedData = await completeResumeAiJson<any>(
          prompt,
          "import-resume",
          "import",
        );
      } catch (e: any) {
        logger.error({ error: e }, "Failed to parse AI output for resume import");
        sendAiRouteError(res, e);
        return;
      }

      // Default template configuration
      const templateId = "ats-clean";
      const accentColor = "#1f2937";
      const defaultFonts: Record<string, string> = {
        "silicon-valley": "Merriweather, serif",
        faang: "Manrope, sans-serif",
        nova: "Poppins, sans-serif",
        "executive-pro": "Merriweather, serif",
        "creative-pro": "Poppins, sans-serif",
        midnight: "Manrope, sans-serif",
        "ats-clean": "Merriweather, serif",
        academic: "Merriweather, serif",
        "corporate-navy": "Inter, sans-serif",
        compact: "Merriweather, serif",
        european: "Inter, sans-serif",
        "two-column": "Manrope, sans-serif",
      };
      const defaultFont = defaultFonts[templateId] ?? "Inter, sans-serif";
      const title =
        parsedData.title ||
        file.originalname.replace(/\.[^/.]+$/, "") ||
        "Imported Resume";

      const [resume] = await db
        .insert(resumesTable)
        .values({
          userId,
          title,
          templateId,
          accentColor,
          fontFamily: defaultFont,
          fontColor: "#111827",
          backgroundColor: "#ffffff",
        })
        .returning();

      const personalContent = { ...(parsedData.personal || {}) };
      const rawSocials = Array.isArray(personalContent.socials)
        ? personalContent.socials
        : [];
      const socialMap = new Map<string, string>();

      // Support old schema keys if LLM output still uses them
      if (personalContent.github) {
        const normalized = normalizeSocialUrl(personalContent.github, "github");
        if (normalized) socialMap.set("github", normalized);
        delete personalContent.github;
      }
      if (personalContent.linkedin) {
        const normalized = normalizeSocialUrl(
          personalContent.linkedin,
          "linkedin",
        );
        if (normalized) socialMap.set("linkedin", normalized);
        delete personalContent.linkedin;
      }

      // Merge in socials array
      for (const item of rawSocials) {
        if (item && typeof item === "object") {
          const label = String(item.label || "").trim();
          const url = String(item.url || "").trim();
          if (label && url) {
            const normalized = normalizeSocialUrl(url, label);
            if (normalized) {
              socialMap.set(label.toLowerCase(), normalized);
            }
          }
        }
      }

      // Format platform names nicely
      const socials: { label: string; url: string }[] = [];
      const formatLabel = (lbl: string): string => {
        const mapping: Record<string, string> = {
          github: "GitHub",
          linkedin: "LinkedIn",
          twitter: "Twitter",
          x: "Twitter",
          leetcode: "LeetCode",
          behance: "Behance",
          dribbble: "Dribbble",
          portfolio: "Portfolio",
          website: "Website",
        };
        const mapped = mapping[lbl.toLowerCase()];
        if (mapped) return mapped;

        const cleaned = lbl.trim();
        if (!cleaned) return "";
        return cleaned
          .split(/[\s_-]+/)
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join("");
      };

      socialMap.forEach((url, labelKey) => {
        socials.push({ label: formatLabel(labelKey), url });
      });

      personalContent.socials = socials;

      // Clean up Experience
      const parsedExp = Array.isArray(parsedData.experience)
        ? parsedData.experience
        : [];
      const experienceItems = parsedExp.map((expItem: any) => {
        const item = { ...expItem };
        if (item.startDate) item.startDate = String(item.startDate).trim();
        if (item.endDate) item.endDate = String(item.endDate).trim();
        if (!Array.isArray(item.bullets)) {
          item.bullets = typeof item.bullets === "string" ? [item.bullets] : [];
        } else {
          item.bullets = item.bullets
            .map((b: any) => String(b || "").trim())
            .filter(Boolean);
        }
        return item;
      });

      // Clean up Education
      const parsedEdu = Array.isArray(parsedData.education)
        ? parsedData.education
        : [];
      const educationItems = parsedEdu.map((eduItem: any) => {
        const item = { ...eduItem };
        let gpaMode = "gpa";
        if (
          typeof eduItem.gpaMode === "string" &&
          eduItem.gpaMode.toLowerCase() === "percentage"
        ) {
          gpaMode = "percentage";
        } else if (eduItem.gpa && String(eduItem.gpa).includes("%")) {
          gpaMode = "percentage";
        }

        if (item.gpa) {
          let g = String(item.gpa).trim();
          if (g.includes("%")) {
            g = g.replace("%", "").trim();
          }
          const slashIndex = g.indexOf("/");
          if (slashIndex !== -1) {
            g = g.substring(0, slashIndex).trim();
          }
          const numMatch = g.match(/\d+(\.\d+)?/);
          if (numMatch) {
            g = numMatch[0];
          }
          const numVal = parseFloat(g);
          if (!isNaN(numVal) && numVal > 10.0) {
            gpaMode = "percentage";
          }
          item.gpa = g;
        }
        item.gpaMode = gpaMode;
        if (item.startDate) item.startDate = String(item.startDate).trim();
        if (item.endDate) item.endDate = String(item.endDate).trim();
        return item;
      });

      // Clean up Projects & Certifications
      const parsedProjects = Array.isArray(parsedData.projects)
        ? parsedData.projects
        : [];
      const projectItems = parsedProjects.map((pItem: any) => {
        const item = { ...pItem };
        if (item.url) item.url = normalizeUrl(item.url);
        return item;
      });

      const parsedCerts = Array.isArray(parsedData.certifications)
        ? parsedData.certifications
        : [];
      const certItems = parsedCerts.map((cItem: any) => {
        const item = { ...cItem };
        if (item.credentialUrl)
          item.credentialUrl = normalizeUrl(item.credentialUrl);
        return item;
      });

      // Map to sections
      const sectionsToInsert = [
        {
          resumeId: resume.id,
          type: "personal",
          title: "Personal Details",
          displayOrder: 0,
          content: personalContent,
        },
        {
          resumeId: resume.id,
          type: "summary",
          title: "Professional Summary",
          displayOrder: 1,
          content: parsedData.summary || { text: "" },
        },
        {
          resumeId: resume.id,
          type: "experience",
          title: "Work Experience",
          displayOrder: 2,
          content: { items: experienceItems },
        },
        {
          resumeId: resume.id,
          type: "education",
          title: "Education",
          displayOrder: 3,
          content: { items: educationItems },
        },
        {
          resumeId: resume.id,
          type: "skills",
          title: "Skills",
          displayOrder: 4,
          content: { style: "bullets", items: parsedData.skills || [] },
        },
        {
          resumeId: resume.id,
          type: "projects",
          title: "Projects",
          displayOrder: 5,
          content: { items: projectItems },
        },
        {
          resumeId: resume.id,
          type: "certifications",
          title: "Certifications",
          displayOrder: 6,
          content: { items: certItems },
        },
      ];

      const sections = await db
        .insert(resumeSectionsTable)
        .values(sectionsToInsert)
        .returning();

      res.status(201).json(toJSON({ ...resume, sections }));
    } catch (error: any) {
      const message = error?.message || String(error);
      const isTimeout = /timed out/i.test(message);
      logger.error({ error: message }, "Error importing resume");
      res.status(isTimeout ? 504 : 500).json({
        error: isTimeout
          ? "Import timed out while parsing your resume. Please try again."
          : "An error occurred while importing the resume.",
      });
    }
  },
);

router.get(
  "/resumes/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const params = GetResumeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [resume] = await db
      .select()
      .from(resumesTable)
      .where(
        and(
          eq(resumesTable.id, params.data.id),
          eq(resumesTable.userId, userId),
        ),
      );

    if (!resume) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    const sections = await db
      .select()
      .from(resumeSectionsTable)
      .where(eq(resumeSectionsTable.resumeId, resume.id))
      .orderBy(resumeSectionsTable.displayOrder);

    res.json(GetResumeResponse.parse(toJSON({ ...resume, sections })));
  },
);

router.patch(
  "/resumes/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const params = UpdateResumeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateResumeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(resumesTable)
      .where(
        and(
          eq(resumesTable.id, params.data.id),
          eq(resumesTable.userId, userId),
        ),
      );

    if (!existing) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    const { sections, ...resumeFields } = parsed.data;

    const updateData: Partial<typeof resumesTable.$inferInsert> = {};
    if (resumeFields.title != null) updateData.title = resumeFields.title;
    if (resumeFields.templateId != null)
      updateData.templateId = resumeFields.templateId;
    if (resumeFields.accentColor != null)
      updateData.accentColor = resumeFields.accentColor;
    if (resumeFields.fontFamily != null)
      updateData.fontFamily = resumeFields.fontFamily;
    if (resumeFields.fontColor != null)
      updateData.fontColor = resumeFields.fontColor;
    if (resumeFields.backgroundColor != null)
      updateData.backgroundColor = resumeFields.backgroundColor;
    if (resumeFields.isPublic != null)
      updateData.isPublic = resumeFields.isPublic;
    if (resumeFields.atsScore !== undefined)
      updateData.atsScore = resumeFields.atsScore;
    if (resumeFields.atsPassedChecks !== undefined)
      updateData.atsPassedChecks = resumeFields.atsPassedChecks;
    if (resumeFields.atsFailedChecks !== undefined)
      updateData.atsFailedChecks = resumeFields.atsFailedChecks;
    if (resumeFields.atsFeedback !== undefined)
      updateData.atsFeedback = resumeFields.atsFeedback;
    if (resumeFields.atsUpdatedAt !== undefined)
      updateData.atsUpdatedAt = resumeFields.atsUpdatedAt ? new Date(resumeFields.atsUpdatedAt) : null;
    if (resumeFields.atsJobDescription !== undefined)
      updateData.atsJobDescription = resumeFields.atsJobDescription;

    const hasResumeFieldUpdates = Object.keys(updateData).length > 0;
    const hasSectionPayload = !!(sections && sections.length > 0);

    let updatedResume = existing;
    if (hasResumeFieldUpdates) {
      const [r] = await db
        .update(resumesTable)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(resumesTable.id, params.data.id))
        .returning();
      updatedResume = r;
    } else if (hasSectionPayload) {
      // Section-only PATCH: still bump parent row so list ordering / "last updated" stay correct.
      const [r] = await db
        .update(resumesTable)
        .set({ updatedAt: new Date() })
        .where(eq(resumesTable.id, params.data.id))
        .returning();
      updatedResume = r;
    }

    if (sections && sections.length > 0) {
      for (const section of sections) {
        const sectionUpdate: Partial<typeof resumeSectionsTable.$inferInsert> =
          {};
        if (section.type != null) sectionUpdate.type = section.type;
        if (section.title != null) sectionUpdate.title = section.title;
        if (section.content != null)
          sectionUpdate.content = section.content as Record<string, unknown>;
        if (section.displayOrder != null)
          sectionUpdate.displayOrder = section.displayOrder;
        if (section.isVisible != null)
          sectionUpdate.isVisible = section.isVisible;

        if (Object.keys(sectionUpdate).length > 0) {
          await db
            .update(resumeSectionsTable)
            .set(sectionUpdate)
            .where(
              and(
                eq(resumeSectionsTable.id, section.id),
                eq(resumeSectionsTable.resumeId, params.data.id),
              ),
            );
        }
      }
    }

    const updatedSections = await db
      .select()
      .from(resumeSectionsTable)
      .where(eq(resumeSectionsTable.resumeId, params.data.id))
      .orderBy(resumeSectionsTable.displayOrder);

    res.json(
      UpdateResumeResponse.parse(
        toJSON({ ...updatedResume, sections: updatedSections }),
      ),
    );
  },
);

router.delete(
  "/resumes/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const params = DeleteResumeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(resumesTable)
      .where(
        and(
          eq(resumesTable.id, params.data.id),
          eq(resumesTable.userId, userId),
        ),
      );

    if (!existing) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    await db.delete(resumesTable).where(eq(resumesTable.id, params.data.id));
    res.sendStatus(204);
  },
);

router.post(
  "/resumes/:id/duplicate",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const params = DuplicateResumeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(resumesTable)
      .where(
        and(
          eq(resumesTable.id, params.data.id),
          eq(resumesTable.userId, userId),
        ),
      );

    if (!existing) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    const [duplicate] = await db
      .insert(resumesTable)
      .values({
        userId,
        title: `${existing.title} (Copy)`,
        templateId: existing.templateId,
        accentColor: existing.accentColor,
        fontFamily: existing.fontFamily,
        fontColor: existing.fontColor,
        backgroundColor: existing.backgroundColor,
        isPublic: false,
      })
      .returning();

    const originalSections = await db
      .select()
      .from(resumeSectionsTable)
      .where(eq(resumeSectionsTable.resumeId, existing.id));

    if (originalSections.length > 0) {
      const sectionsToInsert = originalSections.map(
        ({ id, resumeId, createdAt, updatedAt, ...rest }) => ({
          ...rest,
          resumeId: duplicate.id,
        }),
      );
      await db.insert(resumeSectionsTable).values(sectionsToInsert);
    }

    res.status(201).json(toJSON(duplicate));
  },
);

router.post(
  "/resumes/:id/export",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const params = ExportResumeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = ExportResumeBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(resumesTable)
      .where(
        and(
          eq(resumesTable.id, params.data.id),
          eq(resumesTable.userId, userId),
        ),
      );

    if (!existing) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    await db
      .update(resumesTable)
      .set({ downloadCount: sql`${resumesTable.downloadCount} + 1` })
      .where(eq(resumesTable.id, params.data.id));

    const exportUrl = `/api/resumes/${params.data.id}/download?format=${body.data.format}`;
    res.json(
      ExportResumeResponse.parse({ url: exportUrl, format: body.data.format }),
    );
  },
);

router.get(
  "/resumes/:id/ats-score",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const params = GetAtsScoreParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const queryParams = GetAtsScoreQueryParams.safeParse(req.query);
    if (!queryParams.success) {
      res.status(400).json({ error: queryParams.error.message });
      return;
    }
    const jobDescription = queryParams.data.jobDescription;
    const forceScan = queryParams.data.forceScan === true;

    const [resume] = await db
      .select()
      .from(resumesTable)
      .where(
        and(
          eq(resumesTable.id, params.data.id),
          eq(resumesTable.userId, userId),
        ),
      );

    if (!resume) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    const clerkUser = await clerkClient.users.getUser(userId);
    if (clerkUser.publicMetadata?.isPremium !== true) {
      res
        .status(403)
        .json({ error: "ATS score is available for Pro subscribers only." });
      return;
    }

    // Check if we can return the persisted score instantly
    const hasJobDescription = jobDescription && jobDescription.trim().length > 0;
    const dbJobDescription = resume.atsJobDescription;
    const isJobDescriptionMatch = 
      (!hasJobDescription && !dbJobDescription) ||
      (hasJobDescription && dbJobDescription && jobDescription.trim() === dbJobDescription.trim());

    if (!forceScan && resume.atsScore !== null && isJobDescriptionMatch) {
      res.json(
        GetAtsScoreResponse.parse({
          score: resume.atsScore,
          maxScore: 100,
          feedback: resume.atsFeedback || [],
          passedChecks: resume.atsPassedChecks || [],
          failedChecks: resume.atsFailedChecks || [],
          atsUpdatedAt: resume.atsUpdatedAt,
        }),
      );
      return;
    }

    const sections = await db
      .select()
      .from(resumeSectionsTable)
      .where(eq(resumeSectionsTable.resumeId, resume.id));

    let score = 70;
    let passedChecks: string[] = [];
    let failedChecks: string[] = [];
    let feedback: string[] = [];

    const fallbackScoreCalc = () => {
      passedChecks = [];
      failedChecks = [];
      feedback = [];

      const personalSection = sections.find((s) => s.type === "personal");
      const personalContent = personalSection?.content as any;
      if (personalContent?.email) passedChecks.push("Contact email present");
      else failedChecks.push("Missing contact email");

      if (personalContent?.phone) passedChecks.push("Phone number present");
      else failedChecks.push("Missing phone number");

      const summarySection = sections.find((s) => s.type === "summary");
      const summaryContent = summarySection?.content as any;
      if (summaryContent?.text && summaryContent.text.length > 50) {
        passedChecks.push("Professional summary present");
      } else {
        failedChecks.push("Missing or too short professional summary");
        feedback.push(
          "Add a compelling professional summary of at least 3-4 sentences",
        );
      }

      const expSection = sections.find((s) => s.type === "experience");
      const expContent = expSection?.content as any;
      if (expContent?.items && expContent.items.length > 0) {
        passedChecks.push("Work experience included");
        const hasQuantified = expContent.items.some((item: any) =>
          item.bullets?.some((b: string) => /\d/.test(b)),
        );
        if (hasQuantified) passedChecks.push("Quantified achievements present");
        else {
          failedChecks.push("No quantified achievements");
          feedback.push(
            "Add numbers and metrics to your bullet points (e.g., 'Increased sales by 30%')",
          );
        }
      } else {
        failedChecks.push("Missing work experience");
      }

      const skillsSection = sections.find((s) => s.type === "skills");
      const skillsContent = skillsSection?.content as any;
      if (skillsContent?.items && skillsContent.items.length >= 5) {
        passedChecks.push("Adequate skills listed");
      } else {
        failedChecks.push("Too few skills listed");
        feedback.push(
          "List at least 5-10 relevant skills for better ATS matching",
        );
      }

      if (resume.title && resume.title.length > 2)
        passedChecks.push("Resume has a title");

      score = Math.round(
        (passedChecks.length / (passedChecks.length + failedChecks.length)) * 100,
      );
    };

    const personalSection = sections.find((s) => s.type === "personal");
    const personalContent = personalSection?.content as any;
    const skillsSection = sections.find((s) => s.type === "skills");
    const skillsContent = skillsSection?.content as any;

    const targetJobTitle = personalContent?.jobTitle || resume.title || "Professional";
    const skillsList = Array.isArray(skillsContent?.items)
      ? skillsContent.items.map((i: any) => i.name || i).join(", ")
      : "";

    const resumeText = formatSectionsForAiAnalysis(sections);
    const jdBlock =
      jobDescription && jobDescription.trim().length > 0
        ? `\nJob description:\n"""${clipAiInput(jobDescription, 3_500)}"""`
        : "";

    const prompt = `You are an ATS auditor. Score this resume for target role "${targetJobTitle}".
Skills on resume: ${skillsList || "none"}${jdBlock}

Resume:
"""
${resumeText}
"""

Return JSON: {"score":75,"passedChecks":["..."],"failedChecks":["..."],"feedback":["..."]}
- score: integer 0-100
- passedChecks, failedChecks, feedback: 3-5 specific strings each`;

    let parsedResult: {
      score?: number | string;
      passedChecks?: unknown[];
      failedChecks?: unknown[];
      feedback?: unknown[];
    } | null = null;
    try {
      parsedResult = await completeResumeAiJson(
        prompt,
        "ats-score-ai",
        "ats-score",
      );
    } catch (err: any) {
      logger.error({ error: err }, "AI ATS scoring failed, using rule-based fallback");
    }

    const now = new Date();

    let scoreVal: number | null = null;
    if (parsedResult) {
      if (typeof parsedResult.score === "number") {
        scoreVal = parsedResult.score;
      } else if (typeof parsedResult.score === "string") {
        const parsed = parseInt(parsedResult.score, 10);
        if (!isNaN(parsed)) {
          scoreVal = parsed;
        }
      }
    }

    if (parsedResult && scoreVal !== null) {
      scoreVal = Math.max(0, Math.min(100, Math.round(scoreVal)));
      const passedVal = Array.isArray(parsedResult.passedChecks)
        ? parsedResult.passedChecks.map(String)
        : [];
      const failedVal = Array.isArray(parsedResult.failedChecks)
        ? parsedResult.failedChecks.map(String)
        : [];
      const feedbackVal = Array.isArray(parsedResult.feedback)
        ? parsedResult.feedback.map(String)
        : [];

      await db
        .update(resumesTable)
        .set({
          atsScore: scoreVal,
          atsPassedChecks: passedVal,
          atsFailedChecks: failedVal,
          atsFeedback: feedbackVal,
          atsUpdatedAt: now,
          atsJobDescription: jobDescription && jobDescription.trim().length > 0 ? jobDescription.trim() : null,
        })
        .where(eq(resumesTable.id, resume.id));

      res.json(
        GetAtsScoreResponse.parse({
          score: scoreVal,
          maxScore: 100,
          feedback: feedbackVal,
          passedChecks: passedVal,
          failedChecks: failedVal,
          atsUpdatedAt: now,
        }),
      );
    } else {
      // Fallback
      fallbackScoreCalc();

      await db
        .update(resumesTable)
        .set({
          atsScore: score,
          atsPassedChecks: passedChecks,
          atsFailedChecks: failedChecks,
          atsFeedback: feedback,
          atsUpdatedAt: now,
          atsJobDescription: jobDescription && jobDescription.trim().length > 0 ? jobDescription.trim() : null,
        })
        .where(eq(resumesTable.id, resume.id));

      res.json(
        GetAtsScoreResponse.parse({
          score,
          maxScore: 100,
          feedback,
          passedChecks,
          failedChecks,
          atsUpdatedAt: now,
        }),
      );
    }
  },
);

router.post(
  "/resumes/:id/optimize",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const params = OptimizeResumeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = OptimizeResumeBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [resume] = await db
      .select()
      .from(resumesTable)
      .where(
        and(
          eq(resumesTable.id, params.data.id),
          eq(resumesTable.userId, userId),
        ),
      );

    if (!resume) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    const clerkUser = await clerkClient.users.getUser(userId);
    if (clerkUser.publicMetadata?.isPremium !== true) {
      res
        .status(403)
        .json({ error: "AI optimization is available for Pro subscribers only." });
      return;
    }

    const sections = await db
      .select()
      .from(resumeSectionsTable)
      .where(eq(resumeSectionsTable.resumeId, resume.id));

    const jobDescription = body.data.jobDescription || "";

    // Prepare sections for prompt
    const sectionsToOptimize = sections.filter(
      (s) => s.isVisible && ["summary", "skills", "experience", "projects"].includes(s.type)
    );

    if (sectionsToOptimize.length === 0) {
      res.status(400).json({ error: "No editable sections found to optimize." });
      return;
    }

    let optimizedSections: any[] = [];
    let optimizationSummary = "";
    try {
      const result = await optimizeResumeWithAi(
        sectionsToOptimize,
        jobDescription,
      );
      optimizedSections = result.sections;
      optimizationSummary = result.summary;
    } catch (err: any) {
      logger.error({ error: err }, "AI resume optimization failed");
      sendAiRouteError(res, err);
      return;
    }

    if (!Array.isArray(optimizedSections) || optimizedSections.length === 0) {
      res.status(500).json({ error: "AI optimization returned invalid structure." });
      return;
    }

    // Update database with allowed section restrictions
    const allowedSectionIds = new Set(sectionsToOptimize.map((s) => s.id));

    for (const optSec of optimizedSections) {
      const sectionId = typeof optSec.id === "string" ? parseInt(optSec.id, 10) : optSec.id;
      if (typeof sectionId !== "number" || isNaN(sectionId) || !optSec.content) continue;

      if (!allowedSectionIds.has(sectionId)) {
        logger.warn(
          { sectionId, resumeId: resume.id },
          "AI attempted to modify a section ID not in allowed optimize list"
        );
        continue;
      }

      let sanitizedContent = optSec.content;
      if (optSec.type === "skills") {
        let items: any[] = [];
        let style = "chips";
        
        if (Array.isArray(optSec.content)) {
          items = optSec.content;
        } else if (optSec.content && typeof optSec.content === "object") {
          items = Array.isArray(optSec.content.items) ? optSec.content.items : [];
          style = typeof optSec.content.style === "string" ? optSec.content.style : "chips";
        }
        
        const sanitizedItems = items.map((item: any) => {
          if (typeof item === "string") {
            return { name: item };
          }
          if (item && typeof item === "object") {
            return {
              name: typeof item.name === "string" ? item.name : (item.name ? String(item.name) : ""),
              level: typeof item.level === "number" ? item.level : undefined
            };
          }
          return { name: "" };
        }).filter((item: any) => item.name.trim() !== "");

        sanitizedContent = { style, items: sanitizedItems };
      }
      
      if (optSec.type === "summary") {
        if (typeof optSec.content === "string") {
          sanitizedContent = { text: optSec.content };
        } else if (optSec.content && typeof optSec.content === "object" && typeof optSec.content.text !== "string") {
          sanitizedContent = { text: optSec.content.text ? String(optSec.content.text) : "" };
        }
      }

      await db
        .update(resumeSectionsTable)
        .set({
          content: sanitizedContent,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(resumeSectionsTable.id, sectionId),
            eq(resumeSectionsTable.resumeId, resume.id),
          ),
        );
    }

    // Rephrase target job title if present and detailed/ambiguous
    const personalSection = sections.find((s) => s.type === "personal");
    if (personalSection) {
      const currentJobTitle = (personalSection.content as any)?.jobTitle || "";
      if (currentJobTitle.trim()) {
        try {
          const rephrased = await rephraseJobTitle(currentJobTitle, jobDescription);
          if (rephrased && rephrased.trim() !== currentJobTitle.trim()) {
            const updatedContent = {
              ...(personalSection.content as Record<string, unknown>),
              jobTitle: rephrased.trim(),
            };
            await db
              .update(resumeSectionsTable)
              .set({
                content: updatedContent,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(resumeSectionsTable.id, personalSection.id),
                  eq(resumeSectionsTable.resumeId, resume.id),
                ),
              );
            logger.info(
              { resumeId: resume.id, original: currentJobTitle, rephrased },
              "Rephrased target job title during resume optimization"
            );
          }
        } catch (rephraseErr) {
          logger.error({ error: rephraseErr, resumeId: resume.id }, "Failed to rephrase job title during optimization");
        }
      }
    }

    // Bump resume timestamp and reset saved ATS score since content has changed completely
    const [updatedResume] = await db
      .update(resumesTable)
      .set({
        updatedAt: new Date(),
        atsScore: null,
        atsPassedChecks: null,
        atsFailedChecks: null,
        atsFeedback: null,
        atsUpdatedAt: null,
        atsJobDescription: null,
      })
      .where(eq(resumesTable.id, resume.id))
      .returning();

    const updatedSections = await db
      .select()
      .from(resumeSectionsTable)
      .where(eq(resumeSectionsTable.resumeId, resume.id))
      .orderBy(resumeSectionsTable.displayOrder);

    res.json(
      OptimizeResumeResponse.parse(
        toJSON({
          resume: { ...updatedResume, sections: updatedSections },
          summary: optimizationSummary,
        }),
      ),
    );
  },
);

router.post(
  "/resumes/export-pdf",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { html } = req.body;
    if (!html || typeof html !== "string") {
      res.status(400).json({ error: "No HTML provided" });
      return;
    }

    if (html.length > 15 * 1024 * 1024) {
      res.status(413).json({ error: "Export payload is too large" });
      return;
    }

    try {
      const pdfBuffer = await renderResumePdf(html);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
      res.send(pdfBuffer);
    } catch (error: any) {
      const message = error?.message || String(error);
      const isTimeout = /timed out/i.test(message);
      logger.error({ error: message }, "Error generating PDF");
      res.status(isTimeout ? 504 : 500).json({
        error: isTimeout
          ? "PDF generation timed out. Please try again."
          : "Failed to generate PDF",
        details: message,
      });
    }
  },
);

export default router;
