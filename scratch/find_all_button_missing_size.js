const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        results = results.concat(walk(fullPath));
      }
    } else if (file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

function extractTags(content, tagName) {
  const tags = [];
  const regex = new RegExp('<' + tagName + '(?=[\\s/>])', 'g');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const startIndex = match.index;
    let i = startIndex + tagName.length + 1;
    let depth = 0;
    let inQuote = null;
    let inLineComment = false;
    let inBlockComment = false;

    while (i < content.length) {
      const char = content[i];
      const prev = content[i - 1];

      if (inQuote) {
        if (char === inQuote && prev !== '\\') inQuote = null;
      } else if (inLineComment) {
        if (char === '\n') inLineComment = false;
      } else if (inBlockComment) {
        if (char === '/' && prev === '*') inBlockComment = false;
      } else {
        if (char === '/' && content[i + 1] === '/') {
          inLineComment = true;
          i++;
        } else if (char === '/' && content[i + 1] === '*') {
          inBlockComment = true;
          i++;
        } else if (char === '"' || char === "'" || char === '`') {
          inQuote = char;
        } else if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
        } else if (char === '>' && depth === 0) {
          tags.push({
            fullTag: content.slice(startIndex, i + 1),
            line: content.slice(0, startIndex).split('\n').length,
            startIndex,
            endIndex: i + 1
          });
          break;
        }
      }
      i++;
    }
  }
  return tags;
}

['admin-portal/src', 'tenant-portal/src'].forEach(portal => {
  const files = walk(portal);
  console.log(`=== ${portal} ===`);
  const missing = [];
  files.forEach(f => {
    const norm = f.replace(/\\/g, '/');
    if (norm.includes('.test.') || norm.includes('primitives/Button.tsx')) return;
    const content = fs.readFileSync(f, 'utf8');
    const buttons = extractTags(content, 'Button');
    buttons.forEach(b => {
      if (!b.fullTag.includes('size=')) {
        missing.push({ file: norm, line: b.line, tag: b.fullTag.replace(/\s+/g, ' ') });
      }
    });
  });
  console.log(`Total Button lacking size in ${portal}: ${missing.length}`);
  missing.forEach(m => console.log(`  ${m.file}:${m.line} -> ${m.tag.slice(0, 80)}`));
});
