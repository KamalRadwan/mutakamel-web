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
  console.log('=== Oversized buttons in', portal, '===');
  let oversized = [];
  files.forEach(f => {
    const norm = f.replace(/\\/g, '/');
    if (norm.includes('.test.') || norm.includes('design-system/primitives/Button.tsx')) return;
    const content = fs.readFileSync(f, 'utf8');
    const regex = /<Button\b([^>]*?)(\/?>)/gs;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const attrs = match[1];
      if (/size=["'](md|lg|xl)["']/.test(attrs)) {
        const line = content.substring(0, match.index).split('\n').length;
        oversized.push({ file: norm, line, tag: match[0].replace(/\s+/g, ' ') });
      }
    }
  });
  console.log('Oversized buttons:', oversized.length);
  oversized.forEach(d => console.log('  ' + d.file + ':' + d.line + ' -> ' + d.tag));
});
