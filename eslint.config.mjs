import { includeIgnoreFile } from "@eslint/compat"
import js from "@eslint/js"
import markdown from "@eslint/markdown"
import { defineConfig } from "eslint/config"
import globals from "globals"
import { fileURLToPath } from "node:url"

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url))
// prettier-ignore
export default defineConfig([
	includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),
	{ files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
	{ files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
	{ files: ["**/*.md"], plugins: { markdown }, language: "markdown/gfm", extends: ["markdown/recommended"] },
])
