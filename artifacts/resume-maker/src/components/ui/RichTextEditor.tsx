import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const modules = {
  toolbar: [
    ["bold", "italic"],
    ["clean"],
  ],
};

const formats = ["bold", "italic"];

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  return (
    <div className={`rich-text-container ${className || ""}`}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
      />
    </div>
  );
}
