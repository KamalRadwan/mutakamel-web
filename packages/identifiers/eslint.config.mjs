import { defineConfig } from "eslint/config";
import nextTs from "eslint-config-next/typescript";

// Not a Next app, but every portal that consumes this package lints with these
// rules. One set of rules across code that ships together.
const eslintConfig = defineConfig([...nextTs]);

export default eslintConfig;
