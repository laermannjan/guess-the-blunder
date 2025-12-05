<script lang="ts">
  import { onMount } from 'svelte';
  import ChessBoard from '$lib/components/ChessBoard.svelte';
  import { getRandomBlunderPuzzle, type ProcessedPuzzle } from '$lib/lichess';
  import { Chess } from 'chess.js';
  import { fenPositionsMatch } from '$lib/chess';

  let puzzle: ProcessedPuzzle | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Game state
  let currentFen = $state('');
  let solved = $state(false);
  let attempts = $state(0);
  let lastGuessSan = $state<string | null>(null);
  let lastGuessCorrect = $state<boolean | null>(null);
  let showSolution = $state(false);

  // For playing out the solution
  let solutionStep = $state(0);
  let playingSolution = $state(false);

  let chessBoardRef: ChessBoard;

  async function loadPuzzle() {
    loading = true;
    error = null;
    solved = false;
    attempts = 0;
    lastGuessSan = null;
    lastGuessCorrect = null;
    showSolution = false;
    solutionStep = 0;
    playingSolution = false;

    try {
      puzzle = await getRandomBlunderPuzzle();
      currentFen = puzzle.preFen;  // Show position BEFORE the blunder
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load puzzle';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadPuzzle();
  });

  function handleMove(move: { from: string; to: string; uci: string; san: string; fen: string }) {
    if (!puzzle || solved || playingSolution) return;

    attempts++;
    lastGuessSan = move.san;

    // Check if the move matches the historical blunder
    // We compare the resulting FEN with the puzzle's target FEN
    if (fenPositionsMatch(move.fen, puzzle.fen)) {
      // Correct! They found the blunder
      solved = true;
      lastGuessCorrect = true;
      currentFen = move.fen;
    } else {
      // Wrong guess
      lastGuessCorrect = false;
      // Reset the board to try again
      setTimeout(() => {
        currentFen = puzzle!.preFen;
        chessBoardRef?.setPosition(puzzle!.preFen);
      }, 500);
    }
  }

  function playSolutionStep() {
    if (!puzzle || solutionStep >= puzzle.solutionUci.length) {
      playingSolution = false;
      return;
    }

    const chess = new Chess(solutionStep === 0 ? puzzle.fen : currentFen);
    const uciMove = puzzle.solutionUci[solutionStep];
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

    try {
      const move = chess.move({ from, to, promotion });
      if (move) {
        currentFen = chess.fen();
        chessBoardRef?.setPosition(currentFen, { from, to });
        solutionStep++;

        // Continue playing solution
        if (solutionStep < puzzle.solutionUci.length) {
          setTimeout(playSolutionStep, 800);
        } else {
          playingSolution = false;
        }
      }
    } catch (e) {
      console.error('Error playing solution move:', e);
      playingSolution = false;
    }
  }

  function startSolution() {
    if (!puzzle || !solved) return;
    showSolution = true;
    playingSolution = true;
    solutionStep = 0;
    currentFen = puzzle.fen;  // Start from post-blunder position
    chessBoardRef?.setPosition(puzzle.fen);
    setTimeout(playSolutionStep, 500);
  }

  // Determine whose turn it is from the FEN
  function getTurnFromFen(fen: string): 'White' | 'Black' {
    const parts = fen.split(' ');
    return parts[1] === 'w' ? 'White' : 'Black';
  }
</script>

<main>
  <h1>Guess the Blunder</h1>
  <p class="subtitle">Find the blunder that was actually played in the game!</p>

  {#if loading}
    <div class="loading">Loading puzzle from Lichess...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button onclick={loadPuzzle}>Try Again</button>
    </div>
  {:else if puzzle}
    <div class="puzzle-container">
      <div class="board-section">
        <div class="game-rating">
          <span class="rating-label">{puzzle.gameType}</span>
          <span class="rating-value">~{puzzle.gameRating}</span>
        </div>
        <ChessBoard
          bind:this={chessBoardRef}
          fen={currentFen}
          orientation={getTurnFromFen(puzzle.preFen) === 'White' ? 'white' : 'black'}
          interactive={!solved && !playingSolution}
          onMove={handleMove}
          lastMove={puzzle.opponentLastMove ? { from: puzzle.opponentLastMove.from, to: puzzle.opponentLastMove.to } : undefined}
          lastMoveColor="red"
        />
      </div>

      <div class="info-section">
        <div class="puzzle-info">
          <h3>Puzzle Info</h3>
          <p><strong>ID:</strong> {puzzle.id}</p>
          <p><strong>Rating:</strong> {puzzle.rating}</p>
          <p><strong>Themes:</strong> {puzzle.themes.join(', ') || 'none'}</p>
          <p><strong>Plays:</strong> {puzzle.plays.toLocaleString()}</p>
          <p>
            <a href={puzzle.gameUrl} target="_blank" rel="noopener">
              View original game ↗
            </a>
          </p>
          <p>
            <a href={puzzle.puzzleUrl} target="_blank" rel="noopener">
              View Lichess puzzle ↗
            </a>
          </p>
        </div>

        <div class="task">
          <h3>Your Task</h3>
          {#if !solved}
            <p class="instruction">
              <strong>{getTurnFromFen(puzzle.preFen)}</strong> to move.
              Find the blunder that was played in the actual game!
            </p>
          {:else}
            <p class="success">
              Correct! You found the blunder: <strong>{lastGuessSan}</strong>
            </p>
          {/if}
        </div>

        <div class="feedback">
          {#if lastGuessSan && !solved}
            <p class="wrong">
              <strong>{lastGuessSan}</strong> is not the blunder. Try again!
            </p>
          {/if}
          <p class="attempts">Attempts: {attempts}</p>
        </div>

        {#if solved}
          <div class="solution-section">
            {#if !showSolution}
              <button class="solution-btn" onclick={startSolution}>
                Show why it's bad →
              </button>
            {:else}
              <p class="solution-info">
                {#if playingSolution}
                  Playing the punishment...
                {:else}
                  The opponent's winning response: {puzzle.solutionSan.join(' ')}
                {/if}
              </p>
            {/if}
          </div>
        {/if}

        <div class="actions">
          <button onclick={loadPuzzle}>
            {solved ? 'Next Puzzle' : 'Skip Puzzle'}
          </button>
        </div>

        <details class="debug">
          <summary>Debug Info</summary>
          <pre>
Puzzle ID: {puzzle.id}
Pre-FEN (shown): {puzzle.preFen}
Post-FEN (target): {puzzle.fen}
Blunder move: {puzzle.blunderSan} ({puzzle.blunderUci})
Solution (SAN): {puzzle.solutionSan.join(' ')}
Solution (UCI): {puzzle.solutionUci.join(' ')}

=== Raw API Response ===
{JSON.stringify(puzzle.rawResponse, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 20px;
    background: #1a1a2e;
    color: #eee;
    min-height: 100vh;
  }

  main {
    max-width: 1000px;
    margin: 0 auto;
  }

  h1 {
    text-align: center;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    text-align: center;
    color: #888;
    margin-bottom: 2rem;
  }

  .loading, .error {
    text-align: center;
    padding: 2rem;
  }

  .error {
    color: #ff6b6b;
  }

  .puzzle-container {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .board-section {
    width: 100%;
    max-width: 480px;
  }

  .game-rating {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #2a2a4a;
    padding: 0.5rem 1rem;
    border-radius: 8px 8px 0 0;
    margin-bottom: -4px;
  }

  .rating-label {
    color: #aaa;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .rating-value {
    color: #fff;
    font-weight: bold;
    font-size: 1.1rem;
  }

  .info-section {
    flex: 1;
    min-width: 280px;
    max-width: 400px;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
    color: #aaa;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .puzzle-info {
    background: #2a2a4a;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .puzzle-info p {
    margin: 0.3rem 0;
    font-size: 0.9rem;
  }

  .puzzle-info a {
    color: #8f8;
  }

  .task {
    background: #2a2a4a;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .instruction {
    margin: 0;
    font-size: 1.1rem;
  }

  .success {
    margin: 0;
    color: #4ade80;
    font-size: 1.1rem;
  }

  .feedback {
    margin-bottom: 1rem;
  }

  .wrong {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
    padding: 0.5rem 1rem;
    border-radius: 4px;
  }

  .attempts {
    color: #888;
    font-size: 0.9rem;
  }

  .solution-section {
    margin-bottom: 1rem;
  }

  .solution-btn {
    width: 100%;
    padding: 0.8rem;
    background: #4a4a7a;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
  }

  .solution-btn:hover {
    background: #5a5a8a;
  }

  .solution-info {
    background: #3a3a5a;
    padding: 1rem;
    border-radius: 6px;
    font-family: monospace;
  }

  .actions {
    margin-top: 1rem;
  }

  button {
    padding: 0.6rem 1.2rem;
    border: none;
    border-radius: 6px;
    background: #3a3a5a;
    color: #fff;
    cursor: pointer;
    font-size: 0.9rem;
  }

  button:hover {
    background: #4a4a7a;
  }

  .debug {
    margin-top: 2rem;
    font-size: 0.8rem;
    color: #666;
  }

  .debug summary {
    cursor: pointer;
  }

  .debug pre {
    background: #1a1a2a;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  @media (max-width: 768px) {
    .puzzle-container {
      flex-direction: column;
      align-items: center;
    }

    .info-section {
      width: 100%;
      max-width: 480px;
    }
  }
</style>
