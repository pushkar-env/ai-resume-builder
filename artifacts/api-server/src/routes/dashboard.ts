import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, sum, count } from "drizzle-orm";
import { db, resumesTable } from "@workspace/db";
import { GetDashboardStatsResponse } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";

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

router.get(
  "/dashboard/stats",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;

    const [stats] = await db
      .select({
        totalResumes: count(resumesTable.id),
        totalViews: sum(resumesTable.viewCount),
        totalDownloads: sum(resumesTable.downloadCount),
      })
      .from(resumesTable)
      .where(eq(resumesTable.userId, userId));

    const recentResumes = await db
      .select()
      .from(resumesTable)
      .where(eq(resumesTable.userId, userId))
      .orderBy(desc(resumesTable.updatedAt))
      .limit(5);

    const allResumes = await db
      .select({ templateId: resumesTable.templateId })
      .from(resumesTable)
      .where(eq(resumesTable.userId, userId));

    const templateCounts: Record<string, number> = {};
    for (const r of allResumes) {
      templateCounts[r.templateId] = (templateCounts[r.templateId] ?? 0) + 1;
    }
    const resumesByTemplate = Object.entries(templateCounts).map(
      ([templateId, count]) => ({
        templateId,
        count,
      }),
    );

    res.json(
      GetDashboardStatsResponse.parse({
        totalResumes: stats?.totalResumes ?? 0,
        totalViews: Number(stats?.totalViews ?? 0),
        totalDownloads: Number(stats?.totalDownloads ?? 0),
        recentResumes: toJSON(recentResumes),
        resumesByTemplate,
      }),
    );
  },
);

export default router;
