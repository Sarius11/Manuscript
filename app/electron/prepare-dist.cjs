const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const distDir = join(__dirname, "..", "dist-electron");
const packageJsonPath = join(distDir, "package.json");

mkdirSync(distDir, { recursive: true });
writeFileSync(packageJsonPath, '{\n  "type": "commonjs"\n}\n', "utf-8");
