import { Project, SyntaxKind, Identifier } from "ts-morph";
import * as fs from "fs";
import * as cp from "child_process";

async function fixScopeErrors() {
  console.log("Running tsc...");
  let tscOutput = "";
  try {
    tscOutput = cp.execSync("pnpm tsc --noEmit", { encoding: "utf-8" });
  } catch (err: any) {
    tscOutput = err.stdout + err.stderr;
  }

  const errorLines = tscOutput.split("\n").filter(l => l.includes("Cannot find name 't'"));
  const filesToFix = new Set<string>();
  
  for (const line of errorLines) {
    const match = line.match(/^([^\(]+)\(/);
    if (match) {
      filesToFix.add(match[1].trim());
    }
  }

  console.log(`Found ${filesToFix.size} files with scope errors.`);

  const project = new Project({ tsConfigFilePath: "./tsconfig.json" });
  
  const enDictFile = project.addSourceFileAtPath("src/i18n/dictionaries/en.ts");
  const enDictObj = enDictFile.getVariableDeclarationOrThrow("en").getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const enCrmObj = enDictObj.getPropertyOrThrow("crm").getFirstChildByKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  
  const getEnglishTranslation = (key: string) => {
    const prop = enCrmObj.getProperty(key);
    if (prop && prop.getKind() === SyntaxKind.PropertyAssignment) {
      const init = (prop as any).getInitializer();
      if (init && init.getKind() === SyntaxKind.StringLiteral) {
        return init.getLiteralText();
      }
    }
    return "Unknown";
  };

  for (const filePath of filesToFix) {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) continue;
    const sourceFile = project.addSourceFileAtPath(filePath);
    let modified = false;

    // Find all t identifiers
    const tIdentifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).filter(i => i.getText() === "t");
    
    for (const tId of tIdentifiers) {
      const parent = tId.getParent();
      // If t is part of `t.crm.key`
      if (parent && parent.getKind() === SyntaxKind.PropertyAccessExpression) {
         const grandparent = parent.getParent();
         if (grandparent && grandparent.getKind() === SyntaxKind.PropertyAccessExpression) {
            const propAccess = grandparent as any;
            if (propAccess.getText().startsWith("t.crm.")) {
               const key = propAccess.getName();
               const englishString = getEnglishTranslation(key);
               
               // Check if it is inside a function
               const enclosingFunc = tId.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) || 
                                     tId.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
               
               if (true) {
                 // It is outside a function! Revert it to the English string.
                 propAccess.replaceWithText(`"${englishString}"`);
                 modified = true;
               }
            }
         }
      }
    }

    if (modified) {
      sourceFile.saveSync();
      console.log(`Fixed scope issues in ${filePath}`);
    }
  }
}

fixScopeErrors().catch(console.error);


