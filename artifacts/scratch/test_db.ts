import { db, userProfilesTable } from "@workspace/db";

async function main() {
  try {
    const profiles = await db.select().from(userProfilesTable);
    console.log("Profiles in DB:", JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.error("Error fetching profiles:", error);
  }
}

main();
