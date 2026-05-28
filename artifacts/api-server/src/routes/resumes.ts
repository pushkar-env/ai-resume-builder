import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, resumesTable, resumeSectionsTable } from "@workspace/db";
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
import puppeteer from "puppeteer";

import { completeResumeAi } from "../lib/resume-ai-chat";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const toJSON = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

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
    type: "personal", title: "Personal Details", displayOrder: 0,
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
    type: "summary", title: "Professional Summary", displayOrder: 1,
    content: {
      text: "Senior engineer with 8+ years building scalable distributed systems. Led teams of 10+ at high-growth startups and Fortune 500 companies. Passionate about elegant code, mentorship, and shipping products that delight users.",
    },
  },
  {
    type: "experience", title: "Work Experience", displayOrder: 2,
    content: {
      items: [
        {
          title: "Staff Engineer", company: "Stripe", location: "San Francisco, CA",
          startDate: "2022", endDate: "Present",
          bullets: [
            "Led migration of payments infrastructure to Kubernetes serving 100B+ requests/year",
            "Mentored 8 engineers and grew team velocity 3x through pairing program",
            "Designed event-driven architecture reducing P99 latency by 65%",
          ],
        },
        {
          title: "Senior Engineer", company: "Airbnb", location: "San Francisco, CA",
          startDate: "2019", endDate: "2022",
          bullets: [
            "Built core booking platform handling $50B+ annual transactions",
            "Reduced page load time by 40% through React performance optimization",
          ],
        },
        {
          title: "Software Engineer", company: "Uber", location: "San Francisco, CA",
          startDate: "2017", endDate: "2019",
          bullets: ["Developed real-time pricing algorithms for ride matching service"],
        },
      ],
    },
  },
  {
    type: "education", title: "Education", displayOrder: 3,
    content: {
      items: [
        { school: "Stanford University", degree: "M.S.", field: "Computer Science", startDate: "2015", endDate: "2017", gpa: "3.9" },
        { school: "UC Berkeley", degree: "B.S.", field: "Computer Science", startDate: "2011", endDate: "2015", gpa: "3.8" },
      ],
    },
  },
  {
    type: "skills", title: "Skills", displayOrder: 4,
    content: {
      style: "bars",
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
    type: "projects", title: "Projects", displayOrder: 5,
    content: {
      items: [
        { name: "OpenSource SDK", description: "TypeScript SDK with 50k+ monthly downloads", url: "github.com/alex/sdk" },
        { name: "ML Trading Bot", description: "Reinforcement learning algorithmic trading platform", url: "" },
      ],
    },
  },
  {
    type: "certifications", title: "Certifications", displayOrder: 6,
    content: {
      items: [
        { name: "AWS Solutions Architect", issuer: "Amazon Web Services", date: "2023", credentialUrl: "" },
        { name: "Kubernetes CKA", issuer: "CNCF", date: "2022", credentialUrl: "" },
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
  { type: "summary", title: "Professional Summary", displayOrder: 1, content: { text: "" } },
  { type: "experience", title: "Work Experience", displayOrder: 2, content: { items: [] } },
  { type: "education", title: "Education", displayOrder: 3, content: { items: [] } },
  { type: "skills", title: "Skills", displayOrder: 4, content: { style: "bars", items: [] } },
  { type: "projects", title: "Projects", displayOrder: 5, content: { items: [] } },
  { type: "certifications", title: "Certifications", displayOrder: 6, content: { items: [] } },
];

router.get("/resumes", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId;
  const resumes = await db
    .select()
    .from(resumesTable)
    .where(eq(resumesTable.userId, userId))
    .orderBy(desc(resumesTable.updatedAt));
  res.json(ListResumesResponse.parse(toJSON(resumes)));
});

router.post("/resumes", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId;
  const parsed = CreateResumeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

    const defaultColors: Record<string, string> = {
      "silicon-valley": "#6366f1",
      "faang": "#0ea5e9",
      "nova": "#64748b",
      "executive-pro": "#92400e",
      "creative-pro": "#0d9488",
      "midnight": "#d4a853",
      "ats-clean": "#1f2937",
      "academic": "#1e40af",
      "corporate-navy": "#1e3a5f",
      "compact": "#059669",
      "european": "#7c3aed",
      "two-column": "#0d9488",
    };
    const defaultColor = defaultColors[parsed.data.templateId] ?? "#7c3aed";

    const [resume] = await db.insert(resumesTable).values({
    userId,
    title: parsed.data.title,
    templateId: parsed.data.templateId,
    accentColor: parsed.data.accentColor ?? defaultColor,
    fontFamily: parsed.data.fontFamily ?? "Inter, sans-serif",
    fontColor: parsed.data.fontColor ?? "#111827",
    backgroundColor: parsed.data.backgroundColor ?? "#ffffff",
  }).returning();

  const startPrefilled = parsed.data.startPrefilled !== false;
  const sectionBlueprint = startPrefilled ? SEEDED_SECTIONS : EMPTY_SECTIONS;

  const sectionsToInsert = sectionBlueprint.map((s) => ({
    ...s,
    resumeId: resume.id,
  }));
  const sections = await db.insert(resumeSectionsTable).values(sectionsToInsert).returning();

  res.status(201).json(toJSON({ ...resume, sections }));
});

router.post("/resumes/import", requireAuth, upload.single("file"), async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  try {
    let extractedText = "";
    
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      const parser = new PDFParse({ data: file.buffer });
      const pdfData = await parser.getText();
      extractedText = pdfData.text;
    } else if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.toLowerCase().endsWith(".docx")
    ) {
      const docxData = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = docxData.value;
    } else {
      res.status(400).json({ error: "Unsupported file type. Please upload a PDF or DOCX file." });
      return;
    }

    if (!extractedText || extractedText.trim().length === 0) {
      res.status(400).json({ error: "Could not extract text from the file." });
      return;
    }

    // Prepare prompt
    const prompt = `Parse the following resume text into a structured format.
    
    Extract the candidate's personal details, professional summary, work experience, education, skills, projects, and certifications.
    Return ONLY a valid JSON object with the following structure, populated with the extracted information. Use empty strings or empty arrays if information is missing.
    Do NOT wrap the JSON in quotes or code blocks, return ONLY the raw JSON string.

    Structure:
    {
      "title": "A short suitable title for this resume (e.g. Software Engineer)",
      "personal": {
        "name": "", "jobTitle": "", "email": "", "phone": "", "location": "", "website": "", "github": "", "linkedin": ""
      },
      "summary": { "text": "" },
      "experience": [
        { "title": "", "company": "", "location": "", "startDate": "", "endDate": "", "bullets": [""] }
      ],
      "education": [
        { "school": "", "degree": "", "field": "", "startDate": "", "endDate": "", "gpa": "" }
      ],
      "skills": [ { "name": "", "level": 90 } ],
      "projects": [
        { "name": "", "description": "", "url": "" }
      ],
      "certifications": [
        { "name": "", "issuer": "", "date": "", "credentialUrl": "" }
      ]
    }

    Resume Text:
    """${extractedText.substring(0, 15000)}"""
    `;

    const aiResultText = await completeResumeAi(prompt, 2500, "import-resume");
    if (!aiResultText) {
      throw new Error("AI returned empty content");
    }

    let parsedData;
    try {
      const jsonMatch = aiResultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse JSON from AI response");
      }
    } catch (e: any) {
      logger.error({ error: e, aiResultText }, "Failed to parse AI output for resume import");
      import("fs").then(fs => fs.writeFileSync("import-json-error.txt", String(e?.stack || e)));
      res.status(500).json({ error: "Failed to parse the imported resume." });
      return;
    }

    // Default template configuration
    const templateId = "ats-clean";
    const accentColor = "#1f2937";
    const title = parsedData.title || file.originalname.replace(/\.[^/.]+$/, "") || "Imported Resume";

    const [resume] = await db.insert(resumesTable).values({
      userId,
      title,
      templateId,
      accentColor,
      fontFamily: "Inter, sans-serif",
      fontColor: "#111827",
      backgroundColor: "#ffffff",
    }).returning();

    // Map to sections
    const sectionsToInsert = [
      {
        resumeId: resume.id,
        type: "personal",
        title: "Personal Details",
        displayOrder: 0,
        content: parsedData.personal || {},
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
        content: { items: parsedData.experience || [] },
      },
      {
        resumeId: resume.id,
        type: "education",
        title: "Education",
        displayOrder: 3,
        content: { items: parsedData.education || [] },
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
        content: { items: parsedData.projects || [] },
      },
      {
        resumeId: resume.id,
        type: "certifications",
        title: "Certifications",
        displayOrder: 6,
        content: { items: parsedData.certifications || [] },
      },
    ];

    const sections = await db.insert(resumeSectionsTable).values(sectionsToInsert).returning();

    res.status(201).json(toJSON({ ...resume, sections }));

  } catch (error: any) {
    logger.error({ error }, "Error importing resume");
    import("fs").then(fs => fs.writeFileSync("import-error.txt", String(error?.stack || error)));
    res.status(500).json({ error: "An error occurred while importing the resume." });
  }
});

router.get("/resumes/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId;
  const params = GetResumeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [resume] = await db.select().from(resumesTable).where(
    and(eq(resumesTable.id, params.data.id), eq(resumesTable.userId, userId))
  );

  if (!resume) {
    res.status(404).json({ error: "Resume not found" });
    return;
  }

  const sections = await db.select().from(resumeSectionsTable)
    .where(eq(resumeSectionsTable.resumeId, resume.id))
    .orderBy(resumeSectionsTable.displayOrder);

  res.json(GetResumeResponse.parse(toJSON({ ...resume, sections })));
});

router.patch("/resumes/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
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

  const [existing] = await db.select().from(resumesTable).where(
    and(eq(resumesTable.id, params.data.id), eq(resumesTable.userId, userId))
  );

  if (!existing) {
    res.status(404).json({ error: "Resume not found" });
    return;
  }

  const { sections, ...resumeFields } = parsed.data;

  const updateData: Partial<typeof resumesTable.$inferInsert> = {};
  if (resumeFields.title != null) updateData.title = resumeFields.title;
  if (resumeFields.templateId != null) updateData.templateId = resumeFields.templateId;
  if (resumeFields.accentColor != null) updateData.accentColor = resumeFields.accentColor;
  if (resumeFields.fontFamily != null) updateData.fontFamily = resumeFields.fontFamily;
  if (resumeFields.fontColor != null) updateData.fontColor = resumeFields.fontColor;
  if (resumeFields.backgroundColor != null) updateData.backgroundColor = resumeFields.backgroundColor;
  if (resumeFields.isPublic != null) updateData.isPublic = resumeFields.isPublic;

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
      const sectionUpdate: Partial<typeof resumeSectionsTable.$inferInsert> = {};
      if (section.type != null) sectionUpdate.type = section.type;
      if (section.title != null) sectionUpdate.title = section.title;
      if (section.content != null) sectionUpdate.content = section.content as Record<string, unknown>;
      if (section.displayOrder != null) sectionUpdate.displayOrder = section.displayOrder;
      if (section.isVisible != null) sectionUpdate.isVisible = section.isVisible;

      if (Object.keys(sectionUpdate).length > 0) {
        await db.update(resumeSectionsTable).set(sectionUpdate)
          .where(and(eq(resumeSectionsTable.id, section.id), eq(resumeSectionsTable.resumeId, params.data.id)));
      }
    }
  }

  const updatedSections = await db.select().from(resumeSectionsTable)
    .where(eq(resumeSectionsTable.resumeId, params.data.id))
    .orderBy(resumeSectionsTable.displayOrder);

  res.json(UpdateResumeResponse.parse(toJSON({ ...updatedResume, sections: updatedSections })));
});

router.delete("/resumes/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId;
  const params = DeleteResumeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(resumesTable).where(
    and(eq(resumesTable.id, params.data.id), eq(resumesTable.userId, userId))
  );

  if (!existing) {
    res.status(404).json({ error: "Resume not found" });
    return;
  }

  await db.delete(resumesTable).where(eq(resumesTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/resumes/:id/duplicate", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId;
  const params = DuplicateResumeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(resumesTable).where(
    and(eq(resumesTable.id, params.data.id), eq(resumesTable.userId, userId))
  );

  if (!existing) {
    res.status(404).json({ error: "Resume not found" });
    return;
  }

  const [duplicate] = await db.insert(resumesTable).values({
    userId,
    title: `${existing.title} (Copy)`,
    templateId: existing.templateId,
    accentColor: existing.accentColor,
    fontFamily: existing.fontFamily,
    fontColor: existing.fontColor,
    backgroundColor: existing.backgroundColor,
    isPublic: false,
  }).returning();

  const originalSections = await db.select().from(resumeSectionsTable)
    .where(eq(resumeSectionsTable.resumeId, existing.id));

  if (originalSections.length > 0) {
    const sectionsToInsert = originalSections.map(({ id, resumeId, createdAt, updatedAt, ...rest }) => ({
      ...rest,
      resumeId: duplicate.id,
    }));
    await db.insert(resumeSectionsTable).values(sectionsToInsert);
  }

  res.status(201).json(toJSON(duplicate));
});

router.post("/resumes/:id/export", requireAuth, async (req: Request, res: Response): Promise<void> => {
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

  const [existing] = await db.select().from(resumesTable).where(
    and(eq(resumesTable.id, params.data.id), eq(resumesTable.userId, userId))
  );

  if (!existing) {
    res.status(404).json({ error: "Resume not found" });
    return;
  }

  await db.update(resumesTable)
    .set({ downloadCount: sql`${resumesTable.downloadCount} + 1` })
    .where(eq(resumesTable.id, params.data.id));

  const exportUrl = `/api/resumes/${params.data.id}/download?format=${body.data.format}`;
  res.json(ExportResumeResponse.parse({ url: exportUrl, format: body.data.format }));
});

router.get("/resumes/:id/ats-score", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId;
  const params = GetAtsScoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [resume] = await db.select().from(resumesTable).where(
    and(eq(resumesTable.id, params.data.id), eq(resumesTable.userId, userId))
  );

  if (!resume) {
    res.status(404).json({ error: "Resume not found" });
    return;
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  if (clerkUser.publicMetadata?.isPremium !== true) {
    res.status(403).json({ error: "ATS score is available for Pro subscribers only." });
    return;
  }

  const sections = await db.select().from(resumeSectionsTable)
    .where(eq(resumeSectionsTable.resumeId, resume.id));

  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const feedback: string[] = [];

  const personalSection = sections.find(s => s.type === "personal");
  const personalContent = personalSection?.content as any;
  if (personalContent?.email) passedChecks.push("Contact email present");
  else failedChecks.push("Missing contact email");

  if (personalContent?.phone) passedChecks.push("Phone number present");
  else failedChecks.push("Missing phone number");

  const summarySection = sections.find(s => s.type === "summary");
  const summaryContent = summarySection?.content as any;
  if (summaryContent?.text && summaryContent.text.length > 50) {
    passedChecks.push("Professional summary present");
  } else {
    failedChecks.push("Missing or too short professional summary");
    feedback.push("Add a compelling professional summary of at least 3-4 sentences");
  }

  const expSection = sections.find(s => s.type === "experience");
  const expContent = expSection?.content as any;
  if (expContent?.items && expContent.items.length > 0) {
    passedChecks.push("Work experience included");
    const hasQuantified = expContent.items.some((item: any) =>
      item.bullets?.some((b: string) => /\d/.test(b))
    );
    if (hasQuantified) passedChecks.push("Quantified achievements present");
    else {
      failedChecks.push("No quantified achievements");
      feedback.push("Add numbers and metrics to your bullet points (e.g., 'Increased sales by 30%')");
    }
  } else {
    failedChecks.push("Missing work experience");
  }

  const skillsSection = sections.find(s => s.type === "skills");
  const skillsContent = skillsSection?.content as any;
  if (skillsContent?.items && skillsContent.items.length >= 5) {
    passedChecks.push("Adequate skills listed");
  } else {
    failedChecks.push("Too few skills listed");
    feedback.push("List at least 5-10 relevant skills for better ATS matching");
  }

  if (resume.title && resume.title.length > 2) passedChecks.push("Resume has a title");

  const score = Math.round((passedChecks.length / (passedChecks.length + failedChecks.length)) * 100);

  res.json(GetAtsScoreResponse.parse({
    score,
    maxScore: 100,
    feedback,
    passedChecks,
    failedChecks,
  }));
});

router.post("/resumes/export-pdf", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { html } = req.body;
  if (!html) {
    res.status(400).json({ error: "No HTML provided" });
    return;
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ],
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    
    // Some fonts might need a bit more time to render perfectly, waiting a small fixed amount can help
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    await browser.close();
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
    res.send(Buffer.from(pdfBuffer));
  } catch (error: any) {
    logger.error({ error: error.message || error }, "Error generating PDF");
    res.status(500).json({ 
      error: "Failed to generate PDF", 
      details: error.message || String(error) 
    });
  }
});

export default router;
