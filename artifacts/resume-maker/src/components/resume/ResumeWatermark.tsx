import { isDarkBackgroundColor } from "@/lib/color-luminance";

/**
 * Minimal footer for Free-plan previews and PDF (print) export — plain text + site link only.
 */
export function ResumeWatermark({ backgroundColor }: { backgroundColor: string }) {
  const dark = isDarkBackgroundColor(backgroundColor);

  return (
    <footer
      data-resume-watermark
      className="shrink-0 w-full px-3 py-1 sm:px-6 sm:py-1.5 flex justify-center items-center"
      aria-label="Resume created at resumesensei.com"
    >
      <p
        className={`m-0 text-center text-[7.5px] leading-snug sm:text-[8.5px] max-w-full break-words ${
          dark ? "text-white/40" : "text-muted-foreground/75"
        }`}
      >
        <span className={dark ? "text-white/35" : "text-muted-foreground/70"}>Created at </span>
        <a
          href="https://resumesensei.com"
          target="_blank"
          rel="noreferrer noopener"
          className={
            dark
              ? "font-medium text-white/55 underline-offset-2 hover:text-white/80 hover:underline"
              : "font-medium text-primary/75 underline-offset-2 hover:text-primary hover:underline"
          }
        >
          resumesensei.com
        </a>
      </p>
    </footer>
  );
}
