<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import ChessBoard from '$lib/components/ChessBoard.svelte';
  import { getBlunderPuzzleById, getRandomBlunderPuzzle, type ProcessedPuzzle, type GameMove } from '$lib/lichess';
  import { Chess } from 'chess.js';
  import { fenPositionsMatch } from '$lib/chess';
  import { evaluatePosition, getMoveFeedback, type EvalResult } from '$lib/stockfish';
  import MoveHistory from '$lib/components/MoveHistory.svelte';

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

  // Stockfish evaluation state
  let feedbackMessage = $state<string | null>(null);
  let evaluating = $state(false);
  let blunderEval = $state<EvalResult | null>(null);

  // For playing out the solution
  let solutionStep = $state(0);
  let playingSolution = $state(false);

  // For move history navigation
  let currentMoveIndex = $state(-1);
  let viewingHistory = $state(false);

  let chessBoardRef: ChessBoard;

  // Get puzzle ID from URL
  const puzzleId = $derived($page.params.id!);

  async function loadPuzzle(id: string) {
    loading = true;
    error = null;
    solved = false;
    attempts = 0;
    lastGuessSan = null;
    lastGuessCorrect = null;
    showSolution = false;
    solutionStep = 0;
    playingSolution = false;
    feedbackMessage = null;
    blunderEval = null;
    currentMoveIndex = -1;
    viewingHistory = false;

    try {
      puzzle = await getBlunderPuzzleById(id);
      currentFen = puzzle.preFen;

      // Pre-evaluate the blunder position for comparison (in background)
      if (browser) {
        evaluatePosition(puzzle.fen, 12).then((evalResult) => {
          blunderEval = evalResult;
        }).catch(console.error);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load puzzle';
    } finally {
      loading = false;
    }
  }

  async function loadRandomPuzzle() {
    loading = true;
    error = null;

    try {
      const randomPuzzle = await getRandomBlunderPuzzle();
      // Navigate to the puzzle's URL
      goto(`/blunder/${randomPuzzle.id}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load puzzle';
      loading = false;
    }
  }

  // Track which puzzle ID we've loaded to avoid double-loading
  let loadedPuzzleId: string | null = null;

  // Load puzzle when ID changes
  $effect(() => {
    if (puzzleId && puzzleId !== loadedPuzzleId) {
      loadedPuzzleId = puzzleId;
      loadPuzzle(puzzleId);
    }
  });

  async function handleMove(move: { from: string; to: string; uci: string; san: string; fen: string }) {
    if (!puzzle || solved || playingSolution || evaluating) return;

    attempts++;
    lastGuessSan = move.san;
    feedbackMessage = null;

    if (fenPositionsMatch(move.fen, puzzle.fen)) {
      solved = true;
      lastGuessCorrect = true;
      currentFen = move.fen;
    } else {
      lastGuessCorrect = false;

      // Evaluate the wrong guess with Stockfish
      if (browser && blunderEval) {
        evaluating = true;
        try {
          const userMoveEval = await evaluatePosition(move.fen, 12);
          feedbackMessage = getMoveFeedback(userMoveEval, blunderEval);
        } catch (e) {
          console.error('Stockfish evaluation failed:', e);
          feedbackMessage = "That's not the blunder. Try again!";
        } finally {
          evaluating = false;
        }
      } else {
        feedbackMessage = "That's not the blunder. Try again!";
      }

      // Reset the board after showing feedback
      setTimeout(() => {
        currentFen = puzzle!.preFen;
        chessBoardRef?.setPosition(puzzle!.preFen);
      }, 1500);
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
    currentFen = puzzle.fen;
    chessBoardRef?.setPosition(puzzle.fen);
    setTimeout(playSolutionStep, 500);
  }

  function getTurnFromFen(fen: string): 'White' | 'Black' {
    const parts = fen.split(' ');
    return parts[1] === 'w' ? 'White' : 'Black';
  }

  function handleHistoryNavigate(index: number) {
    if (!puzzle) return;

    currentMoveIndex = index;
    viewingHistory = true;

    if (index === -1) {
      // Starting position (before any moves)
      currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      chessBoardRef?.setPosition(currentFen);
    } else if (index < puzzle.gameMoves.length) {
      const move = puzzle.gameMoves[index];
      currentFen = move.fen;
      chessBoardRef?.setPosition(currentFen, { from: move.from, to: move.to });
    }
  }

  function returnToCurrentPosition() {
    if (!puzzle) return;
    viewingHistory = false;
    currentMoveIndex = puzzle.gameMoves.length - 1;
    currentFen = puzzle.preFen;
    chessBoardRef?.setPosition(currentFen, puzzle.opponentLastMove ? { from: puzzle.opponentLastMove.from, to: puzzle.opponentLastMove.to } : undefined);
  }
</script>

<main>
  <h1>Guess the Blunder</h1>
  <p class="subtitle">Find the blunder that was actually played in the game!</p>

  {#if loading}
    <div class="loading">Loading puzzle...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button onclick={() => loadPuzzle(puzzleId)}>Try Again</button>
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
          {#if evaluating}
            <p class="evaluating">Analyzing your move...</p>
          {:else if feedbackMessage && !solved}
            <p class="wrong">
              <strong>{lastGuessSan}</strong> - {feedbackMessage}
            </p>
          {/if}
          <p class="attempts">Attempts: {attempts}</p>
        </div>

        {#if solved}
          <div class="solution-section">
            {#if !showSolution}
              <button class="solution-btn" onclick={startSolution}>
                Show why it's bad
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
          <button onclick={loadRandomPuzzle}>
            {solved ? 'Next Puzzle' : 'Skip Puzzle'}
          </button>
        </div>

        <div class="puzzle-meta">
          <p>
            <a href={puzzle.puzzleUrl} target="_blank" rel="noopener">
              View on Lichess
            </a>
            &middot;
            <a href={puzzle.gameUrl} target="_blank" rel="noopener">
              Original game
            </a>
          </p>
        </div>

        <div class="move-explorer">
          <div class="move-explorer-header">
            <h3>Game Moves</h3>
            {#if viewingHistory}
              <button class="return-btn" onclick={returnToCurrentPosition}>
                Return to puzzle
              </button>
            {/if}
          </div>
          <MoveHistory
            moves={puzzle.gameMoves}
            currentMoveIndex={viewingHistory ? currentMoveIndex : puzzle.gameMoves.length - 1}
            puzzleStartIndex={puzzle.gameMoves.length - 1}
            onNavigate={handleHistoryNavigate}
          />
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    font-family: 'Berkeley Mono', 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
    margin: 0;
    padding: 20px;
    background: #161512;
    color: #bababa;
    min-height: 100vh;
  }

  main {
    max-width: 1000px;
    margin: 0 auto;
  }

  h1 {
    text-align: center;
    margin-bottom: 0.5rem;
    color: #fff;
    font-weight: 500;
  }

  .subtitle {
    text-align: center;
    color: #787672;
    margin-bottom: 2rem;
  }

  .loading, .error {
    text-align: center;
    padding: 2rem;
  }

  .error {
    color: #e06c6c;
  }

  .puzzle-container {
    display: flex;
    gap: 1.5rem;
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
    background: #262421;
    padding: 0.5rem 0.75rem;
    border-radius: 3px 3px 0 0;
    margin-bottom: -1px;
  }

  .rating-label {
    color: #787672;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .rating-value {
    color: #bababa;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .info-section {
    flex: 1;
    min-width: 280px;
    max-width: 400px;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
    color: #787672;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 500;
  }

  .task {
    background: #262421;
    padding: 0.875rem;
    border-radius: 3px;
    margin-bottom: 0.75rem;
  }

  .instruction {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .success {
    margin: 0;
    color: #7fbd6a;
    font-size: 0.95rem;
  }

  .feedback {
    margin-bottom: 0.75rem;
  }

  .wrong {
    color: #e06c6c;
    background: #2b2220;
    padding: 0.5rem 0.75rem;
    border-radius: 2px;
    border-left: 2px solid #e06c6c;
  }

  .evaluating {
    color: #6c9ce0;
    background: #202028;
    padding: 0.5rem 0.75rem;
    border-radius: 2px;
    border-left: 2px solid #6c9ce0;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .attempts {
    color: #787672;
    font-size: 0.8rem;
  }

  .solution-section {
    margin-bottom: 0.75rem;
  }

  .solution-btn {
    width: 100%;
    padding: 0.625rem;
    background: #2b2926;
    color: #bababa;
    border: 1px solid #3d3a37;
    border-radius: 2px;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
    transition: background 0.1s, border-color 0.1s;
  }

  .solution-btn:hover {
    background: #3d3a37;
    border-color: #4d4a47;
  }

  .solution-info {
    background: #2b2926;
    padding: 0.75rem;
    border-radius: 2px;
    border-left: 2px solid #3692e7;
    font-size: 0.9rem;
  }

  .actions {
    margin-bottom: 0.75rem;
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid #3d3a37;
    border-radius: 2px;
    background: #2b2926;
    color: #bababa;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
    transition: background 0.1s, border-color 0.1s;
  }

  button:hover {
    background: #3d3a37;
    border-color: #4d4a47;
  }

  .puzzle-meta {
    color: #5c5955;
    font-size: 0.8rem;
  }

  .puzzle-meta a {
    color: #6c9c6c;
    text-decoration: none;
  }

  .puzzle-meta a:hover {
    text-decoration: underline;
  }

  .move-explorer {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    max-height: 300px;
  }

  .move-explorer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.375rem;
  }

  .move-explorer h3 {
    margin: 0;
    color: #787672;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .move-explorer :global(.move-history) {
    flex: 1;
    min-height: 0;
  }

  .return-btn {
    padding: 0.25rem 0.5rem;
    background: #2a3a2a;
    color: #7fbd6a;
    border: 1px solid #3a4a3a;
    border-radius: 2px;
    cursor: pointer;
    font-size: 0.7rem;
    font-family: inherit;
  }

  .return-btn:hover {
    background: #3a4a3a;
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
