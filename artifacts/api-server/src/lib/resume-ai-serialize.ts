import { clipAiInput } from "./resume-ai-chat";

type SectionRow = {
  id: number;
  type: string;
  title: string;
  content: unknown;
  isVisible?: boolean;
};

function bulletText(b: unknown): string {
  if (typeof b === "string") return b.trim();
  if (b && typeof b === "object" && "text" in b) {
    return String((b as { text?: string }).text ?? "").trim();
  }
  return "";
}

/** Compact resume text for ATS / analysis prompts (smaller = faster + cheaper). */
export function formatSectionsForAiAnalysis(sections: SectionRow[]): string {
  const parts: string[] = [];

  for (const s of sections) {
    if (s.isVisible === false) continue;
    const c = s.content as Record<string, unknown> | null;
    if (!c) continue;

    if (s.type === "personal") {
      const socials = Array.isArray(c.socials)
        ? (c.socials as { label?: string; url?: string }[])
            .map((x) => `${x.label ?? ""}: ${x.url ?? ""}`)
            .filter(Boolean)
            .join(", ")
        : "";
      parts.push(
        `## Personal\nName: ${c.name ?? ""}\nRole: ${c.jobTitle ?? c.title ?? ""}\nEmail: ${c.email ?? ""}\nPhone: ${c.phone ?? ""}\nLocation: ${c.location ?? ""}\nLinks: ${socials}`,
      );
      continue;
    }

    if (s.type === "summary") {
      const text = String(c.text ?? "").replace(/<[^>]+>/g, " ").trim();
      if (text) parts.push(`## Summary\n${clipAiInput(text, 1_200)}`);
      continue;
    }

    if (s.type === "skills") {
      const items = Array.isArray(c.items) ? c.items : [];
      const names = items
        .map((i) =>
          typeof i === "string" ? i : String((i as { name?: string })?.name ?? ""),
        )
        .filter(Boolean);
      if (names.length) parts.push(`## Skills\n${names.join(", ")}`);
      continue;
    }

    if (
      s.type === "experience" ||
      s.type === "education" ||
      s.type === "projects" ||
      s.type === "certifications"
    ) {
      const items = Array.isArray(c.items) ? c.items : [];
      const blocks = items.slice(0, 12).map((item) => {
        const row = item as Record<string, unknown>;
        const title =
          row.title || row.role || row.school || row.name || row.degree || "";
        const org = row.company || row.school || row.issuer || "";
        const dates = [row.startDate, row.endDate].filter(Boolean).join(" – ");
        const bullets = Array.isArray(row.bullets)
          ? row.bullets
              .map(bulletText)
              .filter(Boolean)
              .slice(0, 8)
              .map((b) => `• ${clipAiInput(b, 280)}`)
              .join("\n")
          : "";
        const desc = row.description
          ? clipAiInput(String(row.description), 300)
          : "";
        return [
          title ? `- ${title}${org ? ` @ ${org}` : ""}` : "",
          dates ? `  ${dates}` : "",
          desc,
          bullets,
        ]
          .filter(Boolean)
          .join("\n");
      });
      if (blocks.length) {
        parts.push(`## ${s.title || s.type}\n${blocks.join("\n")}`);
      }
    }
  }

  return clipAiInput(parts.join("\n\n"), 7_500);
}

/** Smaller JSON payload for optimize calls — drops empty fields and caps list sizes. */
export function compactSectionsForOptimize(
  sections: SectionRow[],
): { id: number; type: string; title: string; content: unknown }[] {
  return sections.map((s) => {
    const c = s.content as Record<string, unknown>;
    if (s.type === "summary") {
      const text = String(c?.text ?? "")
        .replace(/<[^>]+>/g, " ")
        .trim();
      return { id: s.id, type: s.type, title: s.title, content: { text: clipAiInput(text, 1_500) } };
    }
    if (s.type === "skills") {
      const items = Array.isArray(c?.items) ? c.items : [];
      return {
        id: s.id,
        type: s.type,
        title: s.title,
        content: {
          style: c?.style ?? "chips",
          items: items.slice(0, 24).map((i) =>
            typeof i === "string" ? { name: i } : { name: (i as { name?: string })?.name ?? "" },
          ),
        },
      };
    }
    if (s.type === "experience" || s.type === "projects") {
      const items = Array.isArray(c?.items) ? c.items : [];
      return {
        id: s.id,
        type: s.type,
        title: s.title,
        content: {
          items: items.slice(0, 8).map((item) => {
            const row = { ...(item as Record<string, unknown>) };
            if (Array.isArray(row.bullets)) {
              row.bullets = row.bullets
                .slice(0, 10)
                .map((b) => clipAiInput(bulletText(b), 320));
            }
            if (typeof row.description === "string") {
              row.description = clipAiInput(row.description, 400);
            }
            return row;
          }),
        },
      };
    }
    return { id: s.id, type: s.type, title: s.title, content: c };
  });
}
