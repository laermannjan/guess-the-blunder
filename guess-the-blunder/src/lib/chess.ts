/**
 * Chess.js wrapper for BlunderRush
 * Handles move validation, FEN parsing, and game state
 */

import { Chess, type Move, type Square } from 'chess.js';
import type { Key } from 'chessground/types';

export type { Move, Square };

export interface LegalMoves {
  [square: string]: string[];
}

/**
 * Get all legal moves for the current position
 * Returns a map from source square to array of destination squares
 */
export function getLegalMoves(chess: Chess): LegalMoves {
  const moves = chess.moves({ verbose: true });
  const dests: LegalMoves = {};

  for (const move of moves) {
    if (!dests[move.from]) {
      dests[move.from] = [];
    }
    dests[move.from].push(move.to);
  }

  return dests;
}

/**
 * Convert our LegalMoves format to Chessground's expected Map format
 */
export function toChessgroundDests(legalMoves: LegalMoves): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const [from, tos] of Object.entries(legalMoves)) {
    dests.set(from as Key, tos as Key[]);
  }
  return dests;
}

/**
 * Get the color to move from a FEN string
 */
export function getTurnFromFen(fen: string): 'white' | 'black' {
  const parts = fen.split(' ');
  return parts[1] === 'w' ? 'white' : 'black';
}

/**
 * Flip the turn indicator in a FEN string
 * This is the core of the reverse puzzle logic
 */
export function flipFenTurn(fen: string): string {
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  return parts.join(' ');
}

/**
 * Convert UCI move format (e.g., "e2e4") to chess.js move format
 */
export function uciToMove(uci: string): { from: Square; to: Square; promotion?: string } {
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.length > 4 ? uci[4] : undefined;
  return { from, to, promotion };
}

/**
 * Convert chess.js move to UCI format
 */
export function moveToUci(move: Move): string {
  let uci = move.from + move.to;
  if (move.promotion) {
    uci += move.promotion;
  }
  return uci;
}

/**
 * Normalize a FEN for comparison (ignores halfmove and fullmove counters)
 * This is useful because two positions can be "the same" even with different move counts
 */
export function normalizeFenForComparison(fen: string): string {
  const parts = fen.split(' ');
  // Keep: piece placement, active color, castling, en passant
  // Ignore: halfmove clock, fullmove number
  return parts.slice(0, 4).join(' ');
}

/**
 * Check if two FENs represent the same position (ignoring move counts)
 */
export function fenPositionsMatch(fen1: string, fen2: string): boolean {
  return normalizeFenForComparison(fen1) === normalizeFenForComparison(fen2);
}

/**
 * Create a new Chess instance from a FEN
 */
export function createChess(fen?: string): Chess {
  return new Chess(fen);
}
