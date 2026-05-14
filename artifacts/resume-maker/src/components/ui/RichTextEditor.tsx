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

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  return (
    <div className={`rich-text-container ${className || ""}`}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={(html) => onChange(sanitizeResumeRichHtml(html))}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
      />
    </div>
  );
}
