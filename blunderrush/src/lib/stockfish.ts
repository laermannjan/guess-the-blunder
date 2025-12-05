/**
 * Stockfish.wasm integration for position evaluation
 *
 * Uses a Web Worker to avoid blocking the UI.
 * Provides position evaluation in centipawns or mate scores.
 */

export interface EvalResult {
  // Centipawn score from the perspective of the side to move
  // Positive = good for side to move, negative = bad
  score: number;
  // If mate is found, number of moves to mate (positive = we mate, negative = we get mated)
  mate: number | null;
  // Best move found (UCI format)
  bestMove: string | null;
  // Depth searched
  depth: number;
}

type MessageHandler = (result: EvalResult) => void;

class StockfishEngine {
  private worker: Worker | null = null;
  private isReady = false;
  private pendingEval: MessageHandler | null = null;
  private initPromise: Promise<void> | null = null;
  private currentEval: Partial<EvalResult> = {};

  /**
   * Initialize the Stockfish engine
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      try {
        // Create a Web Worker from the stockfish module
        // We use the lite single-threaded version for browser compatibility
        this.worker = new Worker(
          new URL('stockfish/src/stockfish-17.1-lite-single-03e3232.js', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (e: MessageEvent) => {
          this.handleMessage(e.data);
        };

        this.worker.onerror = (e) => {
          console.error('Stockfish worker error:', e);
          reject(e);
        };

        // Send UCI initialization commands
        this.worker.postMessage('uci');

        // Wait for 'uciok' response
        const checkReady = () => {
          if (this.isReady) {
            resolve();
          } else {
            setTimeout(checkReady, 50);
          }
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error('Stockfish initialization timeout'));
          }
        }, 10000);

        checkReady();
      } catch (e) {
        reject(e);
      }
    });

    return this.initPromise;
  }

  private handleMessage(message: string) {
    // Handle UCI protocol messages
    if (message === 'uciok') {
      // Send isready to confirm engine is ready
      this.worker?.postMessage('isready');
    } else if (message === 'readyok') {
      this.isReady = true;
    } else if (message.startsWith('info depth')) {
      // Parse evaluation info
      this.parseInfoLine(message);
    } else if (message.startsWith('bestmove')) {
      // Evaluation complete
      const parts = message.split(' ');
      const bestMove = parts[1] || null;

      if (this.pendingEval) {
        this.pendingEval({
          score: this.currentEval.score ?? 0,
          mate: this.currentEval.mate ?? null,
          bestMove,
          depth: this.currentEval.depth ?? 0,
        });
        this.pendingEval = null;
      }
    }
  }

  private parseInfoLine(line: string) {
    const parts = line.split(' ');

    // Parse depth
    const depthIdx = parts.indexOf('depth');
    if (depthIdx !== -1 && parts[depthIdx + 1]) {
      this.currentEval.depth = parseInt(parts[depthIdx + 1], 10);
    }

    // Parse score
    const scoreIdx = parts.indexOf('score');
    if (scoreIdx !== -1) {
      const scoreType = parts[scoreIdx + 1];
      const scoreValue = parseInt(parts[scoreIdx + 2], 10);

      if (scoreType === 'cp') {
        // Centipawn score
        this.currentEval.score = scoreValue;
        this.currentEval.mate = null;
      } else if (scoreType === 'mate') {
        // Mate score
        this.currentEval.mate = scoreValue;
        // Convert mate to a large centipawn value for display
        this.currentEval.score = scoreValue > 0 ? 10000 - scoreValue * 100 : -10000 - scoreValue * 100;
      }
    }
  }

  /**
   * Evaluate a position
   * @param fen The FEN string of the position to evaluate
   * @param depth Search depth (default 15, higher = slower but more accurate)
   * @returns Promise resolving to evaluation result
   */
  async evaluate(fen: string, depth = 15): Promise<EvalResult> {
    if (!this.worker || !this.isReady) {
      await this.init();
    }

    return new Promise((resolve) => {
      this.currentEval = {};
      this.pendingEval = resolve;

      // Set position and start search
      this.worker?.postMessage(`position fen ${fen}`);
      this.worker?.postMessage(`go depth ${depth}`);
    });
  }

  /**
   * Stop any ongoing evaluation
   */
  stop() {
    this.worker?.postMessage('stop');
  }

  /**
   * Destroy the engine and free resources
   */
  destroy() {
    this.worker?.postMessage('quit');
    this.worker?.terminate();
    this.worker = null;
    this.isReady = false;
    this.initPromise = null;
  }
}

// Singleton instance
let engineInstance: StockfishEngine | null = null;

/**
 * Get the Stockfish engine instance (singleton)
 */
export function getEngine(): StockfishEngine {
  if (!engineInstance) {
    engineInstance = new StockfishEngine();
  }
  return engineInstance;
}

/**
 * Evaluate a position and return the result
 * @param fen Position to evaluate
 * @param depth Search depth (default 15)
 */
export async function evaluatePosition(fen: string, depth = 15): Promise<EvalResult> {
  const engine = getEngine();
  return engine.evaluate(fen, depth);
}

/**
 * Format an evaluation result for display
 * @param evalResult The evaluation result
 * @param perspective 'white' or 'black' - whose perspective to show
 * @returns Formatted string like "+1.5" or "M3" or "-2.3"
 */
export function formatEval(evalResult: EvalResult, perspective: 'white' | 'black' = 'white'): string {
  // Adjust score for perspective
  // Stockfish returns score from side-to-move's perspective
  // We may need to flip based on who we're showing it for
  let score = evalResult.score;
  let mate = evalResult.mate;

  if (mate !== null) {
    // Mate score
    if (mate > 0) {
      return `M${mate}`;
    } else {
      return `M${mate}`;
    }
  }

  // Centipawn score - convert to pawns
  const pawns = score / 100;
  if (pawns >= 0) {
    return `+${pawns.toFixed(1)}`;
  } else {
    return pawns.toFixed(1);
  }
}

/**
 * Get feedback message based on evaluation comparison
 * @param userMoveEval Evaluation after user's move
 * @param blunderEval Evaluation after the historical blunder
 * @returns Feedback message for the user
 */
export function getMoveFeedback(userMoveEval: EvalResult, blunderEval: EvalResult): string {
  const userScore = userMoveEval.score;
  const blunderScore = blunderEval.score;

  // Calculate the difference (positive = user's move is better for the side that moved)
  const diff = userScore - blunderScore;

  // If user's move leads to mate against them
  if (userMoveEval.mate !== null && userMoveEval.mate < 0) {
    return "That's also losing, but not the move played.";
  }

  // If the blunder leads to mate against the blunderer
  if (blunderEval.mate !== null && blunderEval.mate < 0) {
    if (userMoveEval.mate === null || userMoveEval.mate > 0) {
      return "Good thinking! That move avoids the disaster.";
    }
  }

  // Compare centipawn evaluations
  if (diff > 200) {
    return "That's actually a decent move! The game blunder was much worse.";
  } else if (diff > 50) {
    return "That's slightly better than what was played.";
  } else if (diff > -50) {
    return "That's about as bad as the game blunder, but not the one played.";
  } else if (diff > -200) {
    return "That's also a mistake, but the game blunder was worse.";
  } else {
    return "That's also a blunder, but not the one from the game.";
  }
}
