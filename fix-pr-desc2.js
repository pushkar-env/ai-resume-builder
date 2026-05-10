const fs = require('fs');
let content = fs.readFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', 'utf8');

// Replace standard <p className="...">...{str(pr.description)}...</p> cases
content = content.replace(
    /<p([^>]*)>\{str\(pr\.description\)\}<\/p>/g, 
    '<div$1 dangerouslySetInnerHTML={{ __html: str(pr.description) }} />'
);

fs.writeFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', content);
console.log('done');
