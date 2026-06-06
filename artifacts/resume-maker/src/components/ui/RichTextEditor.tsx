import { memo, useCallback, useRef, useState, useEffect } from "react";
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
  // Keep local track of the editor's value to avoid cursor jumping and race conditions
  const [editorValue, setEditorValue] = useState(value);
  const lastUserValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync internal editor state when the external value prop changes
  useEffect(() => {
    // Only update if the external value differs from what we last sent/processed
    if (value !== lastUserValueRef.current) {
      setEditorValue(value);
      lastUserValueRef.current = value;
    }
  }, [value]);

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (html: string, delta: any, source: string) => {
      // Update local state immediately so ReactQuill doesn't see a mismatch on rerender
      setEditorValue(html);

      const sanitized = sanitizeResumeRichHtml(html);

      // Update our record of the last processed value
      lastUserValueRef.current = sanitized;

      // Pass the sanitized value to the parent
      onChangeRef.current(sanitized);
    },
    [],
  );

  return (
    <div className={`rich-text-container ${className || ""}`}>
      <ReactQuill
        theme="snow"
        value={editorValue}
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
      />
    </div>
  );
});
