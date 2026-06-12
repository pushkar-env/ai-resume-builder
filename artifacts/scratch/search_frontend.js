const fs = require('fs');
const path = require('path');

const srcDir = 'd:/Projects/backend/AI-Resume-Builder/artifacts/resume-maker/src';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(srcDir);
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('useUpdateProfile') || line.includes('updateProfile')) {
      const relPath = path.relative(srcDir, file);
      console.log(`${relPath}:${idx + 1}: ${line.trim()}`);
    }
  });
});
