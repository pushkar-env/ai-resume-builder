const fs = require('fs');
const path = './artifacts/resume-maker/src/components/resume/ResumePreview.tsx';

let content = fs.readFileSync(path, 'utf8');

// Fix EuropeanTemplate flex bleed
content = content.replace(
  '          <div className="flex-1 px-6 py-4">',
  '          <div className="flex-1 min-w-0 px-6 py-4">'
);

// Fix AtsCleanTemplate bullet point
content = content.replace(
  /<div key=\{j\} className="text-\[8\.5px\] text-gray-700 leading-relaxed ml-3">• <BulletContent b=\{b\} color=\{color\} \/><\/div>/g,
  '<div key={j} className="flex gap-1.5 text-[8.5px] text-gray-700 leading-relaxed ml-3"><span className="shrink-0 font-bold">•</span><div className="flex-1 min-w-0"><BulletContent b={b} color={color} /></div></div>'
);

// Fix AcademicTemplate bullet point
content = content.replace(
  /<div key=\{j\} className="text-\[8\.5px\] text-gray-700 ml-3 mt-0\.5">• <BulletContent b=\{b\} color=\{color\} \/><\/div>/g,
  '<div key={j} className="flex gap-1.5 text-[8.5px] text-gray-700 ml-3 mt-0.5"><span className="shrink-0 font-bold">•</span><div className="flex-1 min-w-0"><BulletContent b={b} color={color} /></div></div>'
);

// Fix CompactTemplate bullet point (uses middot ·)
content = content.replace(
  /<div key=\{j\} className="text-\[8px\] text-gray-600 leading-\[1\.5\] ml-1">· <BulletContent b=\{b\} color=\{color\} \/><\/div>/g,
  '<div key={j} className="flex gap-1.5 text-[8px] text-gray-600 leading-[1.5] ml-1"><span className="shrink-0 font-bold">·</span><div className="flex-1 min-w-0"><BulletContent b={b} color={color} /></div></div>'
);

fs.writeFileSync(path, content);
console.log('done');
