/**
 * BlunderRush Type Definitions
 */

export interface Puzzle {
  id: string;
  fen: string; // Position AFTER the blunder
  moves: string[]; // Solution moves (UCI format)
  rating: number;
  themes: string[];
  gameUrl: string;
  popularity?: number;
  suitabilityScore?: number;
  upvotes?: number;
  downvotes?: number;
  playCount?: number;
  solveCount?: number;
}

export interface PuzzleState {
  puzzleId: string;
  initialFen: string; // Position BEFORE the blunder (flipped turn)
  targetFen: string; // Position AFTER the blunder (what we're trying to match)
  targetMove: string; // The historical blunder move (UCI format)
  currentFen: string;
  moveHistory: string[]; // UCI moves made so far
  wrongGuesses: GuessEvaluation[];
  evaluations: {
    initial: number;
    target: number;
  };
  solved: boolean;
  gameUrl: string;
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
