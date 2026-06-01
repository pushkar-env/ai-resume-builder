/**
 * Empty section payloads — keep in sync with `EMPTY_SECTIONS` in
 * `artifacts/api-server/src/routes/resumes.ts` (POST /resumes when startPrefilled is false).
 */
export function emptySectionContentForType(
  type: string,
): Record<string, unknown> {
  switch (type) {
    case "personal":
      return {
        name: "",
        jobTitle: "",
        title: "",
        email: "",
        phone: "",
        location: "",
        photo: "",
        socials: [],
      };
    case "summary":
      return { text: "" };
    case "experience":
      return { items: [] };
    case "education":
      return { items: [] };
    case "skills":
      return { items: [] };
    case "projects":
      return { items: [] };
    case "certifications":
      return { items: [] };
    default:
      return {};
  }
}
