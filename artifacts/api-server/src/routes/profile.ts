import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  resumesTable,
  resumeSectionsTable,
} from "@workspace/db";
import { getAuth, clerkClient } from "@clerk/express";
import { UpdateProfileBody, ExtractProfileFromResumeBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { extractProfileFromResumeSections } from "../lib/extract-profile-from-resume";

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

router.get(
  "/profile",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));

    let name = profile?.name || "";
    let email = profile?.email || "";
    let phone = profile?.phone || "";
    let photo = profile?.photo || "";

    if (!name || !email || !phone || !photo) {
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        if (!name) name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();
        if (!email) email = clerkUser.emailAddresses[0]?.emailAddress || "";
        if (!phone) phone = clerkUser.phoneNumbers[0]?.phoneNumber || "";
        if (!photo) photo = clerkUser.imageUrl || "";
      } catch (err) {
        logger.error({ err }, "Failed to fetch Clerk details for profile fallback");
      }
    }

    const responsePayload = {
      userId,
      name,
      email,
      phone,
      photo,
      jobTitle: profile?.jobTitle || "",
      location: profile?.location || "",
      socials: profile?.socials || [],
      aboutMe: profile?.aboutMe || "",
      yearsOfExperience: profile?.yearsOfExperience ?? null,
      experience: profile?.experience || [],
      education: profile?.education || [],
      skills: profile?.skills || [],
      projects: profile?.projects || [],
      certifications: profile?.certifications || [],
      onboardingCompleted: profile?.onboardingCompleted ?? false,
      onboardingSkipped: profile?.onboardingSkipped ?? false,
      onboardingProgress: profile?.onboardingProgress ?? 0,
      createdAt: profile?.createdAt || new Date(),
      updatedAt: profile?.updatedAt || new Date(),
    };

    logger.info({ responsePayload }, "GET /profile returning response payload");
    res.json(responsePayload);
  }
);

router.put(
  "/profile",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    logger.info({ body: req.body, parsed: parsed.data }, "PUT /profile parsed payload");

    const [existing] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));

    let profile;
    if (existing) {
      const updateData: any = {};
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
      if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
      if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
      if (parsed.data.photo !== undefined) updateData.photo = parsed.data.photo;
      if (parsed.data.jobTitle !== undefined) updateData.jobTitle = parsed.data.jobTitle;
      if (parsed.data.location !== undefined) updateData.location = parsed.data.location;
      if (parsed.data.socials !== undefined) updateData.socials = parsed.data.socials;
      if (parsed.data.aboutMe !== undefined) updateData.aboutMe = parsed.data.aboutMe;
      if (parsed.data.yearsOfExperience !== undefined) updateData.yearsOfExperience = parsed.data.yearsOfExperience;
      if (parsed.data.experience !== undefined) {
        updateData.experience = parsed.data.experience.map((exp) => ({
          company: exp.company ?? "",
          title: exp.title ?? "",
          startDate: exp.startDate ?? "",
          endDate: exp.endDate ?? "",
          location: exp.location ?? "",
          description: exp.description ?? "",
          bullets: Array.isArray(exp.bullets) ? exp.bullets : [],
          currentlyWorking: !!exp.currentlyWorking,
        }));
      }
      if (parsed.data.skills !== undefined) updateData.skills = parsed.data.skills;
      if (parsed.data.projects !== undefined) {
        updateData.projects = parsed.data.projects.map((proj) => ({
          name: proj.name ?? "",
          description: proj.description ?? "",
          bullets: Array.isArray(proj.bullets) ? proj.bullets : [],
          technologiesUsed: proj.technologiesUsed ?? "",
          url: proj.url ?? "",
          github: proj.github ?? "",
        }));
      }
      if (parsed.data.certifications !== undefined) {
        updateData.certifications = parsed.data.certifications.map((cert) => ({
          name: cert.name ?? "",
          issuer: cert.issuer ?? "",
          date: cert.date ?? "",
          credentialUrl: cert.credentialUrl ?? "",
        }));
      }
      if (parsed.data.education !== undefined) {
        updateData.education = parsed.data.education.map((edu) => ({
          school: edu.school ?? "",
          degree: edu.degree ?? "",
          field: edu.field ?? "",
          startDate: edu.startDate ?? "",
          endDate: edu.endDate ?? "",
          gpa: edu.gpa ?? "",
          gpaMode: edu.gpaMode ?? "gpa",
        }));
      }
      if (parsed.data.onboardingCompleted !== undefined) updateData.onboardingCompleted = parsed.data.onboardingCompleted;
      if (parsed.data.onboardingSkipped !== undefined) updateData.onboardingSkipped = parsed.data.onboardingSkipped;
      if (parsed.data.onboardingProgress !== undefined) updateData.onboardingProgress = parsed.data.onboardingProgress;
      updateData.updatedAt = new Date();

      [profile] = await db
        .update(userProfilesTable)
        .set(updateData)
        .where(eq(userProfilesTable.userId, userId))
        .returning();
    } else {
      const insertData = {
        userId,
        name: parsed.data.name ?? "",
        email: parsed.data.email ?? "",
        phone: parsed.data.phone ?? "",
        photo: parsed.data.photo ?? "",
        jobTitle: parsed.data.jobTitle ?? "",
        location: parsed.data.location ?? "",
        socials: (parsed.data.socials ?? []) as any,
        aboutMe: parsed.data.aboutMe ?? "",
        yearsOfExperience: parsed.data.yearsOfExperience ?? null,
        experience: (parsed.data.experience ?? []).map((exp) => ({
          company: exp.company ?? "",
          title: exp.title ?? "",
          startDate: exp.startDate ?? "",
          endDate: exp.endDate ?? "",
          location: exp.location ?? "",
          description: exp.description ?? "",
          bullets: Array.isArray(exp.bullets) ? exp.bullets : [],
          currentlyWorking: !!exp.currentlyWorking,
        })) as any,
        skills: (parsed.data.skills ?? []) as any,
        projects: (parsed.data.projects ?? []).map((proj) => ({
          name: proj.name ?? "",
          description: proj.description ?? "",
          bullets: Array.isArray(proj.bullets) ? proj.bullets : [],
          technologiesUsed: proj.technologiesUsed ?? "",
          url: proj.url ?? "",
          github: proj.github ?? "",
        })) as any,
        certifications: (parsed.data.certifications ?? []).map((cert) => ({
          name: cert.name ?? "",
          issuer: cert.issuer ?? "",
          date: cert.date ?? "",
          credentialUrl: cert.credentialUrl ?? "",
        })) as any,
        education: (parsed.data.education ?? []).map((edu) => ({
          school: edu.school ?? "",
          degree: edu.degree ?? "",
          field: edu.field ?? "",
          startDate: edu.startDate ?? "",
          endDate: edu.endDate ?? "",
          gpa: edu.gpa ?? "",
          gpaMode: edu.gpaMode ?? "gpa",
        })) as any,
        onboardingCompleted: parsed.data.onboardingCompleted ?? false,
        onboardingSkipped: parsed.data.onboardingSkipped ?? false,
        onboardingProgress: parsed.data.onboardingProgress ?? 0,
      };

      [profile] = await db
        .insert(userProfilesTable)
        .values(insertData)
        .returning();
    }

    res.json(profile);
  }
);

router.post(
  "/profile/extract-from-resume",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const parsed = ExtractProfileFromResumeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Ownership check — only the resume's owner may extract from it.
    const [resume] = await db
      .select()
      .from(resumesTable)
      .where(
        and(
          eq(resumesTable.id, parsed.data.resumeId),
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

    const extracted = extractProfileFromResumeSections(sections);

    logger.info(
      { userId, resumeId: resume.id },
      "Extracted profile fields from resume",
    );
    res.json(extracted);
  }
);

export default router;
