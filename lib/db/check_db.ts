import { db, userProfilesTable } from "./src/index";
import { eq } from "drizzle-orm";

async function main() {
  const userId = "user_3EDIsOsRRkNZNP279U80zSGfCY8";
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  console.log("Current Profile in DB:", JSON.stringify(profile, null, 2));
}

main().catch(console.error);
