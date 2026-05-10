const fs = require('fs');
let content = fs.readFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', 'utf8');

// Replace dangerouslySetInnerHTML span inside BulletContent to a div
content = content.replace(
    /<span dangerouslySetInnerHTML={{ __html: text }} \/>/g, 
    '<div dangerouslySetInnerHTML={{ __html: text }} className="inline [&>p]:inline [&>p]:m-0" />'
);

// Replace exactly the <p> that wraps <BulletContent /> with <div>
// We only match up to `<Bullet` to avoid crossing nodes.
let count = 0;
content = content.replace(/<p([^>]*)>([^<]*)<BulletContent([^>]+)>([^<]*)<\/p>/g, (match, p1, p2, p3, p4) => {
    count++;
    return `<div${p1}>${p2}<BulletContent${p3}>${p4}</div>`;
});

fs.writeFileSync('artifacts/resume-maker/src/components/resume/ResumePreview.tsx', content);
console.log(`Replaced ${count} BulletContent containers.`);
