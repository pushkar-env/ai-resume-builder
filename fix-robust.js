const fs = require('fs');

// 1. Fix ResumePreview.tsx
let preview = fs.readFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', 'utf8');

// Replace overflowWrap: 'break-word' with 'anywhere'
preview = preview.replace(/overflowWrap: 'break-word'/g, "overflowWrap: 'anywhere'");

// Replace overflow-wrap: break-word; in .a4-page
preview = preview.replace(/overflow-wrap: break-word;/g, "overflow-wrap: anywhere;");

// Make sure bullet content wrapper div doesn't force a minimum width
preview = preview.replace(
    /className="flex flex-col gap-1 w-full"/g,
    'className="flex flex-col gap-1 w-full min-w-0"'
);

fs.writeFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', preview);

// 2. Fix index.css
let css = fs.readFileSync('artifacts/resume-maker/src/index.css', 'utf8');

// Ensure rich-text-container constraints
if (!css.includes('.rich-text-container {')) {
    css += `\n.rich-text-container {\n  max-width: 100%;\n  width: 100%;\n  min-width: 0;\n}\n`;
}
if (!css.includes('.ql-container {')) {
    css += `\n.ql-container {\n  max-width: 100%;\n  width: 100%;\n}\n`;
}

// Replace ql-editor rules
css = css.replace(
    /overflow-wrap: break-word;\s*word-wrap: break-word;/g,
    'overflow-wrap: anywhere; word-break: normal;'
);

// Add max-width constraint to ql-editor
css = css.replace(
    /\.ql-editor \{/g,
    '.ql-editor {\n    max-width: 100%;\n    min-width: 0;'
);

fs.writeFileSync('artifacts/resume-maker/src/index.css', css);

console.log('done');
