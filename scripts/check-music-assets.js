const fs = require('fs');
const path = require('path');

const frontendRoot = path.resolve(__dirname, '..');
const backendTrackRepo = path.resolve(
  frontendRoot,
  '..',
  'backend',
  'src',
  'game',
  'repositories',
  'track.repository.ts',
);
const publicDir = path.resolve(frontendRoot, 'public');

const content = fs.readFileSync(backendTrackRepo, 'utf8');
const fileUrlRegex = /fileUrl:\s*['"]([^'"]+)['"]/g;
const fileUrls = new Set();

let match;
while ((match = fileUrlRegex.exec(content)) !== null) {
  fileUrls.add(match[1]);
}

if (!fileUrls.size) {
  throw new Error(`No fileUrl entries found in ${backendTrackRepo}`);
}

const missing = [];
for (const fileUrl of fileUrls) {
  const relativePath = fileUrl.replace(/^\//, '');
  const assetPath = path.resolve(publicDir, relativePath);
  if (!fs.existsSync(assetPath)) {
    missing.push({ fileUrl, assetPath });
  }
}

if (missing.length) {
  console.error('Missing frontend music assets for backend tracks:');
  for (const item of missing) {
    console.error(`- ${item.fileUrl} (expected at ${item.assetPath})`);
  }
  process.exit(1);
}
