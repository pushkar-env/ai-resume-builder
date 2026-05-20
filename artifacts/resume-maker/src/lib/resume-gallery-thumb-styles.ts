/** Scoped CSS for template gallery / carousel thumbnails (`data-template-gallery-thumb`). */
export const RESUME_GALLERY_THUMB_CSS = `
[data-template-gallery-thumb] > .resume-preview-document {
  flex: 1 1 auto;
  min-height: 0;
}
[data-template-gallery-thumb] .resume-preview-document,
[data-template-gallery-thumb] .resume-continuous-canvas {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
[data-template-gallery-thumb] .resume-continuous-canvas > .relative {
  height: 100%;
  min-height: 100%;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}
[data-template-gallery-thumb] .resume-preview-document > .flex {
  height: 100%;
  min-height: 100%;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}
[data-template-gallery-thumb] .resume-preview-document > .flex > * {
  height: 100%;
  min-height: 100%;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}
[data-template-gallery-thumb] .resume-preview-document > .flex > [data-resume-two-col-root] {
  flex: 1 1 auto;
  min-height: var(--gallery-viewport-h);
  height: 100%;
  align-items: stretch !important;
}
[data-template-gallery-thumb] .flex-col:has(> [data-resume-two-col-root]) {
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
}
[data-template-gallery-thumb] .flex-col:has(> [data-resume-two-col-root]) > [data-resume-two-col-root] {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  align-items: stretch !important;
}
[data-template-gallery-thumb] [data-resume-sidebar] {
  position: relative;
  align-self: stretch !important;
  min-height: 100% !important;
}
[data-template-gallery-thumb] [data-resume-sidebar]::before {
  content: "";
  position: absolute;
  inset: 0;
  min-height: var(--gallery-viewport-h);
  background: inherit;
  z-index: 0;
  pointer-events: none;
}
[data-template-gallery-thumb] [data-resume-sidebar] > * {
  position: relative;
  z-index: 1;
}
`;
