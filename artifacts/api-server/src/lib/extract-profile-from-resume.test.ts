import assert from "node:assert/strict";
import { extractProfileFromResumeSections } from "./extract-profile-from-resume.js";
import { plainTextToRichHtml, richHtmlToMultilineText } from "./rich-text.js";

function testSummaryHtmlBecomesPlainText() {
  const quill =
    '<p><span style="color: rgb(0,0,0);">Senior <strong>Software&nbsp;Engineer</strong> with 8+ years.</span></p>' +
    "<p><br></p>" +
    "<ul><li>Led a team of 5</li><li>Cut cost by 25% &amp; latency by 40%</li></ul>";

  const { aboutMe } = extractProfileFromResumeSections([
    { type: "summary", content: { text: quill } },
  ]);

  assert.equal(
    aboutMe,
    "Senior Software Engineer with 8+ years.\n\nLed a team of 5\nCut cost by 25% & latency by 40%",
  );
  assert.equal(/<[a-z]/i.test(aboutMe), false);
}

function testPlainSummaryIsUntouched() {
  const typed = "Product designer.\nTen years in fintech. Cut load time < 2s.";
  const { aboutMe } = extractProfileFromResumeSections([
    { type: "summary", content: { text: typed } },
  ]);
  assert.equal(aboutMe, typed);
}

function testBulletsStayRichButDescriptionIsPlain() {
  const { experience } = extractProfileFromResumeSections([
    {
      type: "experience",
      content: {
        items: [
          {
            company: "Acme",
            title: "Engineer",
            bullets: ["<p>Built <em>APIs</em></p>", "<p>Reduced latency by 40%</p>"],
          },
        ],
      },
    },
  ]);

  assert.deepEqual(experience[0].bullets, [
    "<p>Built <em>APIs</em></p>",
    "<p>Reduced latency by 40%</p>",
  ]);
  assert.equal(experience[0].description, "Built APIs\nReduced latency by 40%");
}

function testSummaryRoundTripsBackToHtml() {
  const html = "<p>First paragraph.</p><p>Second paragraph.</p>";
  const text = richHtmlToMultilineText(html);
  assert.equal(text, "First paragraph.\n\nSecond paragraph.");
  assert.equal(plainTextToRichHtml(text), html);
}

function run() {
  testSummaryHtmlBecomesPlainText();
  testPlainSummaryIsUntouched();
  testBulletsStayRichButDescriptionIsPlain();
  testSummaryRoundTripsBackToHtml();
  console.log("extract-profile-from-resume tests passed");
}

run();
