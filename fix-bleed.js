const fs = require('fs');
let content = fs.readFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', 'utf8');

// 1. Rewrite BulletContent to use flex-wrap instead of inline, fixing all word wrapping and bleeding
content = content.replace(/function BulletContent\(\{ b, color \}: \{ b: unknown; color: string \}\) \{[\s\S]*?return \([\s\S]*?className="underline underline-offset-2 font-semibold"[\s\S]*?<\/a>\n\s*\)\}\n\s*<\/>\n\s*\);\n\}/, 
`function BulletContent({ b, color }: { b: unknown; color: string }) {
  const { text, label, link } = bulletParts(b);
  if (!text && !label && !link) return null;
  return (
    <div className="flex flex-wrap gap-x-1 items-baseline">
      <div dangerouslySetInnerHTML={{ __html: text }} className="[&>p]:inline [&>p]:m-0" />
      {link && (
        <a href={ensureProto(link)} target="_blank" rel="noreferrer noopener"
              className="underline underline-offset-2 font-semibold">
          {label || link.replace(/^https?:\\/\\//, "")}
        </a>
      )}
    </div>
  );
}`);

// 2. Add flex-1 min-w-0 to all parent divs of <BulletContent> if they don't have it
content = content.replace(/<div([^>]*)>(\s*)<BulletContent/g, (match, p1, p2) => {
    // If it already has flex-1, don't add it again
    if (p1.includes('flex-1')) {
        return match;
    }
    // Add flex-1 min-w-0 to the className
    if (p1.includes('className="')) {
        return `<div${p1.replace('className="', 'className="flex-1 min-w-0 ')}>${p2}<BulletContent`;
    }
    return `<div${p1} className="flex-1 min-w-0">${p2}<BulletContent`;
});

// 3. Remove word-break completely from CSS and just use standard wrapping to prevent any weird word splitting
content = content.replace(
    /word-break: normal;\s*overflow-wrap: break-word;/g,
    'overflow-wrap: break-word; word-wrap: break-word;'
);

fs.writeFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', content);

let cssContent = fs.readFileSync('artifacts/resume-maker/src/index.css', 'utf8');
cssContent = cssContent.replace(
    /word-break: normal;\s*overflow-wrap: break-word;/g,
    'overflow-wrap: break-word; word-wrap: break-word;'
);
fs.writeFileSync('artifacts/resume-maker/src/index.css', cssContent);

console.log('done');
