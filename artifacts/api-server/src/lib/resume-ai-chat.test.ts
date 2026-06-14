import assert from "node:assert/strict";
import {
  extractJsonPayload,
  parseAiJson,
} from "./resume-ai-json.js";

function testExtractJsonPayload() {
  const fenced = 'Here is the result:\n```json\n{"sections":[],"summary":"ok"}\n```';
  assert.equal(
    extractJsonPayload(fenced),
    '{"sections":[],"summary":"ok"}',
  );
}

function testParseAiJsonRepairsTrailingComma() {
  const raw = '{"sections":[{"id":1,"type":"summary","title":"Summary","content":{"text":"Hello"}}],"summary":"done",}';
  const parsed = parseAiJson<{ sections: unknown[]; summary: string }>(
    raw,
    "test-trailing-comma",
  );
  assert.equal(parsed.summary, "done");
  assert.equal(Array.isArray(parsed.sections), true);
}

function testParseAiJsonRepairsTruncatedArray() {
  const truncated =
    '{"sections":[{"id":2,"type":"experience","title":"Work Experience","content":{"items":[{"title":"Engineer","company":"Acme","bullets":["Built APIs","Reduced latency by 40%","Led team of 5"';
  const parsed = parseAiJson<{ sections: unknown[] }>(truncated, "test-truncated");
  assert.ok(Array.isArray(parsed.sections));
}

function run() {
  testExtractJsonPayload();
  testParseAiJsonRepairsTrailingComma();
  testParseAiJsonRepairsTruncatedArray();
  console.log("resume-ai-chat JSON parsing tests passed");
}

run();
