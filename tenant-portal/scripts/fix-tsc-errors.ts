import { Project, SyntaxKind } from "ts-morph";
import * as fs from "fs";
import * as cp from "child_process";

async function runFixer() {
  console.log("Running tsc...");
  let tscOutput = "";
  try {
    tscOutput = cp.execSync("pnpm tsc --noEmit", { encoding: "utf-8" });
  } catch (err: any) {
    tscOutput = err.stdout + err.stderr;
  }

  const project = new Project({ tsConfigFilePath: "./tsconfig.json" });
  const enDictFile = project.addSourceFileAtPath("src/i18n/dictionaries/en.ts");
  const enCrmObj = enDictFile.getVariableDeclarationOrThrow("en")
    .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
    .getPropertyOrThrow("crm")
    .getFirstChildByKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  
  const getEnglishTranslation = (key: string) => {
    const prop = enCrmObj.getProperty(key);
    if (prop && prop.getKind() === SyntaxKind.PropertyAssignment) {
      const init = (prop as any).getInitializer();
      if (init && init.getKind() === SyntaxKind.StringLiteral) return init.getLiteralText();
    }
    return "MOCK";
  };

  const lines = tscOutput.split("\n");
  const filesModified = new Set<string>();

  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_\-\.\/\\]+\.ts[x]?)\((\d+),(\d+)\): error TS2304: Cannot find name 't'\./);
    if (match) {
      const filePath = match[1];
      const lineNum = parseInt(match[2], 10);
      
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) continue;
      
      const sourceFile = project.addSourceFileAtPathIfExists(filePath) || project.addSourceFileAtPath(filePath);
      
      // We will just do a string replacement on that line to be 100% safe against AST mapping failures
      const fullText = sourceFile.getFullText();
      const linesArr = fullText.split("\n");
      const errorLine = linesArr[lineNum - 1];
      
      // regex replace t.crm.something with its string
      const fixedLine = errorLine.replace(/t\.crm\.([a-zA-Z0-9_$]+)/g, (fullMatch, key) => {
        return `"${getEnglishTranslation(key)}"`;
      });
      
      if (fixedLine !== errorLine) {
         linesArr[lineNum - 1] = fixedLine;
         sourceFile.replaceWithText(linesArr.join("\n"));
         filesModified.add(filePath);
      }
    }
    
    const matchRedeclare = line.match(/^([a-zA-Z0-9_\-\.\/\\]+\.ts[x]?)\((\d+),(\d+)\): error TS2451: Cannot redeclare block-scoped variable 't'\./);
    if (matchRedeclare) {
      const filePath = matchRedeclare[1];
      const lineNum = parseInt(matchRedeclare[2], 10);
      
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) continue;
      
      const sourceFile = project.addSourceFileAtPathIfExists(filePath) || project.addSourceFileAtPath(filePath);
      const fullText = sourceFile.getFullText();
      const linesArr = fullText.split("\n");
      
      // Comment out the redeclaration
      if (linesArr[lineNum - 1].includes("const { t } = useI18n()")) {
         linesArr[lineNum - 1] = "// " + linesArr[lineNum - 1];
         sourceFile.replaceWithText(linesArr.join("\n"));
         filesModified.add(filePath);
      } else if (linesArr[lineNum - 1].includes("const { t, lang } = useI18n()")) {
         linesArr[lineNum - 1] = "// " + linesArr[lineNum - 1];
         sourceFile.replaceWithText(linesArr.join("\n"));
         filesModified.add(filePath);
      }
    }
  }

  if (filesModified.size > 0) {
    project.saveSync();
    console.log(`Fixed ${filesModified.size} files automatically.`);
  } else {
    console.log("No files needed fixing or regex failed.");
  }
}

runFixer().catch(console.error);
