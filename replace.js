const fs = require('fs');
let content = fs.readFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', 'utf8');

content = content.replace(/<p\s+className=([^>]+)>\{str\(summary\.text\)\}<\/p>/g, '<div className=$1 dangerouslySetInnerHTML={{ __html: str(summary.text) }} />');
content = content.replace(/<p\s+className=([^>]+)>\{str\(item\.description\)\}<\/p>/g, '<div className=$1 dangerouslySetInnerHTML={{ __html: str(item.description) }} />');
content = content.replace(/<p\s+className=([^>]+)>\{str\(p\.description\)\}<\/p>/g, '<div className=$1 dangerouslySetInnerHTML={{ __html: str(p.description) }} />');

// also replace BulletContent
content = content.replace(/<>[\s\n]*\{text\}[\s\n]*\{link \?/g, '<>\n      <span dangerouslySetInnerHTML={{ __html: text }} />\n      {link ?');

fs.writeFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', content);
console.log('done');
