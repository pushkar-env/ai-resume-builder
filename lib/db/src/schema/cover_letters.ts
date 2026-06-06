import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { resumesTable } from "./resumes";

export const coverLettersTable = pgTable("cover_letters", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  resumeId: integer("resume_id")
    .references(() => resumesTable.id, { onDelete: "set null" }),
  jobTitle: text("job_title"),
  companyName: text("company_name"),
  hiringManagerName: text("hiring_manager_name"),
  companyLocation: text("company_location"),
  generatedContent: text("generated_content"),
  customInstructions: text("custom_instructions"),
  jobDescription: text("job_description"),
  templateId: text("template_id").notNull().default("classic"),
  tone: text("tone").notNull().default("professional"),
  fontFamily: text("font_family").notNull().default("sans"),
  accentColor: text("accent_color").notNull().default("#1e3a8a"),
  experienceLevel: text("experience_level"),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  senderPhone: text("sender_phone"),
  senderLocation: text("sender_location"),
  isArchived: boolean("is_archived").notNull().default(false),
  atsScore: integer("ats_score"),
  atsPassedChecks: jsonb("ats_passed_checks"),
  atsFailedChecks: jsonb("ats_failed_checks"),
  atsFeedback: jsonb("ats_feedback"),
  atsKeywords: jsonb("ats_keywords"),
  atsUpdatedAt: timestamp("ats_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const coverLetterVersionsTable = pgTable("cover_letter_versions", {
  id: serial("id").primaryKey(),
  coverLetterId: integer("cover_letter_id")
    .notNull()
    .references(() => coverLettersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  jobTitle: text("job_title"),
  companyName: text("company_name"),
  hiringManagerName: text("hiring_manager_name"),
  companyLocation: text("company_location"),
  generatedContent: text("generated_content"),
  customInstructions: text("custom_instructions"),
  jobDescription: text("job_description"),
  templateId: text("template_id").notNull().default("classic"),
  tone: text("tone").notNull().default("professional"),
  fontFamily: text("font_family").notNull().default("sans"),
  accentColor: text("accent_color").notNull().default("#1e3a8a"),
  experienceLevel: text("experience_level"),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  senderPhone: text("sender_phone"),
  senderLocation: text("sender_location"),
  generationMetadata: jsonb("generation_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCoverLetterSchema = createInsertSchema(coverLettersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCoverLetter = z.infer<typeof insertCoverLetterSchema>;
export type CoverLetter = typeof coverLettersTable.$inferSelect;

export const insertCoverLetterVersionSchema = createInsertSchema(coverLetterVersionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCoverLetterVersion = z.infer<typeof insertCoverLetterVersionSchema>;
export type CoverLetterVersion = typeof coverLetterVersionsTable.$inferSelect;
