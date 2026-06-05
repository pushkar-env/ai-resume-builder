import { db, resumesTable, resumeSectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

async function main() {
  const resumeId = 82;
  console.log("=== DB state before optimization ===");
  const [before] = await db.select().from(resumesTable).where(eq(resumesTable.id, resumeId));
  console.log("Before:", {
    atsScore: before.atsScore,
    atsUpdatedAt: before.atsUpdatedAt,
    atsJobDescription: before.atsJobDescription,
    updatedAt: before.updatedAt,
  });

  const sections = await db
    .select()
    .from(resumeSectionsTable)
    .where(eq(resumeSectionsTable.resumeId, resumeId));

  console.log("Running simulated optimization update...");
  const now = new Date();
  const [updatedResume] = await db
    .update(resumesTable)
    .set({
      updatedAt: now,
      atsScore: 95,
      atsPassedChecks: ["Passed 1", "Passed 2"],
      atsFailedChecks: ["Failed 1"],
      atsFeedback: ["Feedback 1"],
      atsUpdatedAt: now,
      atsJobDescription: "Senior Software Engineer",
    })
    .where(eq(resumesTable.id, resumeId))
    .returning();

  console.log("Returned from update:", {
    atsScore: updatedResume.atsScore,
    atsUpdatedAt: updatedResume.atsUpdatedAt,
    atsJobDescription: updatedResume.atsJobDescription,
    updatedAt: updatedResume.updatedAt,
  });

  console.log("=== DB state after optimization (fresh select) ===");
  const [after] = await db.select().from(resumesTable).where(eq(resumesTable.id, resumeId));
  console.log("After select:", {
    atsScore: after.atsScore,
    atsUpdatedAt: after.atsUpdatedAt,
    atsJobDescription: after.atsJobDescription,
    updatedAt: after.updatedAt,
  });
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
