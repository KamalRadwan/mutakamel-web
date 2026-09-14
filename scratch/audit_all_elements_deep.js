const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        results = results.concat(walk(full));
      }
    } else if (file.endsWith('.tsx')) {
      results.push(full);
    }
  });
  return results;
}

['admin-portal/src', 'tenant-portal/src'].forEach(portal => {
  console.log('=== Checking all elements in', portal, '===');
  const files = walk(portal);
  let missingBtnSize = [];
  let oversizedBtn = [];
  let missingInputSize = [];
  let missingInputPlaceholder = [];
  let missingSelectTriggerSize = [];
  let missingTextareaPlaceholder = [];

  files.forEach(f => {
    if (f.includes('.test.tsx') || f.includes('design-system/primitives/')) return;
    const content = fs.readFileSync(f, 'utf8');

    // Button
    const btnRegex = /<Button\b([^>]*?)(\/?>)/gs;
    let match;
    while ((match = btnRegex.exec(content)) !== null) {
      const attrs = match[1];
      const line = content.substring(0, match.index).split('\n').length;
      if (!/\bsize\s*=/.test(attrs)) {
        missingBtnSize.push({ file: f, line });
      } else if (/\bsize\s*=\s*["'](md|lg|xl)["']/.test(attrs)) {
        oversizedBtn.push({ file: f, line, size: match[0] });
      }
    }

    // Input
    const inputRegex = /<Input\b([^>]*?)(\/?>)/gs;
    while ((match = inputRegex.exec(content)) !== null) {
      const attrs = match[1];
      const line = content.substring(0, match.index).split('\n').length;
      if (attrs.includes('type="file"') || attrs.includes('type="checkbox"') || attrs.includes('type="radio"')) continue;
      if (!/\bsize\s*=/.test(attrs)) {
        missingInputSize.push({ file: f, line });
      }
      if (!/\bplaceholder\s*=/.test(attrs) && !attrs.includes('type="hidden"')) {
        missingInputPlaceholder.push({ file: f, line });
      }
    }

    // SelectTrigger
    const stRegex = /<SelectTrigger\b([^>]*?)(\/?>)/gs;
    while ((match = stRegex.exec(content)) !== null) {
      const attrs = match[1];
      const line = content.substring(0, match.index).split('\n').length;
      if (!/\bsize\s*=/.test(attrs)) {
        missingSelectTriggerSize.push({ file: f, line });
      }
    }

    // Textarea
    const taRegex = /<Textarea\b([^>]*?)(\/?>)/gs;
    while ((match = taRegex.exec(content)) !== null) {
      const attrs = match[1];
      const line = content.substring(0, match.index).split('\n').length;
      if (!/\bplaceholder\s*=/.test(attrs)) {
        missingTextareaPlaceholder.push({ file: f, line });
      }
    }
  });

  console.log(portal, {
    missingBtnSizeCount: missingBtnSize.length,
    oversizedBtnCount: oversizedBtn.length,
    missingInputSizeCount: missingInputSize.length,
    missingInputPlaceholderCount: missingInputPlaceholder.length,
    missingSelectTriggerSizeCount: missingSelectTriggerSize.length,
    missingTextareaPlaceholderCount: missingTextareaPlaceholder.length
  });

  if (missingBtnSize.length > 0) {
    console.log('Sample missingBtnSize:', missingBtnSize.slice(0, 10));
  }
  if (oversizedBtn.length > 0) {
    console.log('Sample oversizedBtn:', oversizedBtn.slice(0, 10));
  }
  if (missingInputSize.length > 0) {
    console.log('Sample missingInputSize:', missingInputSize.slice(0, 10));
  }
  if (missingInputPlaceholder.length > 0) {
    console.log('Sample missingInputPlaceholder:', missingInputPlaceholder.slice(0, 10));
  }
  if (missingSelectTriggerSize.length > 0) {
    console.log('Sample missingSelectTriggerSize:', missingSelectTriggerSize.slice(0, 10));
  }
  if (missingTextareaPlaceholder.length > 0) {
    console.log('Sample missingTextareaPlaceholder:', missingTextareaPlaceholder.slice(0, 10));
  }
});
