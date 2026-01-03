import fs from 'node:fs';
import path from 'node:path';
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
const backendTrackDataDir = path.resolve(
  frontendRoot,
  '..',
  'backend',
  'src',
  'game',
  'repositories',
  'track-data',
);
const publicDir = path.resolve(frontendRoot, 'public');
const fileUrlRegex = /fileUrl:\s*['"]([^'"]+)['"]/g;

const collectTrackFiles = () => {
  const files: string[] = [];
  if (fs.existsSync(backendTrackDataDir)) {
    for (const entry of fs.readdirSync(backendTrackDataDir, { withFileTypes: true })) {
      if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.ts') {
        files.push(path.join(backendTrackDataDir, entry.name));
      }
    }
  }
  if (fs.existsSync(backendTrackRepo)) {
    files.push(backendTrackRepo);
  }
  return files;
};

const fileUrls = new Set<string>();
const trackFiles = collectTrackFiles();

for (const filePath of trackFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  fileUrlRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = fileUrlRegex.exec(content)) !== null) {
    fileUrls.add(match[1]);
  }
}

if (!fileUrls.size) {
  throw new Error(`No fileUrl entries found in ${trackFiles.join(', ')}`);
}

const missing: Array<{ fileUrl: string; assetPath: string }> = [];
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
