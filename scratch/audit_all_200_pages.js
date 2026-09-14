const fs = require('fs');
const path = require('path');

function walk(dir) {
  let res = [];
  if (!fs.existsSync(dir)) return res;
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.next' && f !== '.git') res.push(...walk(p));
    } else if (f === 'page.tsx') res.push(p);
  });
  return res;
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
            line: content.slice(0, startIndex).split('\n').length
          });
          break;
        }
      }
      i++;
    }
  }
  return tags;
}

const adminPages = walk('admin-portal/src/app');
const tenantPages = walk('tenant-portal/src/app');
const allPages = [...adminPages, ...tenantPages];
console.log('Total pages to audit:', allPages.length);

let totalIssues = 0;

allPages.forEach(p => {
  const norm = p.replace(/\\/g, '/');
  const content = fs.readFileSync(p, 'utf8');
  
  // 1. Button
  const buttons = extractTags(content, 'Button');
  buttons.forEach(b => {
    if (!b.fullTag.includes('size=')) {
      console.log(norm + ':' + b.line + ' Button missing size -> ' + b.fullTag.replace(/\s+/g, ' '));
      totalIssues++;
    } else if (b.fullTag.includes('size="md"') || b.fullTag.includes('size="lg"') || b.fullTag.includes('size="xl"')) {
      console.log(norm + ':' + b.line + ' Oversized Button -> ' + b.fullTag.replace(/\s+/g, ' '));
      totalIssues++;
    }
  });

  // 2. Input
  const inputs = extractTags(content, 'Input');
  inputs.forEach(inp => {
    if (inp.fullTag.includes('type="file"') || inp.fullTag.includes('type="checkbox"') || inp.fullTag.includes('type="radio"') || inp.fullTag.includes('type="color"')) return;
    if (!inp.fullTag.includes('size="sm"') && !inp.fullTag.includes('size="xs"')) {
      console.log(norm + ':' + inp.line + ' Input missing size="sm" -> ' + inp.fullTag.replace(/\s+/g, ' '));
      totalIssues++;
    }
    if (!inp.fullTag.includes('placeholder=') && !inp.fullTag.includes('...fieldProps') && !inp.fullTag.includes('{...fp}') && !inp.fullTag.includes('{...props}') && !inp.fullTag.includes('placeholder:')) {
      console.log(norm + ':' + inp.line + ' Input missing placeholder -> ' + inp.fullTag.replace(/\s+/g, ' '));
      totalIssues++;
    }
  });

  // 3. SelectTrigger
  const triggers = extractTags(content, 'SelectTrigger');
  triggers.forEach(st => {
    if (!st.fullTag.includes('size="sm"') && !st.fullTag.includes('size="xs"')) {
      console.log(norm + ':' + st.line + ' SelectTrigger missing size="sm" -> ' + st.fullTag.replace(/\s+/g, ' '));
      totalIssues++;
    }
  });

  // 4. Textarea
  const textareas = extractTags(content, 'Textarea');
  textareas.forEach(ta => {
    if (!ta.fullTag.includes('placeholder=')) {
      console.log(norm + ':' + ta.line + ' Textarea missing placeholder -> ' + ta.fullTag.replace(/\s+/g, ' '));
      totalIssues++;
    }
  });

  // 5. Native inputs
  const nInputs = extractTags(content, 'input');
  nInputs.forEach(ni => {
    if (ni.fullTag.includes('type="hidden"') || ni.fullTag.includes('type="checkbox"') || ni.fullTag.includes('type="radio"') || ni.fullTag.includes('type="file"') || ni.fullTag.includes('type="color"')) return;
    console.log(norm + ':' + ni.line + ' Unmanaged native input -> ' + ni.fullTag.replace(/\s+/g, ' '));
    totalIssues++;
  });
});

console.log('Total issues across all 200 pages:', totalIssues);
