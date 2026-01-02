import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { extname, join, parse, resolve } from 'node:path';

const DEFAULT_MUSIC_DIR = resolve(__dirname, '..', 'public', 'music');
const INPUT_DIR = resolve(process.argv[2] ?? DEFAULT_MUSIC_DIR);
const OUTPUT_DIR = resolve(process.argv[3] ?? INPUT_DIR);
const MAX_DURATION_SECONDS = 30;
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus']);

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

const transcode = (inputPath: string, outputPath: string) =>
  new Promise<void>((resolvePromise, rejectPromise) => {
    const args = [
      '-y',
      '-i',
      inputPath,
      '-t',
      String(MAX_DURATION_SECONDS),
      '-c:a',
      'libopus',
      '-b:a',
      '96k',
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

const run = async () => {
  const files = await walkFiles(INPUT_DIR);
  for (const file of files) {
    const relative = file.slice(INPUT_DIR.length).replace(/^[/\\]/, '');
    const output = join(OUTPUT_DIR, relative).replace(/\.[^/.]+$/, '.opus');
    if (resolve(output) === resolve(file)) {
      continue;
    }
    await ensureDirExists(output);
    await transcode(file, output);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
