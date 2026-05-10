const fs = require('fs');
let content = fs.readFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', 'utf8');

// Replace standard <p className="...">...{str(pr.description)}...</p> cases
content = content.replace(
    /\{str\(pr\.description\)\}\s*&&\s*<p\s+className=([^>]+)>\{str\(pr\.description\)\}<\/p>/g, 
    '{str(pr.description) && <div className=$1 dangerouslySetInnerHTML={{ __html: str(pr.description) }} />}'
);

// Replace <span>- {str(pr.description)}</span>
content = content.replace(
    /<span\s+className="([^"]+)">-\s*\{str\(pr\.description\)\}<\/span>/g,
    '<div className="$1 inline [&>p]:inline [&>p]:m-0" dangerouslySetInnerHTML={{ __html: " - " + str(pr.description) }} />'
);

// Replace AtsCleanTemplate:
// <p key={i} className="text-[8.5px] text-gray-700 mb-0.5"><strong>{str(pr.name)}</strong>{str(pr.description) ? ` - ${str(pr.description)}` : ""}</p>
content = content.replace(
    /<strong>\{str\(pr\.name\)\}<\/strong>\{str\(pr\.description\)\s*\?\s*`\s*-\s*\$\{str\(pr\.description\)\}`\s*:\s*""\}<\/p>/g,
    '<strong>{str(pr.name)}</strong>{str(pr.description) ? <div className="inline [&>p]:inline [&>p]:m-0" dangerouslySetInnerHTML={{ __html: " - " + str(pr.description) }} /> : ""}</p>'
);

// Replace SiliconValleyTemplate weird case (if any) or any other <p> flex-1 cases:
content = content.replace(
    /<p\s+className="text-\[8\.5px\] text-gray-400 flex-1">\{str\(pr\.description\)\}<\/p>/g,
    '<div className="text-[8.5px] text-gray-400 flex-1" dangerouslySetInnerHTML={{ __html: str(pr.description) }} />'
);

fs.writeFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', content);
console.log('done');
