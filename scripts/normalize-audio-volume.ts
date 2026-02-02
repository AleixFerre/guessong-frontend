import { spawn } from 'node:child_process';
import { readdir, rename, rm, stat } from 'node:fs/promises';
import { extname, join, parse, resolve } from 'node:path';

const DEFAULT_MUSIC_DIR = resolve(__dirname, '..', 'public', 'music');
const INPUT_DIR = resolve(process.argv[2] ?? DEFAULT_MUSIC_DIR);
const OUTPUT_DIR = resolve(process.argv[3] ?? INPUT_DIR);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus']);
const TARGET_LOUDNESS = '-16';
const TARGET_LRA = '11';
const TARGET_TP = '-1.5';
const OPUS_BITRATE = '96k';

const walkFiles = async (dir: string, files: string[] = []) => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, files);
    } else if (entry.isFile()) {
      const extension = extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.has(extension)) {
        files.push(fullPath);
      }
    }
  }
  return files;
};

const ensureDirExists = async (path: string) => {
  const parent = parse(path).dir;
  const info = await stat(parent).catch(() => null);
  if (!info) {
    await import('node:fs/promises').then((fs) => fs.mkdir(parent, { recursive: true }));
  }
};

const runFfmpeg = (inputPath: string, outputPath: string) =>
  new Promise<void>((resolvePromise, rejectPromise) => {
    const args = [
      '-y',
      '-i',
      inputPath,
      '-af',
      `loudnorm=I=${TARGET_LOUDNESS}:LRA=${TARGET_LRA}:TP=${TARGET_TP}`,
      '-c:a',
      'libopus',
      '-b:a',
      OPUS_BITRATE,
      outputPath,
    ];

    const process = spawn('ffmpeg', args, { stdio: 'inherit' });
    process.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`ffmpeg failed for ${inputPath}`));
      }
    });
  });

const normalizeFile = async (inputPath: string, outputPath: string) => {
  const isInPlace = resolve(inputPath) === resolve(outputPath);
  if (!isInPlace) {
    await ensureDirExists(outputPath);
    await runFfmpeg(inputPath, outputPath);
    return;
  }

  const tempPath = outputPath.replace(/\.opus$/i, '.tmp.opus');
  await ensureDirExists(tempPath);
  await runFfmpeg(inputPath, tempPath);
  await rm(outputPath, { force: true });
  await rename(tempPath, outputPath);
};

const run = async () => {
  const files = await walkFiles(INPUT_DIR);
  for (const file of files) {
    const relative = file.slice(INPUT_DIR.length).replace(/^[/\\]/, '');
    const output = join(OUTPUT_DIR, relative).replace(/\.[^/.]+$/, '.opus');
    await normalizeFile(file, output);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
