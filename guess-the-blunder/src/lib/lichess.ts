/**
 * Lichess API integration for BlunderRush
 *
 * Fetches puzzles directly from Lichess API - no need to download the full database!
 */

import { Chess } from 'chess.js';

export interface LichessPuzzleResponse {
  game: {
    id: string;
    perf: {
      key: string;
      name: string;
    };
    rated: boolean;
    players: Array<{
      name: string;
      id: string;
      color: 'white' | 'black';
      rating: number;
    }>;
    pgn: string;
    clock?: string;
  };
  puzzle: {
    id: string;
    rating: number;
    plays: number;
    solution: string[];  // UCI moves for the winning line
    themes: string[];
    initialPly: number;  // The move number where the puzzle starts (0-indexed half-moves)
  };
}

export interface GameMove {
  san: string;
  fen: string;
  color: 'white' | 'black';
  from: string;
  to: string;
}

export interface ProcessedPuzzle {
  id: string;
  // The position AFTER the blunder was played (this is what Lichess gives us)
  fen: string;
  // The position BEFORE the blunder (what we show to the user)
  preFen: string;
  // The blunder move in UCI format (e.g., "e2e4")
  blunderUci: string;
  // The blunder move in SAN format (e.g., "e4", "Nxf3+")
  blunderSan: string;
  // The winning response moves in UCI format
  solutionUci: string[];
  // The winning response moves in SAN format
  solutionSan: string[];
  // Puzzle rating (difficulty)
  rating: number;
  themes: string[];
  gameUrl: string;
  puzzleUrl: string;
  plays: number;
  // Game info
  gameRating: number; // Average rating of both players
  gameType: string; // e.g., "Blitz", "Rapid", "Bullet"
  // Opponent's last move (the move before the blunder position)
  opponentLastMove: {
    from: string;
    to: string;
    san: string;
  } | null;
  // Game moves leading up to (but not including) the blunder
  gameMoves: GameMove[];
  // Raw API response for debugging
  rawResponse: LichessPuzzleResponse;
}

const LICHESS_API_BASE = 'https://lichess.org/api';

/**
 * Fetch a random puzzle from Lichess
 */
export async function fetchRandomPuzzle(): Promise<LichessPuzzleResponse> {
  const response = await fetch(`${LICHESS_API_BASE}/puzzle/next`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch puzzle: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch the daily puzzle from Lichess
 */
export async function fetchDailyPuzzle(): Promise<LichessPuzzleResponse> {
  const response = await fetch(`${LICHESS_API_BASE}/puzzle/daily`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch daily puzzle: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch a specific puzzle by ID from Lichess
 */
export async function fetchPuzzleById(id: string): Promise<LichessPuzzleResponse> {
  const response = await fetch(`${LICHESS_API_BASE}/puzzle/${id}`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch puzzle ${id}: ${response.status}`);
  }

  return response.json();
}

/**
 * Process a Lichess puzzle response into our format
 *
 * Key insight: Lichess puzzles show the position AFTER the opponent's blunder.
 * The PGN contains all moves up to and INCLUDING the blunder.
 * The last move in the PGN IS the blunder.
 * The solution is how to punish the blunder.
 *
 * For BlunderRush, we need to:
 * 1. Play through ALL PGN moves to get the puzzle position (after blunder)
 * 2. The position BEFORE the last move is what we show to the user
 * 3. The last PGN move is the blunder
 * 4. Convert solution UCI moves to SAN for display
 */
export function processLichessPuzzle(response: LichessPuzzleResponse): ProcessedPuzzle {
  const { game, puzzle } = response;

  // Parse the PGN - filter out move numbers like "1." "2." etc.
  const pgnMoves = game.pgn.split(' ').filter(m => !m.includes('.') && m.length > 0);

  // Create chess instance and play through all moves EXCEPT the last one
  // to get the position BEFORE the blunder
  const chess = new Chess();

  // Track the opponent's last move (second-to-last move in PGN)
  let opponentLastMove: { from: string; to: string; san: string } | null = null;

  // Track all game moves for the move explorer
  const gameMoves: GameMove[] = [];

  for (let i = 0; i < pgnMoves.length - 1; i++) {
    const move = chess.move(pgnMoves[i]);
    if (!move) {
      console.error(`Invalid move in PGN: ${pgnMoves[i]} at index ${i}`);
      break;
    }

    // Add to game moves
    gameMoves.push({
      san: move.san,
      fen: chess.fen(),
      color: move.color === 'w' ? 'white' : 'black',
      from: move.from,
      to: move.to,
    });

    // The second-to-last move is the opponent's last move before the blunder
    if (i === pgnMoves.length - 2) {
      opponentLastMove = {
        from: move.from,
        to: move.to,
        san: move.san,
      };
    }
  }

  // Position BEFORE the blunder (what we show to the user)
  const preFen = chess.fen();

  // Now play the blunder (last move in PGN)
  const blunderSanFromPgn = pgnMoves[pgnMoves.length - 1];
  const blunderMoveObj = chess.move(blunderSanFromPgn);

  if (!blunderMoveObj) {
    console.error(`Invalid blunder move: ${blunderSanFromPgn}`);
    throw new Error(`Invalid blunder move: ${blunderSanFromPgn}`);
  }

  const blunderUci = blunderMoveObj.from + blunderMoveObj.to + (blunderMoveObj.promotion || '');
  const blunderSan = blunderMoveObj.san;

  // Position AFTER the blunder (standard Lichess puzzle position)
  const fen = chess.fen();

  // Convert solution UCI moves to SAN
  // We need to play through the solution to get proper SAN notation
  const solutionSan: string[] = [];
  const solutionUci = puzzle.solution;

  for (const uci of solutionUci) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    const move = chess.move({ from, to, promotion });
    if (move) {
      solutionSan.push(move.san);
    } else {
      console.error(`Invalid solution move: ${uci}`);
      solutionSan.push(uci); // Fallback to UCI
    }
  }

  // Calculate average game rating
  const gameRating = Math.round(
    game.players.reduce((sum, p) => sum + p.rating, 0) / game.players.length
  );

  return {
    id: puzzle.id,
    fen,           // Position after blunder (standard Lichess puzzle position)
    preFen,        // Position before blunder (what we show in BlunderRush)
    blunderUci,    // The blunder in UCI format
    blunderSan,    // The blunder in SAN format
    solutionUci,   // The winning response in UCI
    solutionSan,   // The winning response in SAN
    rating: puzzle.rating,
    themes: puzzle.themes,
    gameUrl: `https://lichess.org/${game.id}`,
    puzzleUrl: `https://lichess.org/training/${puzzle.id}`,
    plays: puzzle.plays,
    gameRating,
    gameType: game.perf.name,
    opponentLastMove,
    gameMoves,
    rawResponse: response,
  };
}

/**
 * Fetch and process a random puzzle for BlunderRush
 */
export async function getRandomBlunderPuzzle(): Promise<ProcessedPuzzle> {
  const response = await fetchRandomPuzzle();
  return processLichessPuzzle(response);
}

/**
 * Fetch and process the daily puzzle for BlunderRush
 */
export async function getDailyBlunderPuzzle(): Promise<ProcessedPuzzle> {
  const response = await fetchDailyPuzzle();
  return processLichessPuzzle(response);
}

/**
 * Fetch and process a specific puzzle for BlunderRush
 */
export async function getBlunderPuzzleById(id: string): Promise<ProcessedPuzzle> {
  const response = await fetchPuzzleById(id);
  return processLichessPuzzle(response);
}
