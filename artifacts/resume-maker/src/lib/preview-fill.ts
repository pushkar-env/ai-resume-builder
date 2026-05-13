import type { ResumeDetail } from "@workspace/api-client-react";

type SectionRow = NonNullable<ResumeDetail["sections"]>[number];

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** True if rich-text or plain string has no visible text. */
export function isEffectivelyEmptyString(s: unknown): boolean {
  if (typeof s !== "string") return true;
  const text = s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0;
}

/**
 * Overlay user content onto sample content for preview-only rendering.
 * User values win when non-empty; otherwise sample filler is shown.
 */
export function overlayUserOntoSample(sample: unknown, user: unknown): unknown {
  if (user === undefined || user === null) return sample;
  if (sample === undefined || sample === null) {
    if (typeof user === "object" && user !== null) return deepClone(user);
    return user;
  }
  if (typeof user === "string") {
    return isEffectivelyEmptyString(user) ? sample : user;
  }
  if (typeof user === "number" || typeof user === "boolean") return user;

  if (Array.isArray(user)) {
    if (user.length === 0) return sample;
    const sampleArr = Array.isArray(sample) ? sample : [];
    return user.map((u, i) => {
      const s = i < sampleArr.length ? sampleArr[i] : undefined;
      if (u && typeof u === "object" && !Array.isArray(u)) {
        const base =
          s && typeof s === "object" && !Array.isArray(s)
            ? deepClone(s as Record<string, unknown>)
            : {};
        return overlayUserOntoSample(base, u);
      }
      return overlayUserOntoSample(s, u);
    });
  }

  if (typeof user === "object") {
    const sampleObj =
      typeof sample === "object" && sample !== null && !Array.isArray(sample)
        ? deepClone(sample as Record<string, unknown>)
        : {};
    const userObj = user as Record<string, unknown>;
    const out: Record<string, unknown> = { ...sampleObj };
    for (const key of Object.keys(userObj)) {
      out[key] = overlayUserOntoSample(sampleObj[key], userObj[key]);
    }
    return out;
  }

  return user;
}

export function buildPreviewSections(
  localSections: SectionRow[],
  sampleResume: ResumeDetail,
  previewAutoFill: boolean,
): SectionRow[] {
  // Off: preview is exactly what you have in the editor (no sample merge). Updates live with edits.
  if (!previewAutoFill) {
    return localSections.map((s) => ({
      ...s,
      content: deepClone(s.content as Record<string, unknown>),
    }));
  }

  const sampleByType = new Map(
    (sampleResume.sections ?? []).map((sec: SectionRow) => [sec.type, sec.content as Record<string, unknown>]),
  );

  return localSections.map((s) => {
    const sampleContent = sampleByType.get(s.type);
    if (!sampleContent) {
      return { ...s, content: deepClone(s.content as Record<string, unknown>) };
    }
    return {
      ...s,
      content: overlayUserOntoSample(
        deepClone(sampleContent),
        s.content,
      ) as Record<string, unknown>,
    };
  });
}
