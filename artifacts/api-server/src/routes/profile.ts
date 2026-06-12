import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { getAuth, clerkClient } from "@clerk/express";
import { UpdateProfileBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

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

    res.json({
      userId,
      name,
      email,
      phone,
      photo,
      jobTitle: profile?.jobTitle || "",
      location: profile?.location || "",
      socials: profile?.socials || [],
      createdAt: profile?.createdAt || new Date(),
      updatedAt: profile?.updatedAt || new Date(),
    });
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

    const [existing] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));

    let profile;
    if (existing) {
      [profile] = await db
        .update(userProfilesTable)
        .set({
          name: parsed.data.name ?? "",
          email: parsed.data.email ?? "",
          phone: parsed.data.phone ?? "",
          photo: parsed.data.photo ?? "",
          jobTitle: parsed.data.jobTitle ?? "",
          location: parsed.data.location ?? "",
          socials: parsed.data.socials ?? [],
          updatedAt: new Date(),
        })
        .where(eq(userProfilesTable.userId, userId))
        .returning();
    } else {
      [profile] = await db
        .insert(userProfilesTable)
        .values({
          userId,
          name: parsed.data.name ?? "",
          email: parsed.data.email ?? "",
          phone: parsed.data.phone ?? "",
          photo: parsed.data.photo ?? "",
          jobTitle: parsed.data.jobTitle ?? "",
          location: parsed.data.location ?? "",
          socials: parsed.data.socials ?? [],
        })
        .returning();
    }

    res.json(profile);
  }
);

export default router;
