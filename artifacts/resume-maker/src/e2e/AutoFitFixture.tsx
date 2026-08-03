/**
 * Test-only fixture for e2e/autofit.spec.ts.
 *
 * Mounts the real ResumePagedView so the auto-fit measurement loop and its
 * progressive compression variables can be asserted end to end.
 *
 *   ?blocks=N&lines=L    N sections of L body lines each
 *
 * The markup deliberately mirrors a real template — `px-8 py-7` page padding,
 * `resume-export-block` sections, `mb-4` gaps, an uppercase bold heading and
 * `text-[11px]` body copy — because each auto-fit phase scales a different one
 * of those (margin → spacing → heading type → body type). The measure loop only
 * re-runs when the content's height actually changes, so content that ignores a
 * phase stalls compression at that phase. Fixed-height boxes are therefore no
 * substitute for real text here.
 *
 * Reachable only via e2e/fixtures/autofit.html, which is not a production
 * build input.
 */
import { createRoot } from "react-dom/client";
import { ResumePagedView } from "../components/resume/ResumePagedView";
import "../index.css";

const params = new URLSearchParams(window.location.search);
const blocks = Number(params.get("blocks") ?? 4);
const lines = Number(params.get("lines") ?? 3);

createRoot(document.getElementById("root")!).render(
  <ResumePagedView
    showWatermark={false}
    backgroundColor="#ffffff"
    measureKey={`autofit-${blocks}-${lines}`}
  >
    <div className="w-full px-8 py-7">
      {Array.from({ length: blocks }, (_, b) => (
        <div key={b} className="resume-export-block mb-4">
          <p className="text-[12.5px] font-bold uppercase tracking-wider">
            Section {b + 1}
          </p>
          {Array.from({ length: lines }, (_, l) => (
            <p key={l} className="text-[11px] leading-relaxed">
              Delivered measurable improvements across the platform, line {l + 1}.
            </p>
          ))}
        </div>
      ))}
    </div>
  </ResumePagedView>,
);
