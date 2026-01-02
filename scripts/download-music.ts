import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT_DIR = 'music';

const LINKS: string[] = [
  //  My Heart Will Go On – Céline Dion (Titanic)
  'https://www.youtube.com/watch?v=WNIPqafd4As',

  // I Will Always Love You – Whitney Houston (The Bodyguard)
  'https://www.youtube.com/watch?v=3JWTaaS7LdU',

  // Eye of the Tiger – Survivor (Rocky III)
  'https://www.youtube.com/watch?v=btPJPFnesV4',

  // Stayin’ Alive – Bee Gees (Saturday Night Fever)
  'https://www.youtube.com/watch?v=fNFzfwLM72c',

  // Footloose – Kenny Loggins (Footloose)
  'https://www.youtube.com/watch?v=ltrMfT4Qz5Y',

  // Take My Breath Away – Berlin (Top Gun)
  'https://www.youtube.com/watch?v=Bx51eegLTY8',

  // Ghostbusters – Ray Parker Jr. (Ghostbusters)
  'https://www.youtube.com/watch?v=Fe93CLbHjxQ',

  // Danger Zone – Kenny Loggins (Top Gun)
  'https://www.youtube.com/watch?v=yK0P1Bk8Cx4',

  // (I’ve Had) The Time of My Life – Dirty Dancing
  'https://www.youtube.com/watch?v=4BQLE_RrTSU',

  // Unchained Melody – The Righteous Brothers (Ghost)
  'https://www.youtube.com/watch?v=qiiyq2xrSI0',

  // Let It Go – Idina Menzel (Frozen)
  'https://www.youtube.com/watch?v=L0MK7qz13bU',

  // Circle of Life – Elton John (The Lion King)
  'https://www.youtube.com/watch?v=GibiNy4d4gc',

  // Hakuna Matata – The Lion King
  'https://www.youtube.com/watch?v=nbY_aP-alkw',

  // A Whole New World – Aladdin
  'https://www.youtube.com/watch?v=eitDnP0_83k',

  // Beauty and the Beast – Celine Dion & Peabo Bryson
  'https://www.youtube.com/watch?v=Ueh9YJ6JvZ4',

  // You’ll Be in My Heart – Phil Collins (Tarzan)
  'https://www.youtube.com/watch?v=JkRKT6T0QLg',

  // Shallow – Lady Gaga & Bradley Cooper (A Star Is Born)
  'https://www.youtube.com/watch?v=bo_efYhYU2A',

  // Lose Yourself – Eminem (8 Mile)
  'https://www.youtube.com/watch?v=_Yhyp-_hX2s',

  // Skyfall – Adele (Skyfall)
  'https://www.youtube.com/watch?v=DeumyOzKqgI',

  // Live and Let Die – Paul McCartney (James Bond)
  'https://www.youtube.com/watch?v=NR0UmZcf89E',

  // GoldenEye – Tina Turner (James Bond)
  'https://www.youtube.com/watch?v=G1V3z2k4FfM',

  // Theme from Jurassic Park – John Williams
  'https://www.youtube.com/watch?v=lc0UehYemQA',

  // Imperial March – John Williams (Star Wars)
  'https://www.youtube.com/watch?v=-bzWSJG93P8',

  // Star Wars Main Theme – John Williams
  'https://www.youtube.com/watch?v=vZ734NWnAHA',

  // Hedwig’s Theme – Harry Potter
  'https://www.youtube.com/watch?v=wtHra9tFISY',

  // Concerning Hobbits – LOTR
  'https://www.youtube.com/watch?v=_pGaz_qN0cw',

  // The Fellowship Theme – LOTR
  'https://www.youtube.com/watch?v=V75dMMIW2B4',

  // Time – Hans Zimmer (Inception)
  'https://www.youtube.com/watch?v=RxabLA7UQ9k',

  // Cornfield Chase – Hans Zimmer (Interstellar)
  'https://www.youtube.com/watch?v=7y0yX7r8WJY',

  // Now We Are Free – Gladiator
  'https://www.youtube.com/watch?v=ghxzLw2wRis',

  // He’s a Pirate – Pirates of the Caribbean
  'https://www.youtube.com/watch?v=yRh-dzrI4Z4',

  // The Ecstasy of Gold – The Good, the Bad and the Ugly
  'https://www.youtube.com/watch?v=PYI09PMNazw',

  // Mrs. Robinson – Simon & Garfunkel (The Graduate)
  'https://www.youtube.com/watch?v=9C1BCAgu2I8',

  // Don’t You (Forget About Me) – Simple Minds (The Breakfast Club)
  'https://www.youtube.com/watch?v=CdqoNKCCt7A',

  // Bohemian Rhapsody – Queen (Wayne’s World)
  'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',

  // I’m a Believer – Smash Mouth (Shrek)
  'https://www.youtube.com/watch?v=0mYBSayCsH0',

  // All Star – Smash Mouth (Shrek)
  'https://www.youtube.com/watch?v=L_jWHffIx5E',

  // Everybody’s Talkin’ – Harry Nilsson (Midnight Cowboy)
  'https://www.youtube.com/watch?v=BFkTu8Y1KLs',

  // Born to Be Wild – Steppenwolf (Easy Rider)
  'https://www.youtube.com/watch?v=igvP806798U',

  // The Power of Love – Huey Lewis (Back to the Future)
  'https://www.youtube.com/watch?v=wIiVp3poe2c',

  // Axel F – Harold Faltermeyer (Beverly Hills Cop)
  'https://www.youtube.com/watch?v=Qx2gvHjNhQ0',

  // Flashdance… What a Feeling – Irene Cara
  'https://www.youtube.com/watch?v=ILWSp0m9G2U',

  // What I’ve Done – Linkin Park (Transformers)
  'https://www.youtube.com/watch?v=8sgycukafqQ',

  // The Sound of Music – Julie Andrews
  'https://www.youtube.com/watch?v=5kZOr3z2T6k',

  // Moon River – Audrey Hepburn (Breakfast at Tiffany’s)
  'https://www.youtube.com/watch?v=QEDM8m9j0yY',

  // Can You Feel the Love Tonight – Elton John
  'https://www.youtube.com/watch?v=KjgWWjkNbhU',

  // We Don’t Talk About Bruno – Encanto
  'https://www.youtube.com/watch?v=bvWRMAU6V-c',

  // Over the Rainbow – Judy Garland (Wizard of Oz)
  'https://www.youtube.com/watch?v=PSZxmZmBfnU',

  // You’ve Got a Friend in Me – Toy Story
  'https://www.youtube.com/watch?v=XHFy3YWpRx8',

  // Theme from The Godfather – Nino Rota
  'https://www.youtube.com/watch?v=HWqKPWO5T4o',
];

mkdirSync(OUTPUT_DIR, { recursive: true });

function download(url: string) {
  return new Promise<void>((resolve, reject) => {
    const args = [
      '-x', // extraer audio
      '--audio-format',
      'mp3', // formato final
      '--audio-quality',
      '0', // mejor calidad
      '-o',
      join(OUTPUT_DIR, '%(title)s.%(ext)s'),
      url,
    ];

    const p = spawn('yt-dlp', args, { stdio: 'inherit' });

    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Error descargando ${url}`));
    });
  });
}

for (const url of LINKS) {
  download(url);
}
