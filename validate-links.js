const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'tenant-portal', 'src', 'app');

function getNextRoutes(dir, basePath = '', routes = new Set()) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      let routeName = entry.name;
      // Skip route groups like (tenant) but continue traversing
      if (routeName.startsWith('(') && routeName.endsWith(')')) {
        getNextRoutes(path.join(dir, entry.name), basePath, routes);
      } else {
        const newPath = basePath + '/' + routeName;
        // If there's a page.tsx, add to routes
        if (fs.existsSync(path.join(dir, entry.name, 'page.tsx'))) {
          routes.add(newPath);
        }
        getNextRoutes(path.join(dir, entry.name), newPath, routes);
      }
    }
  }
  return routes;
}

function findLinksInFiles(dir, links = new Set()) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findLinksInFiles(fullPath, links);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Match <Link href="..."> and <Link href={`...`}>
      const regex = /<Link[^>]*href=\{?['"`](.*?)['"`]\}?/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        links.add({ link: match[1], file: fullPath });
      }
    }
  }
  return links;
}

const routes = getNextRoutes(srcDir);
const links = findLinksInFiles(srcDir);

let brokenLinks = [];

// Helper to convert Next.js dynamic routes to a regex pattern
function routeToRegex(route) {
  // Convert /[id]/ to /[^/]+/
  const pattern = route.replace(/\[.*?\]/g, '[^/]+');
  return new RegExp('^' + pattern + '$');
}

console.log('--- Validating Links against Routes ---');
for (const { link, file } of links) {
  // Ignore external or hash links
  if (link.startsWith('http') || link.startsWith('#')) continue;

  // For dynamic links like /crm/dashboards/${item.id} -> convert to /crm/dashboards/[^/]+
  const abstractLink = link.replace(/\$\{[^}]+\}/g, 'ID_MOCK');
  
  let isValid = false;
  for (const route of routes) {
    const regex = routeToRegex(route);
    if (regex.test(abstractLink)) {
      isValid = true;
      break;
    }
  }

  if (!isValid) {
    brokenLinks.push({ link, file });
  }
}

if (brokenLinks.length > 0) {
  console.log(`\n❌ Found ${brokenLinks.length} Broken Links:`);
  brokenLinks.forEach(b => console.log(`- ${b.link} (in ${b.file.split('\\').pop()})`));
  process.exit(1);
} else {
  console.log(`\n✅ All ${links.size} Links are 100% Valid and point to existing routes!`);
}
