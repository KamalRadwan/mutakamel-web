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

function updateButtonsInPortal(portalPath) {
  const files = walk(portalPath);
  let totalUpdated = 0;

  files.forEach(file => {
    const norm = file.replace(/\\/g, '/');
    if (norm.includes('.test.') || norm.includes('design-system/primitives/Button.tsx')) return;

    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Use tag parser to locate exact <Button ...>
    const regex = /<Button(?=[\s/>])/g;
    let match;
    const matches = [];

    while ((match = regex.exec(content)) !== null) {
      const startIndex = match.index;
      let i = startIndex + 7;
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
            const fullTag = content.slice(startIndex, i + 1);
            matches.push({ startIndex, endIndex: i + 1, fullTag });
            break;
          }
        }
        i++;
      }
    }

    // Process matches in reverse order so string indices remain valid
    for (let idx = matches.length - 1; idx >= 0; idx--) {
      const item = matches[idx];
      const tag = item.fullTag;

      if (!/\bsize\s*=/.test(tag)) {
        // Insert size="sm" after <Button
        const newTag = tag.replace(/^<Button(\s*)/, '<Button size="sm"$1');
        content = content.slice(0, item.startIndex) + newTag + content.slice(item.endIndex);
        modified = true;
        totalUpdated++;
      }
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated buttons in ${norm}`);
    }
  });

  return totalUpdated;
}

const adminCount = updateButtonsInPortal('admin-portal/src');
console.log(`Total admin buttons updated: ${adminCount}`);

const tenantCount = updateButtonsInPortal('tenant-portal/src');
console.log(`Total tenant buttons updated: ${tenantCount}`);
