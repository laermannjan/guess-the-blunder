/**
 * Puzzle Processing Script for BlunderRush
 *
 * Downloads and processes Lichess puzzles into a JSON file.
 * The Lichess puzzle database is CC0 (public domain).
 *
 * Usage: npx tsx scripts/process-puzzles.ts [count]
 *
 * Options:
 *   count - Number of puzzles to include (default: 1000)
 */

import { createReadStream, createWriteStream, existsSync } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import { createInterface } from 'readline';
import { createBrotliDecompress } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lichess puzzle database URL (compressed with brotli)
const PUZZLE_DB_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
// Alternative: Use a smaller sample for development
const PUZZLE_SAMPLE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';

interface LichessPuzzle {
  puzzleId: string;
  fen: string;
  moves: string;
  rating: number;
  ratingDeviation: number;
  popularity: number;
  nbPlays: number;
  themes: string;
  gameUrl: string;
  openingTags: string;
}

interface ProcessedPuzzle {
  id: string;
  fen: string;           // Position AFTER the blunder
  moves: string[];       // Solution moves (UCI format)
  rating: number;
  themes: string[];
  gameUrl: string;
  popularity: number;
  nbPlays: number;
}

async function downloadPuzzleDatabase(outputPath: string): Promise<void> {
  console.log('Downloading puzzle database...');
  console.log('This may take a while (file is ~300MB compressed)...');

  const response = await fetch(PUZZLE_DB_URL);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  // The file is compressed with zstd, which Node doesn't natively support
  // For now, we'll use a pre-downloaded sample or instruct user to download manually
  throw new Error(
    'Automatic download not yet supported for zstd compressed files.\n' +
    'Please download manually from: https://database.lichess.org/\n' +
    'Then decompress and place as: scripts/lichess_db_puzzle.csv'
  );
}

async function processPuzzlesFromCSV(
  csvPath: string,
  outputPath: string,
  maxPuzzles: number = 1000,
  minRating: number = 1000,
  maxRating: number = 2500
): Promise<void> {
  console.log(`Processing puzzles from ${csvPath}...`);
  console.log(`Target: ${maxPuzzles} puzzles, rating range: ${minRating}-${maxRating}`);

  const puzzles: ProcessedPuzzle[] = [];
  let lineCount = 0;
  let skippedCount = 0;

  const fileStream = createReadStream(csvPath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isFirstLine = true;

  for await (const line of rl) {
    // Skip header
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }

    lineCount++;

    // Parse CSV line (simple parser - assumes no commas in fields)
    const fields = line.split(',');
    if (fields.length < 10) {
      skippedCount++;
      continue;
    }

    const [puzzleId, fen, moves, rating, ratingDeviation, popularity, nbPlays, themes, gameUrl, openingTags] = fields;

    const ratingNum = parseInt(rating, 10);
    const popularityNum = parseInt(popularity, 10);

    // Filter by rating
    if (ratingNum < minRating || ratingNum > maxRating) {
      skippedCount++;
      continue;
    }

    // Filter out very unpopular puzzles
    if (popularityNum < -50) {
      skippedCount++;
      continue;
    }

    const puzzle: ProcessedPuzzle = {
      id: puzzleId,
      fen: fen,
      moves: moves.split(' '),
      rating: ratingNum,
      themes: themes.split(' ').filter(t => t.length > 0),
      gameUrl: gameUrl,
      popularity: popularityNum,
      nbPlays: parseInt(nbPlays, 10) || 0,
    };

    puzzles.push(puzzle);

    // Log progress every 100k lines
    if (lineCount % 100000 === 0) {
      console.log(`  Processed ${lineCount} lines, collected ${puzzles.length} puzzles...`);
    }

    // Stop when we have enough
    if (puzzles.length >= maxPuzzles) {
      break;
    }
  }

  console.log(`\nProcessed ${lineCount} lines total`);
  console.log(`Skipped ${skippedCount} puzzles (out of range or invalid)`);
  console.log(`Collected ${puzzles.length} puzzles`);

  // Shuffle puzzles for variety
  shuffleArray(puzzles);

  // Write to JSON
  const outputDir = dirname(outputPath);
  await mkdir(outputDir, { recursive: true });

  const output = JSON.stringify(puzzles, null, 2);
  await Bun?.write?.(outputPath, output) ??
    new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(outputPath);
      ws.write(output);
      ws.end();
      ws.on('finish', resolve);
      ws.on('error', reject);
    });

  console.log(`\nWrote ${puzzles.length} puzzles to ${outputPath}`);
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

async function createSamplePuzzles(outputPath: string): Promise<void> {
  // Create a small sample of hand-picked puzzles for development
  const samplePuzzles: ProcessedPuzzle[] = [
    {
      id: 'sample001',
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      moves: ['h5f7'],  // Scholar's mate - Qxf7#
      rating: 800,
      themes: ['mate', 'mateIn1', 'short'],
      gameUrl: 'https://lichess.org/sample',
      popularity: 100,
      nbPlays: 1000,
    },
    {
      id: 'sample002',
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
      moves: ['d8h4'],  // Fool's mate - Qh4#
      rating: 600,
      themes: ['mate', 'mateIn1', 'short'],
      gameUrl: 'https://lichess.org/sample',
      popularity: 100,
      nbPlays: 1000,
    },
    {
      id: 'sample003',
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      moves: ['f3g5', 'd7d5', 'e4d5', 'f6d5', 'g5f7'],  // Fried Liver setup
      rating: 1200,
      themes: ['fork', 'middlegame'],
      gameUrl: 'https://lichess.org/sample',
      popularity: 90,
      nbPlays: 500,
    },
    {
      id: 'sample004',
      fen: 'r2qk2r/ppp2ppp/2n1bn2/3pp3/2B1P1b1/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 7',
      moves: ['c4f7', 'e8f7', 'f3g5', 'f7g8', 'd1b3'],
      rating: 1400,
      themes: ['sacrifice', 'attack'],
      gameUrl: 'https://lichess.org/sample',
      popularity: 85,
      nbPlays: 300,
    },
    {
      id: 'sample005',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      moves: ['f1b5'],  // Ruy Lopez
      rating: 1100,
      themes: ['opening', 'pin'],
      gameUrl: 'https://lichess.org/sample',
      popularity: 95,
      nbPlays: 800,
    },
    {
      id: 'sample006',
      fen: 'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2',
      moves: ['e4e5', 'f6d5', 'd2d4'],
      rating: 1000,
      themes: ['opening', 'pawnCenter'],
      gameUrl: 'https://lichess.org/sample',
      popularity: 88,
      nbPlays: 600,
    },
    {
      id: 'sample007',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
      moves: ['f8c5'],  // Italian Game response
      rating: 1050,
      themes: ['opening', 'development'],
      gameUrl: 'https://lichess.org/sample',
      popularity: 92,
      nbPlays: 700,
    },
    {
      id: 'sample008',
      fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5',
      moves: ['c1g5', 'h7h6', 'g5f6', 'd8f6'],
      rating: 1300,
      themes: ['pin', 'middlegame'],
      gameUrl: 'https://lichess.org/sample',
      popularity: 80,
      nbPlays: 400,
    },
    {
      id: 'sample009',
      fen: 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq d6 0 3',
      moves: ['f3e5', 'd5e4', 'e5c6'],
      rating: 1150,
      themes: ['fork', 'opening'],
      gameUrl: 'https://lichess.org/sample',
      popularity: 75,
      nbPlays: 350,
    },
    {
      id: 'sample010',
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4',
      moves: ['d2d4', 'e5d4', 'f3d4'],
      rating: 1100,
      themes: ['opening', 'center'],
      gameUrl: 'https://lichess.org/sample',
      popularity: 85,
      nbPlays: 450,
    },
  ];

  const outputDir = dirname(outputPath);
  await mkdir(outputDir, { recursive: true });

  const output = JSON.stringify(samplePuzzles, null, 2);
  const ws = createWriteStream(outputPath);
  ws.write(output);
  ws.end();

  await new Promise<void>((resolve, reject) => {
    ws.on('finish', resolve);
    ws.on('error', reject);
  });

  console.log(`Created sample puzzles at ${outputPath}`);
  console.log(`Total: ${samplePuzzles.length} puzzles`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const count = parseInt(args[0], 10) || 1000;

  const projectRoot = join(__dirname, '..');
  const csvPath = join(__dirname, 'lichess_db_puzzle.csv');
  const outputPath = join(projectRoot, 'src', 'lib', 'db', 'puzzles.json');

  // Check if we have the CSV file
  if (existsSync(csvPath)) {
    console.log('Found puzzle database CSV');
    await processPuzzlesFromCSV(csvPath, outputPath, count);
  } else {
    console.log('Puzzle database not found. Creating sample puzzles for development...');
    console.log('\nTo use the full database:');
    console.log('1. Download from: https://database.lichess.org/');
    console.log('2. Decompress the file');
    console.log(`3. Place as: ${csvPath}`);
    console.log('4. Run this script again\n');

    await createSamplePuzzles(outputPath);
  }
}

main().catch(console.error);
