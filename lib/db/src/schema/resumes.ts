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

export const resumesTable = pgTable("resumes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  templateId: text("template_id").notNull().default("modern"),
  accentColor: text("accent_color").notNull().default("#6366f1"),
  fontFamily: text("font_family").notNull().default("Inter"),
  fontColor: text("font_color").notNull().default("#111827"),
  backgroundColor: text("background_color").notNull().default("#ffffff"),
  isPublic: boolean("is_public").notNull().default(false),
  shareToken: text("share_token"),
  viewCount: integer("view_count").notNull().default(0),
  downloadCount: integer("download_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const resumeSectionsTable = pgTable("resume_sections", {
  id: serial("id").primaryKey(),
  resumeId: integer("resume_id")
    .notNull()
    .references(() => resumesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // personal, summary, experience, education, skills, projects, certifications, achievements, social, custom
  title: text("title").notNull(),
  content: jsonb("content").notNull().default({}),
  displayOrder: integer("display_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertResumeSchema = createInsertSchema(resumesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  downloadCount: true,
  shareToken: true,
});
export type InsertResume = z.infer<typeof insertResumeSchema>;
export type Resume = typeof resumesTable.$inferSelect;

export const insertResumeSectionSchema = createInsertSchema(
  resumeSectionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertResumeSection = z.infer<typeof insertResumeSectionSchema>;
export type ResumeSection = typeof resumeSectionsTable.$inferSelect;
