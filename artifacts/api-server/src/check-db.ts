import { db, resumesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const resumeId = 82; // Let's check resume 82 first, or the latest resume
  console.log("Fetching resume ID:", resumeId);
  const rows = await db.select().from(resumesTable).where(eq(resumesTable.id, resumeId));
  console.log("Resume details:", JSON.stringify(rows[0], null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
