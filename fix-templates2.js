const fs = require('fs');
const path = './artifacts/resume-maker/src/components/resume/ResumePreview.tsx';

let content = fs.readFileSync(path, 'utf8');

// Fix EuropeanTemplate flex bleed
content = content.replace(
  '<div className="flex-1 px-6 py-4">',
  '<div className="flex-1 min-w-0 px-6 py-4">'
);

fs.writeFileSync(path, content);
console.log('done');
