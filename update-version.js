import { readFileSync, writeFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const versionContent = `// Auto-generated version file\nexport const VERSION = '${packageJson.version}';`;

writeFileSync('./src/version.js', versionContent);
console.log(`Version updated to ${packageJson.version}`);