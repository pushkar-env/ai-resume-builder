import { memo, useCallback, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { sanitizeResumeRichHtml } from "@/lib/sanitize-resume-rich-html";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const modules = {
  toolbar: {
    container: [
      ["bold", "italic"],
      ["undo", "redo", "clean"],
    ],
    handlers: {
      undo: function () {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).quill?.history?.undo?.();
      },
      redo: function () {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).quill?.history?.redo?.();
      },
    },
  },
  history: {
    delay: 800,
    maxStack: 200,
    userOnly: true,
  },
};

const formats = ["bold", "italic"];

export const RichTextEditor = memo(function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: RichTextEditorProps) {
  const apiUpdatesRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (html: string, delta: any, source: string) => {
      if (source === "api") {
        apiUpdatesRef.current++;
        if (apiUpdatesRef.current > 5) {
          console.warn("React-Quill API loop prevented.");
          return;
        }
        setTimeout(() => {
          apiUpdatesRef.current = Math.max(0, apiUpdatesRef.current - 1);
        }, 1000);
      } else {
        // If the user typed, always allow it and reset the API block counter
        apiUpdatesRef.current = 0;
      }
      onChangeRef.current(sanitizeResumeRichHtml(html));
    },
    []
  );

  return (
    <div className={`rich-text-container ${className || ""}`}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
      />
    </div>
  );
});
