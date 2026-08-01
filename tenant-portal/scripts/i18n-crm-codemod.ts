import { Project, SyntaxKind, StringLiteral, JsxText, Node } from "ts-morph";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// Helper to check if string contains Arabic
function hasArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

// Minimal mock fetch to Google Translate API (free, undocumented)
async function translateArabicToEnglish(text: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data[0][0][0];
  } catch (err) {
    console.error("Translation error for:", text);
    return text;
  }
}

// To camel case
function toCamelCase(str: string) {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

async function runCodemod() {
  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });

  // Target CRM files
  const filePaths = [
    "src/app/(tenant)/crm/**/*.tsx",
    "src/app/(tenant)/crm/**/*.ts",
    "src/features/crm/**/*.tsx",
    "src/features/crm/**/*.ts",
  ];
  
  project.addSourceFilesAtPaths(filePaths);
  const sourceFiles = project.getSourceFiles().filter(sf => sf.getFilePath().includes("/crm/"));
  
  const arDictFile = project.addSourceFileAtPath("src/i18n/dictionaries/ar.ts");
  const enDictFile = project.addSourceFileAtPath("src/i18n/dictionaries/en.ts");

  const arDictObj = arDictFile.getVariableDeclarationOrThrow("ar").getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const enDictObj = enDictFile.getVariableDeclarationOrThrow("en").getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  const arCrmObj = arDictObj.getPropertyOrThrow("crm").getFirstChildByKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const enCrmObj = enDictObj.getPropertyOrThrow("crm").getFirstChildByKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  let translationCache: Record<string, { key: string, en: string }> = {};

  for (const sourceFile of sourceFiles) {
    let fileModified = false;
    let needsI18nImport = false;

    // We will find all StringLiterals and JsxText containing Arabic
    const stringLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral);
    const jsxTexts = sourceFile.getDescendantsOfKind(SyntaxKind.JsxText);
    
    const targetNodes = [...stringLiterals, ...jsxTexts].filter(n => hasArabic(n.getText()));

    if (targetNodes.length > 0) {
      console.log(`Processing: ${sourceFile.getBaseName()} (${targetNodes.length} strings)`);
    }

    for (const node of targetNodes) {
      let originalText = "";
      let isJsxText = false;
      
      if (Node.isStringLiteral(node)) {
        originalText = node.getLiteralText().trim();
      } else if (Node.isJsxText(node)) {
        originalText = node.getText().trim();
        isJsxText = true;
      }

      if (!originalText || !hasArabic(originalText)) continue;

      // Extract unique key
      if (!translationCache[originalText]) {
        const enTranslated = await translateArabicToEnglish(originalText);
        let key = toCamelCase(enTranslated.slice(0, 30)) || `key_${crypto.randomBytes(4).toString("hex")}`;
        
        // ensure valid key
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
          key = `key_${crypto.randomBytes(4).toString("hex")}`;
        }
        
        translationCache[originalText] = { key, en: enTranslated };

        // Add to dictionary AST safely
        if (!arCrmObj.getProperty(key)) {
          arCrmObj.addPropertyAssignment({ name: key, initializer: `"${originalText.replace(/"/g, '\\"')}"` });
          enCrmObj.addPropertyAssignment({ name: key, initializer: `"${enTranslated.replace(/"/g, '\\"')}"` });
        }
      }

      const { key } = translationCache[originalText];
      
      let replacement = `t.crm.${key}`;

      if (isJsxText) {
        node.replaceWithText(`{${replacement}}`);
        fileModified = true;
        needsI18nImport = true;
      } else if (Node.isStringLiteral(node)) {
        // If it is in a JSX attribute like title="Arabic" -> title={t.crm.key}
        const parent = node.getParent();
        if (Node.isJsxAttribute(parent)) {
          node.replaceWithText(`{${replacement}}`);
        } else {
          node.replaceWithText(replacement);
        }
        fileModified = true;
        needsI18nImport = true;
      }
    }

    if (fileModified) {
      // Inject import { useI18n } from "@/i18n/I18nContext"; if needed
      const hasImport = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === "@/i18n/I18nContext");
      if (!hasImport) {
        sourceFile.addImportDeclaration({
          namedImports: ["useI18n"],
          moduleSpecifier: "@/i18n/I18nContext"
        });
      }

      // Inject const { t } = useI18n(); into the main component function if it exists and lacks it
      const functions = sourceFile.getFunctions();
      for (const func of functions) {
        if (func.isExported() || func.getName()?.match(/^[A-Z]/)) {
          const body = func.getBody();
          if (Node.isBlock(body)) {
             if (!body.getText().includes("useI18n()")) {
                body.insertStatements(0, "const { t } = useI18n();");
             }
          }
        }
      }
      
      const arrowFunctions = sourceFile.getVariableDeclarations().filter(v => Node.isArrowFunction(v.getInitializer()));
      for (const arr of arrowFunctions) {
        const func = arr.getInitializerIfKind(SyntaxKind.ArrowFunction);
        if (func && (arr.getName()?.match(/^[A-Z]/))) {
           const body = func.getBody();
           if (Node.isBlock(body)) {
              if (!body.getText().includes("useI18n()")) {
                 body.insertStatements(0, "const { t } = useI18n();");
              }
           }
        }
      }
    }
  }

  // Save all modified files
  await project.save();
  console.log("Codemod complete!");
}

runCodemod().catch(console.error);
