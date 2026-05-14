import { isDarkBackgroundColor } from "@/lib/color-luminance";

const MASCOT = `${import.meta.env.BASE_URL}bluemascot.svg`;

/**
 * Minimal footer brand mark for Free-plan resume previews and exports (PDF via print).
 * Sits at the bottom of the A4 canvas for every template.
 */
export function ResumeWatermark({ backgroundColor }: { backgroundColor: string }) {
  const dark = isDarkBackgroundColor(backgroundColor);

  return (
    <footer
      data-resume-watermark
      className={
        dark
          ? "shrink-0 w-full border-t border-white/10 bg-black/25 px-4 py-2 sm:px-6 sm:py-2.5"
          : "shrink-0 w-full border-t border-black/[0.07] bg-gradient-to-b from-black/[0.02] to-black/[0.04] px-4 py-2 sm:px-6 sm:py-2.5"
      }
      aria-label="ResumeSensei brand watermark"
    >
      <div className="mx-auto flex max-w-[720px] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <div className="flex items-center gap-2">
          <img
            src={MASCOT}
            alt=""
            className={`h-4 w-4 shrink-0 object-contain opacity-80 ${dark ? "brightness-110" : ""}`}
            width={16}
            height={16}
            aria-hidden
          />
          <span
            className={`text-[9px] font-semibold tracking-tight sm:text-[10px] ${dark ? "text-white/80" : "text-foreground/55"}`}
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            ResumeSensei
          </span>
        </div>
        <span className={`hidden h-3 w-px shrink-0 sm:block ${dark ? "bg-white/20" : "bg-foreground/12"}`} aria-hidden />
        <span className={`text-[7px] font-medium uppercase tracking-[0.18em] sm:text-[8px] ${dark ? "text-white/45" : "text-muted-foreground/80"}`}>
          Free plan
        </span>
        <span className={`hidden text-[7px] sm:inline sm:text-[8px] ${dark ? "text-white/35" : "text-muted-foreground/60"}`} aria-hidden>
          ·
        </span>
        <a
          href="https://resumesensei.com"
          target="_blank"
          rel="noreferrer noopener"
          className={`text-[7px] font-medium tracking-wide underline-offset-2 hover:underline sm:text-[8px] ${dark ? "text-white/50 hover:text-white/80" : "text-primary/80 hover:text-primary"}`}
        >
          resumesensei.com
        </a>
      </div>
    </footer>
  );
}
