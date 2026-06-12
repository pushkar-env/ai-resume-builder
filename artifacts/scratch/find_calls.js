const fs = require('fs');
const path = require('path');

const filePath = 'd:/Projects/backend/AI-Resume-Builder/artifacts/resume-maker/src/pages/onboarding.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("=== CALLS TO handleFieldChange ===");
lines.forEach((line, idx) => {
  if (line.includes('handleFieldChange')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("\n=== CALLS TO updateProfile ===");
lines.forEach((line, idx) => {
  if (line.includes('updateProfile')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("\n=== CALLS TO triggerAutoSave ===");
lines.forEach((line, idx) => {
  if (line.includes('triggerAutoSave')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
