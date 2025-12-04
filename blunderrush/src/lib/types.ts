/**
 * BlunderRush Type Definitions
 */

// Re-export from lichess.ts for convenience
export type { ProcessedPuzzle } from './lichess';

export interface PuzzleState {
  puzzleId: string;
  // Position BEFORE the blunder - what we show to the user
  initialFen: string;
  // Position AFTER the blunder - what we're trying to match
  targetFen: string;
  // The historical blunder move (UCI format)
  blunderMove: string;
  // The winning response after the blunder
  solution: string[];
  // Current board position
  currentFen: string;
  // Wrong guesses made by the user
  wrongGuesses: GuessEvaluation[];
  // Puzzle metadata
  rating: number;
  themes: string[];
  gameUrl: string;
  // Puzzle status
  solved: boolean;
  failed: boolean;
  attempts: number;
}

export interface GuessEvaluation {
  move: string; // UCI format
  eval: number; // Centipawn evaluation
  fen: string; // Resulting FEN
}

export interface EvaluationResult {
  score: number; // Centipawn score (positive = white advantage)
  mate?: number; // Mate in N moves (positive = white mates, negative = black mates)
}
