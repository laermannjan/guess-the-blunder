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

  let puzzle = $state<ProcessedPuzzle | null>(null);
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

  // Hint state
  let hintUsed = $state(false);

  // Last move highlight state (tracks current last move to display)
  let displayLastMove = $state<{ from: string; to: string } | null>(null);
  let displayLastMoveColor = $state<'green' | 'red'>('red');

  let chessBoardRef: ChessBoard;

  // Get the blunder source square from the UCI move
  const blunderSquare = $derived(puzzle?.blunderUci?.slice(0, 2));

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
    hintUsed = false;

    try {
      puzzle = await getBlunderPuzzleById(id);
      currentFen = puzzle.preFen;

      // Initialize last move display to opponent's last move
      displayLastMove = puzzle.opponentLastMove
        ? { from: puzzle.opponentLastMove.from, to: puzzle.opponentLastMove.to }
        : null;
      displayLastMoveColor = 'red';

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
      // Show the correct blunder move in green
      displayLastMove = { from: move.from, to: move.to };
      displayLastMoveColor = 'green';
    } else {
      lastGuessCorrect = false;

      // Show the user's attempted move in green
      displayLastMove = { from: move.from, to: move.to };
      displayLastMoveColor = 'green';

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
        // Reset to opponent's last move (red)
        displayLastMove = puzzle!.opponentLastMove
          ? { from: puzzle!.opponentLastMove.from, to: puzzle!.opponentLastMove.to }
          : null;
        displayLastMoveColor = 'red';
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

  function useHint() {
    hintUsed = true;
  }

  function revealSolution() {
    if (!puzzle) return;
    solved = true;
    lastGuessSan = puzzle.blunderSan;
    currentFen = puzzle.fen;
    chessBoardRef?.setPosition(puzzle.fen);
  }
</script>

<main>
  <header class="page-header">
    <h1>Guess the Blunder</h1>
    {#if puzzle && !solved}
      <p class="task-info">
        <strong>{getTurnFromFen(puzzle.preFen)}</strong> to move. Find the blunder that was played!
      </p>
    {:else if puzzle && solved}
      <p class="task-info success">
        Correct! You found the blunder: <strong>{lastGuessSan}</strong>
      </p>
    {:else}
      <p class="task-info">Find the blunder that was actually played in the game!</p>
    {/if}
  </header>

  {#if loading}
    <div class="loading">Loading puzzle...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button onclick={() => loadPuzzle(puzzleId)}>Try Again</button>
    </div>
  {:else if puzzle}
    <div class="puzzle-container">
      <div class="meta-panel">
        <div class="meta-item puzzle-info">
          <div class="meta-row">
            <span class="meta-label">Puzzle</span>
            <a href={puzzle.puzzleUrl} target="_blank" rel="noopener" class="puzzle-id">#{puzzle.id}</a>
          </div>
          <div class="meta-row">
            <span class="meta-label">Rating</span>
            <span class="meta-value">{puzzle.rating}</span>
          </div>
        </div>
        <div class="meta-item game-info">
          <div class="meta-row">
            <span class="meta-label">Mode</span>
            <span class="meta-value">{puzzle.gameType}{#if puzzle.rawResponse.game.clock} ({puzzle.rawResponse.game.clock}){/if}</span>
          </div>
          <div class="players">
            {#each [...puzzle.rawResponse.game.players].sort((a, b) => a.color === 'white' ? -1 : 1) as player}
              <div class="player">
                <span class="player-color {player.color}"></span>
                <span class="meta-value">{player.name}</span>
                <span class="meta-label">{player.rating}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="board-section">
        <ChessBoard
          bind:this={chessBoardRef}
          fen={currentFen}
          orientation={getTurnFromFen(puzzle.preFen) === 'White' ? 'white' : 'black'}
          interactive={!solved && !playingSolution}
          onMove={handleMove}
          lastMove={displayLastMove ?? undefined}
          lastMoveColor={displayLastMoveColor}
          highlightSquare={hintUsed && !solved ? blunderSquare : undefined}
        />
      </div>

      <div class="info-section">
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

        <div class="feedback-section">
          <div class="feedback-header">
            <span class="attempts-label">Attempt {attempts}</span>
          </div>
          <div class="feedback-box">
            {#if evaluating}
              <p class="evaluating">Analyzing your move...</p>
            {:else if solved}
              <p class="success-msg">
                Correct! <strong>{lastGuessSan}</strong> was the blunder.
              </p>
              {#if !showSolution}
                <button class="solution-btn" onclick={startSolution}>
                  Show why it's bad
                </button>
              {:else}
                <p class="solution-info">
                  {#if playingSolution}
                    Playing the punishment...
                  {:else}
                    Opponent's response: {puzzle.solutionSan.join(' ')}
                  {/if}
                </p>
              {/if}
            {:else if feedbackMessage}
              <p class="wrong-msg">
                <strong>{lastGuessSan}</strong> - {feedbackMessage}
              </p>
            {:else}
              <p class="waiting-msg">Make a move to guess the blunder</p>
            {/if}
          </div>
          <div class="button-row">
            {#if !solved}
              {#if !hintUsed}
                <button class="hint-btn" onclick={useHint}>Hint</button>
              {:else}
                <button class="hint-btn" onclick={revealSolution}>Show Answer</button>
              {/if}
            {/if}
            <button class="skip-btn" onclick={() => loadRandomPuzzle()}>
              {solved ? 'Next Puzzle' : 'Skip'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 1000px;
    margin: 0 auto;
  }

  .page-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  h1 {
    margin-bottom: 0.25rem;
    color: #fff;
    font-weight: 500;
  }

  .task-info {
    color: #787672;
    margin: 0;
    font-size: 0.9rem;
  }

  .task-info.success {
    color: #81b64c;
  }

  .task-info strong {
    color: #bababa;
  }

  .loading, .error {
    text-align: center;
    padding: 2rem;
  }

  .error {
    color: #e06c6c;
  }

  .puzzle-container {
    display: grid;
    grid-template-columns: 1fr minmax(300px, 480px) 1fr;
    gap: 1rem;
    align-items: start;
    max-width: 1200px;
    margin: 0 auto;
  }

  @media (max-width: 900px) {
    .puzzle-container {
      grid-template-columns: 1fr;
      max-width: 480px;
    }
    .meta-panel {
      order: -1;
      flex-direction: row;
      flex-wrap: wrap;
    }
    .meta-panel .meta-item {
      flex: 1;
      min-width: 140px;
    }
  }

  .meta-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .meta-item {
    background: #262421;
    padding: 0.5rem 0.625rem;
    border-radius: 2px;
  }

  .puzzle-info, .game-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
  }

  .meta-label {
    color: #787672;
  }

  .meta-value {
    color: #bababa;
  }

  .puzzle-id {
    color: #6c9ce0;
    text-decoration: none;
  }

  .puzzle-id:hover {
    text-decoration: underline;
  }

  .players {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .player {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    overflow: hidden;
  }

  .player .meta-value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .player .meta-label {
    flex-shrink: 0;
  }

  .player-color {
    width: 10px;
    height: 10px;
    border-radius: 1px;
    flex-shrink: 0;
  }

  .player-color.white {
    background: #fff;
    border: 1px solid #3d3a37;
  }

  .player-color.black {
    background: #000;
  }

  .board-section {
    width: 100%;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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

  .feedback-section {
    display: flex;
    flex-direction: column;
  }

  .feedback-header {
    margin-bottom: 0.25rem;
  }

  .attempts-label {
    color: #787672;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .feedback-box {
    background: #262421;
    padding: 0.75rem;
    border-radius: 2px 2px 0 0;
    min-height: 3rem;
  }

  .feedback-box p {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .waiting-msg {
    color: #787672;
  }

  .success-msg {
    color: #81b64c;
    margin-bottom: 0.5rem !important;
  }

  .wrong-msg {
    color: #e06c6c;
  }

  .evaluating {
    color: #6c9ce0;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .solution-btn {
    width: 100%;
    padding: 0.5rem;
    margin-top: 0.5rem;
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
    margin-top: 0.5rem;
    padding: 0.5rem;
    border-radius: 2px;
    border-left: 2px solid #3692e7;
    font-size: 0.85rem;
    background: #1e1d1b;
  }

  .button-row {
    display: flex;
    gap: 0;
  }

  .hint-btn {
    flex: 1;
    padding: 0.625rem;
    background: #2b2926;
    color: #bababa;
    border: none;
    border-right: 1px solid #1e1d1b;
    border-radius: 0 0 0 2px;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
    transition: background 0.1s;
  }

  .hint-btn:hover {
    background: #3d3a37;
  }

  .skip-btn {
    flex: 1;
    padding: 0.625rem;
    background: #3d3a37;
    color: #bababa;
    border: none;
    border-radius: 0 0 2px 0;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
    transition: background 0.1s;
  }

  .button-row .skip-btn:only-child {
    border-radius: 0 0 2px 2px;
  }

  .skip-btn:hover {
    background: #4d4a47;
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

  .move-explorer {
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

  @media (max-width: 900px) {
    .meta-panel {
      flex-direction: row;
      flex-wrap: wrap;
      max-width: 100%;
      width: 100%;
      justify-content: center;
    }

    .meta-item {
      flex: 0 0 auto;
    }

    .meta-item.players {
      flex-direction: row;
      gap: 1rem;
    }
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
