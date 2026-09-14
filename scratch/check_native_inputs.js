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

['admin-portal/src', 'tenant-portal/src'].forEach(portal => {
  const files = walk(portal);
  console.log('=== Native inputs in', portal, '===');
  let native = [];
  files.forEach(f => {
    const norm = f.replace(/\\/g, '/');
    if (norm.includes('.test.') || norm.includes('components/auth/AuthShell') || norm.includes('design-system/primitives/')) return;
    const content = fs.readFileSync(f, 'utf8');
    const regex = /<(input|textarea)\b([^>]*?)(\/?>)/gs;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const type = match[1];
      const attrs = match[2];
      if (attrs.includes('type="hidden"') || attrs.includes('type="file"') || attrs.includes('type="checkbox"') || attrs.includes('type="radio"') || attrs.includes('type="color"') || attrs.includes('type="range"')) continue;
      const line = content.substring(0, match.index).split('\n').length;
      native.push({ file: norm, line, tag: match[0].replace(/\s+/g, ' ') });
    }
  });
  console.log('Native text inputs:', native.length);
  native.forEach(d => console.log('  ' + d.file + ':' + d.line + ' -> ' + d.tag));
});
