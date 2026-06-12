import { db, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const userId = "user_3EDIsOsRRkNZNP279U80zSGfCY8";
  
  try {
    const [existing] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));
      
    console.log("Before auto-save simulation:", {
      onboardingCompleted: existing?.onboardingCompleted,
      onboardingSkipped: existing?.onboardingSkipped,
      onboardingProgress: existing?.onboardingProgress,
    });

    // Let's simulate an auto-save payload (does not contain onboardingCompleted or onboardingSkipped)
    const parsedData = {
      name: "Pushkar Updated",
    };

    const updateData = {
      name: parsedData.name,
      onboardingCompleted: (parsedData as any).onboardingCompleted ?? existing?.onboardingCompleted ?? false,
      onboardingSkipped: (parsedData as any).onboardingSkipped ?? existing?.onboardingSkipped ?? false,
      onboardingProgress: (parsedData as any).onboardingProgress ?? existing?.onboardingProgress ?? 0,
      updatedAt: new Date(),
    };

    let profile;
    if (existing) {
      [profile] = await db
        .update(userProfilesTable)
        .set(updateData)
        .where(eq(userProfilesTable.userId, userId))
        .returning();
    }

    console.log("After auto-save simulation:", {
      onboardingCompleted: profile?.onboardingCompleted,
      onboardingSkipped: profile?.onboardingSkipped,
      onboardingProgress: profile?.onboardingProgress,
    });

    const [refetched] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));

    console.log("Refetched after auto-save:", {
      onboardingCompleted: refetched?.onboardingCompleted,
      onboardingSkipped: refetched?.onboardingSkipped,
      onboardingProgress: refetched?.onboardingProgress,
    });

  } catch (error) {
    console.error("Error updating profile:", error);
  }
}

main();
