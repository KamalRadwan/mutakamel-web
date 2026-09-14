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
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
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

function auditPortal(portalName, portalDir) {
  const files = walk(path.join(portalDir, 'src'));
  const issues = [];

  for (const file of files) {
    const norm = file.replace(/\\/g, '/');
    if (norm.includes('.test.') || norm.includes('__tests__') || norm.includes('.d.ts')) continue;
    if (norm.includes('design-system/primitives/Input.tsx') || 
        norm.includes('design-system/primitives/Textarea.tsx') || 
        norm.includes('design-system/primitives/Select.tsx') ||
        norm.includes('design-system/primitives/Button.tsx') ||
        norm.includes('design-system/lib/variants.ts')) continue;

    const content = fs.readFileSync(file, 'utf8');

    // 1. Inputs
    const inputs = extractTags(content, 'Input');
    for (const item of inputs) {
      const tag = item.fullTag;
      if (tag.includes('type="file"') || tag.includes('type="checkbox"') || tag.includes('type="radio"') || tag.includes('type="color"')) continue;
      if (norm.includes('useSubscriptionOffers.ts')) continue;

      if (!tag.includes('size="sm"') && !tag.includes('size="xs"')) {
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'Input lacking explicit size="sm"', tag: tag.replace(/\s+/g, ' ') });
      }
      if (!tag.includes('placeholder=') && !tag.includes('...fieldProps') && !tag.includes('{...fp}') && !tag.includes('{...props}') && !tag.includes('placeholder:')) {
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'Input lacking placeholder', tag: tag.replace(/\s+/g, ' ') });
      }
      if (tag.includes('placeholder=""') || tag.includes('placeholder={""}')) {
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'Input empty placeholder', tag: tag.replace(/\s+/g, ' ') });
      }
    }

    // 2. SelectTriggers
    const triggers = extractTags(content, 'SelectTrigger');
    for (const item of triggers) {
      const tag = item.fullTag;
      if (!tag.includes('size="sm"') && !tag.includes('size="xs"')) {
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'SelectTrigger lacking explicit size="sm"', tag: tag.replace(/\s+/g, ' ') });
      }
    }

    // 3. Textareas
    const textareas = extractTags(content, 'Textarea');
    for (const item of textareas) {
      const tag = item.fullTag;
      if (!tag.includes('placeholder=')) {
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'Textarea lacking placeholder', tag: tag.replace(/\s+/g, ' ') });
      }
      if (tag.includes('placeholder=""') || tag.includes('placeholder={""}')) {
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'Textarea empty placeholder', tag: tag.replace(/\s+/g, ' ') });
      }
    }

    // 4. DialogContent
    const dialogs = extractTags(content, 'DialogContent');
    for (const item of dialogs) {
      const tag = item.fullTag;
      if (!tag.includes('p-3') && !tag.includes('p-0') && !norm.includes('CommandPalette')) {
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'DialogContent lacking p-3', tag: tag.replace(/\s+/g, ' ') });
      }
    }

    // 5. CardContent p-6
    const cards = extractTags(content, 'CardContent');
    for (const item of cards) {
      const tag = item.fullTag;
      if (tag.includes('p-6')) {
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'CardContent has p-6', tag: tag.replace(/\s+/g, ' ') });
      }
    }

    // 6. Native inputs/textareas
    if (!norm.includes('components/auth/AuthShell')) {
      const nInputs = extractTags(content, 'input');
      for (const item of nInputs) {
        const tag = item.fullTag;
        if (tag.includes('type="hidden"') || tag.includes('type="checkbox"') || tag.includes('type="radio"') || tag.includes('type="file"') || tag.includes('type="color"') || tag.includes('type="range"')) continue;
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'Unmanaged native input', tag: tag.replace(/\s+/g, ' ') });
      }
    }

    // 7. Buttons
    const buttons = extractTags(content, 'Button');
    for (const item of buttons) {
      const tag = item.fullTag;
      if (tag.includes('size="md"') || tag.includes('size="lg"') || tag.includes('size="xl"')) {
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'Oversized Button', tag: tag.replace(/\s+/g, ' ') });
      }
      if (!tag.includes('size=')) {
        issues.push({ portal: portalName, file: norm, line: item.line, issue: 'Button lacking explicit size', tag: tag.replace(/\s+/g, ' ') });
      }
    }

    // 8. Duplicate attributes
    for (const tagName of ['DialogContent', 'Input', 'SelectTrigger', 'Textarea', 'Card', 'Button']) {
      const tags = extractTags(content, tagName);
      for (const item of tags) {
        const tag = item.fullTag;
        for (const attr of ['className', 'size', 'placeholder']) {
          const found = tag.match(new RegExp('\\b' + attr + '=', 'g'));
          if (found && found.length > 1) {
            issues.push({ portal: portalName, file: norm, line: item.line, issue: `Duplicate ${attr} attribute on ${tagName}`, tag: tag.replace(/\s+/g, ' ') });
          }
        }
      }
    }
  }

  return issues;
}

let iteration = 1;
const MAX_LOOPS = 5;

while (iteration <= MAX_LOOPS) {
  console.log(`\n======================================================`);
  console.log(`>>> AUDIT LOOP PASS #${iteration} <<<`);
  console.log(`======================================================`);

  const tenantIssues = auditPortal('tenant-portal', 'c:/mutakamel.ai/frontend/tenant-portal');
  const adminIssues = auditPortal('admin-portal', 'c:/mutakamel.ai/frontend/admin-portal');
  const allIssues = [...tenantIssues, ...adminIssues];

  console.log(`Tenant portal issues: ${tenantIssues.length}`);
  console.log(`Admin portal issues: ${adminIssues.length}`);
  console.log(`Total issues found: ${allIssues.length}`);

  if (allIssues.length === 0) {
    console.log(`\n======================================================`);
    console.log(`>>> CONFIRMED: 0 EDITS FOUND ACROSS BOTH PORTALS! <<<`);
    console.log(`======================================================\n`);
    process.exit(0);
  } else {
    allIssues.forEach(e => console.log(`  [${e.portal}] ${e.file}:${e.line} [${e.issue}] -> ${e.tag.slice(0, 100)}`));
    process.exit(1);
  }
}
