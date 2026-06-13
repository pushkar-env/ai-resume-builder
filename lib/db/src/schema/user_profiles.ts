import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  photo: text("photo"), // URL or base64 data URL
  jobTitle: text("job_title"),
  location: text("location"),
  socials: jsonb("socials").$type<{ label: string; url: string }[]>().default([]),
  aboutMe: text("about_me"),
  yearsOfExperience: integer("years_of_experience"),
  experience: jsonb("experience").$type<{
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    location: string;
    description: string;
    currentlyWorking: boolean;
    bullets?: string[];
  }[]>().default([]),
  skills: jsonb("skills").$type<string[]>().default([]),
  projects: jsonb("projects").$type<{
    name: string;
    description: string;
    technologiesUsed?: string;
    url?: string;
    github?: string;
    bullets?: string[];
  }[]>().default([]),
  certifications: jsonb("certifications").$type<{
    name: string;
    issuer: string;
    date: string;
    credentialUrl?: string;
  }[]>().default([]),
  education: jsonb("education").$type<{
    school: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    gpa: string;
    gpaMode: string;
  }[]>().default([]),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  onboardingSkipped: boolean("onboarding_skipped").default(false).notNull(),
  onboardingProgress: integer("onboarding_progress").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
