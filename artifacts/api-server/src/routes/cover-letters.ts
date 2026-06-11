import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  coverLettersTable,
  coverLetterVersionsTable,
  resumesTable,
  resumeSectionsTable,
} from "@workspace/db";
import {
  CreateCoverLetterBody,
  UpdateCoverLetterBody,
  GenerateCoverLetterBody,
  RegenerateCoverLetterBody,
  AuditCoverLetterAtsBody,
  ScrapeJobDetailsBody,
  ExportCoverLetterPdfBody,
} from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { logger } from "../lib/logger";
import {
  generateCoverLetterText,
  rewriteCoverLetterSection,
  auditCoverLetterAts,
  formatResumeForAi,
} from "../lib/cover-letter-ai";
import { scrapeJobUrl } from "../lib/job-scraper";
import { renderResumePdf } from "../lib/pdf-renderer";
import { sendAiRouteError } from "../lib/ai-route-error";

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

const toJSON = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// GET /cover-letters: List cover letters
router.get(
  "/cover-letters",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const resumeIdQuery = req.query.resumeId;
      const isArchivedQuery = req.query.isArchived;

      const conditions = [eq(coverLettersTable.userId, userId)];

      if (resumeIdQuery) {
        conditions.push(eq(coverLettersTable.resumeId, Number(resumeIdQuery)));
      }

      if (isArchivedQuery !== undefined) {
        conditions.push(
          eq(coverLettersTable.isArchived, isArchivedQuery === "true"),
        );
      }

      const letters = await db
        .select()
        .from(coverLettersTable)
        .where(and(...conditions))
        .orderBy(desc(coverLettersTable.updatedAt));

      res.json(toJSON(letters));
    } catch (error: any) {
      logger.error({ error: error.message }, "Error listing cover letters");
      res.status(500).json({ error: "Failed to list cover letters" });
    }
  },
);

// POST /cover-letters: Create empty/draft cover letter
router.post(
  "/cover-letters",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const parsed = CreateCoverLetterBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const { title, resumeId, jobTitle, companyName } = parsed.data;

      let defaultFontFamily = "sans";
      let defaultAccentColor = "#1e3a8a";

      if (resumeId) {
        const [resume] = await db
          .select()
          .from(resumesTable)
          .where(
            and(eq(resumesTable.id, resumeId), eq(resumesTable.userId, userId)),
          );
        if (resume) {
          if (resume.accentColor) {
            defaultAccentColor = resume.accentColor;
          }
        }
      }

      const [newLetter] = await db
        .insert(coverLettersTable)
        .values({
          userId,
          title,
          resumeId: resumeId || null,
          jobTitle: jobTitle || null,
          companyName: companyName || null,
          templateId: "classic",
          tone: "professional",
          fontFamily: defaultFontFamily,
          accentColor: defaultAccentColor,
          isArchived: false,
        })
        .returning();

      res.status(201).json(toJSON(newLetter));
    } catch (error: any) {
      logger.error({ error: error.message }, "Error creating cover letter");
      res.status(500).json({ error: "Failed to create cover letter" });
    }
  },
);

// POST /cover-letters/generate: Generate cover letter (3 flows)
router.post(
  "/cover-letters/generate",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const parsed = GenerateCoverLetterBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const {
        flowType,
        resumeId,
        jobDescription,
        jobTitle,
        companyName,
        hiringManagerName,
        companyLocation,
        jobUrl,
        customInstructions,
        tone,
        experienceLevel,
      } = parsed.data;

      let finalJobTitle = jobTitle || "";
      let finalCompanyName = companyName || "";
      let finalJobDescription = jobDescription || "";
      let finalLocation = companyLocation || "";

      // 1. Scrape if job URL is provided
      if (flowType === "jobUrl" && jobUrl) {
        try {
          const scraped = await scrapeJobUrl(jobUrl);
          if (scraped.jobTitle && !finalJobTitle) {
            finalJobTitle = scraped.jobTitle;
          }
          if (scraped.companyName && !finalCompanyName) {
            finalCompanyName = scraped.companyName;
          }
          if (scraped.description) {
            finalJobDescription = scraped.description;
          }
          if (scraped.location && !finalLocation) {
            finalLocation = scraped.location;
          }
        } catch (scrapeErr: any) {
          logger.warn({ error: scrapeErr.message, jobUrl }, "Scraping failed during generation flow");
        }
      }

      // 2. Fetch resume text if resumeId is provided
      let resumeText: string | null = null;
      let defaultFontFamily = "sans";
      let defaultAccentColor = "#1e3a8a";
      if (resumeId) {
        const [resume] = await db
          .select()
          .from(resumesTable)
          .where(
            and(eq(resumesTable.id, resumeId), eq(resumesTable.userId, userId)),
          );

        if (resume) {
          const sections = await db
            .select()
            .from(resumeSectionsTable)
            .where(eq(resumeSectionsTable.resumeId, resumeId));

          resumeText = formatResumeForAi(resume, sections);

          if (resume.accentColor) {
            defaultAccentColor = resume.accentColor;
          }
        }
      }

      // 3. Generate cover letter
      const text = await generateCoverLetterText(
        resumeText,
        {
          jobTitle: finalJobTitle,
          companyName: finalCompanyName,
          hiringManagerName: hiringManagerName || "Hiring Manager",
          companyLocation: finalLocation,
          jobDescription: finalJobDescription,
        },
        {
          tone,
          preset: "Professional", // Default preset
          customInstructions,
          experienceLevel,
        },
      );

      // 4. Save to database
      const [coverLetter] = await db
        .insert(coverLettersTable)
        .values({
          userId,
          title: `Cover Letter for ${finalJobTitle || "Job"} at ${finalCompanyName || "Company"}`,
          resumeId: resumeId || null,
          jobTitle: finalJobTitle || null,
          companyName: finalCompanyName || null,
          hiringManagerName: hiringManagerName || null,
          companyLocation: finalLocation || null,
          generatedContent: text,
          customInstructions: customInstructions || null,
          jobDescription: finalJobDescription || null,
          templateId: "classic",
          tone,
          fontFamily: defaultFontFamily,
          accentColor: defaultAccentColor,
          experienceLevel,
          isArchived: false,
        })
        .returning();

      res.status(201).json(toJSON(coverLetter));
    } catch (error: any) {
      logger.error({ error: error.message }, "Error generating cover letter");
      sendAiRouteError(res, error);
    }
  },
);

// POST /cover-letters/scrape-job: Scrape job URL
router.post(
  "/cover-letters/scrape-job",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = ScrapeJobDetailsBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const scraped = await scrapeJobUrl(parsed.data.url);
      res.json(toJSON(scraped));
    } catch (error: any) {
      logger.error({ error: error.message }, "Error scraping job details");
      res.status(500).json({ error: error.message || "Failed to scrape job URL" });
    }
  },
);

// POST /cover-letters/export-pdf: Export PDF
router.post(
  "/cover-letters/export-pdf",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = ExportCoverLetterPdfBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const pdfBuffer = await renderResumePdf(parsed.data.html);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=cover-letter.pdf");
      res.send(pdfBuffer);
    } catch (error: any) {
      logger.error({ error: error.message }, "Error exporting cover letter PDF");
      res.status(500).json({ error: "Failed to render cover letter PDF" });
    }
  },
);

// GET /cover-letters/:id: Get cover letter details
router.get(
  "/cover-letters/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const id = Number(req.params.id);

      const [letter] = await db
        .select()
        .from(coverLettersTable)
        .where(
          and(eq(coverLettersTable.id, id), eq(coverLettersTable.userId, userId)),
        );

      if (!letter) {
        res.status(404).json({ error: "Cover letter not found" });
        return;
      }

      res.json(toJSON(letter));
    } catch (error: any) {
      logger.error({ error: error.message }, "Error getting cover letter");
      res.status(500).json({ error: "Failed to get cover letter details" });
    }
  },
);

// PUT /cover-letters/:id: Update cover letter
router.put(
  "/cover-letters/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const id = Number(req.params.id);

      const parsed = UpdateCoverLetterBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const [letter] = await db
        .select()
        .from(coverLettersTable)
        .where(
          and(eq(coverLettersTable.id, id), eq(coverLettersTable.userId, userId)),
        );

      if (!letter) {
        res.status(404).json({ error: "Cover letter not found" });
        return;
      }

      const [updatedLetter] = await db
        .update(coverLettersTable)
        .set({
          ...parsed.data,
          updatedAt: new Date(),
        })
        .where(eq(coverLettersTable.id, id))
        .returning();

      res.json(toJSON(updatedLetter));
    } catch (error: any) {
      logger.error({ error: error.message }, "Error updating cover letter");
      res.status(500).json({ error: "Failed to update cover letter" });
    }
  },
);

// DELETE /cover-letters/:id: Delete cover letter
router.delete(
  "/cover-letters/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const id = Number(req.params.id);

      const [letter] = await db
        .select()
        .from(coverLettersTable)
        .where(
          and(eq(coverLettersTable.id, id), eq(coverLettersTable.userId, userId)),
        );

      if (!letter) {
        res.status(404).json({ error: "Cover letter not found" });
        return;
      }

      await db.delete(coverLettersTable).where(eq(coverLettersTable.id, id));
      res.json({ success: true });
    } catch (error: any) {
      logger.error({ error: error.message }, "Error deleting cover letter");
      res.status(500).json({ error: "Failed to delete cover letter" });
    }
  },
);

// POST /cover-letters/:id/duplicate: Duplicate cover letter
router.post(
  "/cover-letters/:id/duplicate",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const id = Number(req.params.id);

      const [letter] = await db
        .select()
        .from(coverLettersTable)
        .where(
          and(eq(coverLettersTable.id, id), eq(coverLettersTable.userId, userId)),
        );

      if (!letter) {
        res.status(404).json({ error: "Cover letter not found" });
        return;
      }

      const [duplicated] = await db
        .insert(coverLettersTable)
        .values({
          userId,
          title: `Copy of ${letter.title}`,
          resumeId: letter.resumeId,
          jobTitle: letter.jobTitle,
          companyName: letter.companyName,
          hiringManagerName: letter.hiringManagerName,
          companyLocation: letter.companyLocation,
          generatedContent: letter.generatedContent,
          customInstructions: letter.customInstructions,
          jobDescription: letter.jobDescription,
          templateId: letter.templateId,
          tone: letter.tone,
          fontFamily: letter.fontFamily,
          accentColor: letter.accentColor,
          experienceLevel: letter.experienceLevel,
          senderName: letter.senderName,
          senderEmail: letter.senderEmail,
          senderPhone: letter.senderPhone,
          senderLocation: letter.senderLocation,
          isArchived: false,
        })
        .returning();

      res.status(201).json(toJSON(duplicated));
    } catch (error: any) {
      logger.error({ error: error.message }, "Error duplicating cover letter");
      res.status(500).json({ error: "Failed to duplicate cover letter" });
    }
  },
);

// POST /cover-letters/:id/regenerate: Regenerate cover letter content
router.post(
  "/cover-letters/:id/regenerate",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const id = Number(req.params.id);

      const parsed = RegenerateCoverLetterBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const [letter] = await db
        .select()
        .from(coverLettersTable)
        .where(
          and(eq(coverLettersTable.id, id), eq(coverLettersTable.userId, userId)),
        );

      if (!letter) {
        res.status(404).json({ error: "Cover letter not found" });
        return;
      }

      // 1. Create a version snapshot of current state before updating
      await db.insert(coverLetterVersionsTable).values({
        coverLetterId: letter.id,
        title: letter.title,
        jobTitle: letter.jobTitle,
        companyName: letter.companyName,
        hiringManagerName: letter.hiringManagerName,
        companyLocation: letter.companyLocation,
        generatedContent: letter.generatedContent,
        customInstructions: letter.customInstructions,
        jobDescription: letter.jobDescription,
        templateId: letter.templateId,
        tone: letter.tone,
        fontFamily: letter.fontFamily,
        accentColor: letter.accentColor,
        experienceLevel: letter.experienceLevel,
        senderName: letter.senderName,
        senderEmail: letter.senderEmail,
        senderPhone: letter.senderPhone,
        senderLocation: letter.senderLocation,
      });

      // 2. Fetch resume text if linked
      let resumeText: string | null = null;
      if (letter.resumeId) {
        const [resume] = await db
          .select()
          .from(resumesTable)
          .where(
            and(
              eq(resumesTable.id, letter.resumeId),
              eq(resumesTable.userId, userId),
            ),
          );

        if (resume) {
          const sections = await db
            .select()
            .from(resumeSectionsTable)
            .where(eq(resumeSectionsTable.resumeId, letter.resumeId));

          resumeText = formatResumeForAi(resume, sections);
        }
      }

      const updatedJobDescription =
        parsed.data.jobDescription || letter.jobDescription || "";

      // 3. Generate new text
      const newText = await generateCoverLetterText(
        resumeText,
        {
          jobTitle: letter.jobTitle,
          companyName: letter.companyName,
          hiringManagerName: letter.hiringManagerName,
          companyLocation: letter.companyLocation,
          jobDescription: updatedJobDescription,
        },
        {
          tone: parsed.data.tone || letter.tone,
          preset: "Professional", // Default preset
          customInstructions: parsed.data.customInstructions,
          experienceLevel: parsed.data.experienceLevel || letter.experienceLevel,
        },
      );

      // 4. Update letter in database
      const [updatedLetter] = await db
        .update(coverLettersTable)
        .set({
          generatedContent: newText,
          customInstructions: parsed.data.customInstructions || null,
          jobDescription: updatedJobDescription || null,
          tone: parsed.data.tone || letter.tone,
          experienceLevel: parsed.data.experienceLevel || letter.experienceLevel,
          updatedAt: new Date(),
        })
        .where(eq(coverLettersTable.id, id))
        .returning();

      res.json(toJSON(updatedLetter));
    } catch (error: any) {
      logger.error({ error: error.message }, "Error regenerating cover letter");
      sendAiRouteError(res, error);
    }
  },
);

// GET /cover-letters/:id/versions: Get version history
router.get(
  "/cover-letters/:id/versions",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const id = Number(req.params.id);

      const [letter] = await db
        .select()
        .from(coverLettersTable)
        .where(
          and(eq(coverLettersTable.id, id), eq(coverLettersTable.userId, userId)),
        );

      if (!letter) {
        res.status(404).json({ error: "Cover letter not found" });
        return;
      }

      const versions = await db
        .select()
        .from(coverLetterVersionsTable)
        .where(eq(coverLetterVersionsTable.coverLetterId, id))
        .orderBy(desc(coverLetterVersionsTable.createdAt));

      res.json(toJSON(versions));
    } catch (error: any) {
      logger.error({ error: error.message }, "Error listing cover letter versions");
      res.status(500).json({ error: "Failed to list versions" });
    }
  },
);

// POST /cover-letters/:id/versions/:versionId/restore: Restore version
router.post(
  "/cover-letters/:id/versions/:versionId/restore",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const id = Number(req.params.id);
      const versionId = Number(req.params.versionId);

      const [letter] = await db
        .select()
        .from(coverLettersTable)
        .where(
          and(eq(coverLettersTable.id, id), eq(coverLettersTable.userId, userId)),
        );

      if (!letter) {
        res.status(404).json({ error: "Cover letter not found" });
        return;
      }

      const [version] = await db
        .select()
        .from(coverLetterVersionsTable)
        .where(
          and(
            eq(coverLetterVersionsTable.id, versionId),
            eq(coverLetterVersionsTable.coverLetterId, id),
          ),
        );

      if (!version) {
        res.status(404).json({ error: "Version not found" });
        return;
      }

      // 1. Save current state to history as a new version
      await db.insert(coverLetterVersionsTable).values({
        coverLetterId: letter.id,
        title: letter.title,
        jobTitle: letter.jobTitle,
        companyName: letter.companyName,
        hiringManagerName: letter.hiringManagerName,
        companyLocation: letter.companyLocation,
        generatedContent: letter.generatedContent,
        customInstructions: letter.customInstructions,
        jobDescription: letter.jobDescription,
        templateId: letter.templateId,
        tone: letter.tone,
        fontFamily: letter.fontFamily,
        accentColor: letter.accentColor,
        experienceLevel: letter.experienceLevel,
        senderName: letter.senderName,
        senderEmail: letter.senderEmail,
        senderPhone: letter.senderPhone,
        senderLocation: letter.senderLocation,
      });

      // 2. Overwrite letter with version values
      const [restoredLetter] = await db
        .update(coverLettersTable)
        .set({
          title: version.title,
          jobTitle: version.jobTitle,
          companyName: version.companyName,
          hiringManagerName: version.hiringManagerName,
          companyLocation: version.companyLocation,
          generatedContent: version.generatedContent,
          customInstructions: version.customInstructions,
          jobDescription: version.jobDescription,
          templateId: version.templateId,
          tone: version.tone,
          fontFamily: version.fontFamily,
          accentColor: version.accentColor,
          experienceLevel: version.experienceLevel,
          senderName: version.senderName,
          senderEmail: version.senderEmail,
          senderPhone: version.senderPhone,
          senderLocation: version.senderLocation,
          updatedAt: new Date(),
        })
        .where(eq(coverLettersTable.id, id))
        .returning();

      res.json(toJSON(restoredLetter));
    } catch (error: any) {
      logger.error({ error: error.message }, "Error restoring cover letter version");
      res.status(500).json({ error: "Failed to restore version" });
    }
  },
);

// POST /cover-letters/:id/ats-score: ATS audit
router.post(
  "/cover-letters/:id/ats-score",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const id = Number(req.params.id);

      const parsed = AuditCoverLetterAtsBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const [letter] = await db
        .select()
        .from(coverLettersTable)
        .where(
          and(eq(coverLettersTable.id, id), eq(coverLettersTable.userId, userId)),
        );

      if (!letter) {
        res.status(404).json({ error: "Cover letter not found" });
        return;
      }

      let contentToAudit = letter.generatedContent || "";
      try {
        const parsedJson = JSON.parse(contentToAudit);
        if (parsedJson && (parsedJson.body !== undefined || parsedJson.closing !== undefined)) {
          const dateLine = parsedJson.date ? `${parsedJson.date}\n\n` : "";
          const recipientLine = letter.hiringManagerName ? `${letter.hiringManagerName}\n` : "";
          const companyLine = letter.companyName ? `${letter.companyName}\n` : "";
          const locationLine = letter.companyLocation ? `${letter.companyLocation}\n` : "";
          const subjectLine = letter.jobTitle ? `Subject: Application for ${letter.jobTitle}\n\n` : "";
          const salutationLine = letter.hiringManagerName ? `Dear ${letter.hiringManagerName},\n\n` : "Dear Hiring Manager,\n\n";
          const bodyText = parsedJson.body || "";
          const closingText = parsedJson.closing ? `\n\n${parsedJson.closing}\n` : "";
          const signatureText = parsedJson.signature ? `${parsedJson.signature}` : "";
          
          contentToAudit = `${dateLine}${recipientLine}${companyLine}${locationLine}\n${subjectLine}${salutationLine}${bodyText}${closingText}${signatureText}`;
        }
      } catch {
        // Fallback: use raw plain text
      }

      const audit = await auditCoverLetterAts(
        contentToAudit,
        parsed.data.jobDescription,
      );

      // Save audit back to db
      const [updatedLetter] = await db
        .update(coverLettersTable)
        .set({
          atsScore: audit.score,
          atsPassedChecks: audit.passedChecks,
          atsFailedChecks: audit.failedChecks,
          atsFeedback: audit.feedback,
          atsKeywords: audit.keywords,
          atsUpdatedAt: new Date(),
          jobDescription: parsed.data.jobDescription,
        })
        .where(eq(coverLettersTable.id, id))
        .returning();

      res.json(
        toJSON({
          score: audit.score,
          maxScore: 100,
          feedback: audit.feedback,
          passedChecks: audit.passedChecks,
          failedChecks: audit.failedChecks,
          atsUpdatedAt: updatedLetter.atsUpdatedAt,
        }),
      );
    } catch (error: any) {
      logger.error({ error: error.message }, "Error auditing cover letter ATS score");
      sendAiRouteError(res, error);
    }
  },
);

export default router;
