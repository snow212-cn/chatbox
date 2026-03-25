const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(rootDir, 'electron-builder.yml');
const targetPath = path.join(rootDir, 'electron-builder.local.yml');

const source = fs.readFileSync(sourcePath, 'utf8');
const localConfig = source
  .replace(/^ {2}sign: \.\/custom_win_sign\.js\r?\n/m, '')
  .replace(/\$\{env\.UPDATE_CHANNEL\}/g, 'latest');

fs.writeFileSync(targetPath, localConfig);
console.log(`[prepare-local-builder-config] wrote ${targetPath}`);
