import { jsonrepair } from "jsonrepair";

/** Strip markdown fences and isolate the outermost JSON object/array payload. */
export function extractJsonPayload(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    text = fenced[1].trim();
  }

  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  let start = -1;

  if (objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart)) {
    start = objectStart;
  } else if (arrayStart >= 0) {
    start = arrayStart;
  }

  if (start > 0) {
    text = text.slice(start);
  }

  return text.trim();
}

function tryParseJson<T>(payload: string): T {
  return JSON.parse(payload) as T;
}

function repairAndParseJson<T>(payload: string, label: string): T {
  try {
    return tryParseJson<T>(payload);
  } catch (parseErr) {
    try {
      return tryParseJson<T>(jsonrepair(payload));
    } catch (repairErr) {
      const parseMsg =
        parseErr instanceof Error ? parseErr.message : String(parseErr);
      const repairMsg =
        repairErr instanceof Error ? repairErr.message : String(repairErr);
      throw new Error(
        `${label}: could not parse JSON from AI response (${parseMsg}; repair: ${repairMsg})`,
      );
    }
  }
}

export function parseAiJson<T>(raw: string, label: string): T {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${label}: AI returned empty content`);
  }

  const payload = extractJsonPayload(trimmed);
  if (!payload) {
    throw new Error(`${label}: could not extract JSON from AI response`);
  }

  return repairAndParseJson<T>(payload, label);
}

export function isJsonParseError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "SyntaxError" ||
    /JSON|parse|could not parse JSON|truncated/i.test(err.message)
  );
}
