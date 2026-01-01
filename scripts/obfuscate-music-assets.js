const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const frontendRoot = path.resolve(__dirname, '..');
const publicDir = path.resolve(frontendRoot, 'public');
const musicDir = path.resolve(publicDir, 'music');
const backendTrackRepo = path.resolve(
  frontendRoot,
  '..',
  'backend',
  'src',
  'game',
  'repositories',
  'track.repository.ts'
);
const libraryData = path.resolve(frontendRoot, 'src', 'app', 'data', 'library-data.ts');

const isRandomName = (name) => /^[a-f0-9]{8,}$/i.test(name);

const walkFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};

const toPosixPath = (value) => value.split(path.sep).join('/');

const replaceAll = (content, search, replacement) => content.split(search).join(replacement);

const generateName = (taken) => {
  let candidate = '';
  do {
    candidate = crypto.randomBytes(4).toString('hex');
  } while (taken.has(candidate));
  taken.add(candidate);
  return candidate;
};

if (!fs.existsSync(musicDir)) {
  console.error(`Music directory not found at ${musicDir}`);
  process.exit(1);
}

const files = walkFiles(musicDir).filter((file) => path.extname(file).toLowerCase() === '.opus');
if (!files.length) {
  console.log('No .opus files found under the music directory.');
  process.exit(0);
}

const takenNames = new Set(
  files.map((file) => path.basename(file, path.extname(file))).filter((name) => isRandomName(name))
);
const renameMap = new Map();

for (const file of files) {
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  if (isRandomName(base)) {
    continue;
  }
  const dir = path.dirname(file);
  const newBase = generateName(takenNames);
  const newPath = path.join(dir, `${newBase}${ext}`);
  fs.renameSync(file, newPath);
  const relativeOld = toPosixPath(path.relative(publicDir, file));
  const relativeNew = toPosixPath(path.relative(publicDir, newPath));
  renameMap.set(`/${relativeOld}`, `/${relativeNew}`);
}

if (!renameMap.size) {
  console.log('No non-random filenames found. No changes made.');
  process.exit(0);
}

const filesToUpdate = [backendTrackRepo, libraryData].filter((filePath) =>
  fs.existsSync(filePath)
);

for (const filePath of filesToUpdate) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = content;
  for (const [oldUrl, newUrl] of renameMap.entries()) {
    updated = replaceAll(updated, oldUrl, newUrl);
  }
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }
}

console.log('Renamed assets:');
for (const [oldUrl, newUrl] of renameMap.entries()) {
  console.log(`- ${oldUrl} -> ${newUrl}`);
}
