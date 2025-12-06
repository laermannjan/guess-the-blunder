<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import ChessBoard from '$lib/components/ChessBoard.svelte';
  import MoveHistory from '$lib/components/MoveHistory.svelte';
  import { getBlunderPuzzleById, getRandomBlunderPuzzle, getBlunderingPlayer, type ProcessedPuzzle, type GameMove } from '$lib/lichess';
  import { Chess } from 'chess.js';

  let puzzle = $state<ProcessedPuzzle | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Game state
  let currentFen = $state('');
  let phase = $state<'animating' | 'guessing' | 'revealed'>('animating');

  // Move tracking for explorer
  let allMoves = $state<GameMove[]>([]);
  let currentMoveIndex = $state(-1);
  let blunderMoveIndex = $state(-1);
  let isAnimating = $state(false);

  // Guessing state
  let eloGuess = $state(1500);
  let actualElo = $state(0);
  let difference = $state(0);

  // Score tracking (stored in localStorage)
  let totalGuesses = $state(0);
  let totalDifference = $state(0);
  let streak = $state(0);
  let bestStreak = $state(0);

  // Last move display
  let displayLastMove = $state<{ from: string; to: string } | null>(null);

  let chessBoardRef: ChessBoard;

  // Get puzzle ID from URL
  const puzzleId = $derived($page.params.id!);

  // Blundering player info
  const blunderingPlayer = $derived(puzzle ? getBlunderingPlayer(puzzle) : null);

  // Navigable range: from one move before blunder to end of solution
  const minNavigableIndex = $derived(blunderMoveIndex > 0 ? blunderMoveIndex - 1 : 0);
  const maxNavigableIndex = $derived(allMoves.length - 1);

  // Load scores from localStorage
  onMount(() => {
    if (browser) {
      const saved = localStorage.getItem('elo-game-stats');
      if (saved) {
        const stats = JSON.parse(saved);
        totalGuesses = stats.totalGuesses || 0;
        totalDifference = stats.totalDifference || 0;
        bestStreak = stats.bestStreak || 0;
      }
    }
  });

  function saveStats() {
    if (browser) {
      localStorage.setItem('elo-game-stats', JSON.stringify({
        totalGuesses,
        totalDifference,
        bestStreak
      }));
    }
  }

  async function loadPuzzle(id: string) {
    loading = true;
    error = null;
    phase = 'animating';
    isAnimating = false;
    eloGuess = 1500;
    displayLastMove = null;
    allMoves = [];
    currentMoveIndex = -1;
    blunderMoveIndex = -1;

    try {
      puzzle = await getBlunderPuzzleById(id);

      // Build the combined moves list: game moves + blunder + solution
      buildMovesList(puzzle);

      // Start at the position before the blunder (one move before)
      const startIndex = blunderMoveIndex > 0 ? blunderMoveIndex - 1 : 0;
      currentMoveIndex = startIndex;

      if (startIndex >= 0 && startIndex < allMoves.length) {
        currentFen = allMoves[startIndex].fen;
        displayLastMove = { from: allMoves[startIndex].from, to: allMoves[startIndex].to };
      } else {
        currentFen = puzzle.preFen;
      }

      // Auto-start animation after a short delay
      setTimeout(startAnimation, 500);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load puzzle';
    } finally {
      loading = false;
    }
  }

  function buildMovesList(p: ProcessedPuzzle) {
    const moves: GameMove[] = [...p.gameMoves];

    // The blunder move index is where we insert the blunder
    blunderMoveIndex = moves.length;

    // Add the blunder move
    const chess = new Chess(p.preFen);
    const blunderFrom = p.blunderUci.slice(0, 2);
    const blunderTo = p.blunderUci.slice(2, 4);
    const blunderPromotion = p.blunderUci.length > 4 ? p.blunderUci[4] : undefined;

    const blunderMove = chess.move({ from: blunderFrom, to: blunderTo, promotion: blunderPromotion });
    if (blunderMove) {
      moves.push({
        san: blunderMove.san,
        fen: chess.fen(),
        color: blunderMove.color === 'w' ? 'white' : 'black',
        from: blunderFrom,
        to: blunderTo,
      });
    }

    // Add the solution moves
    for (const uci of p.solutionUci) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;

      const move = chess.move({ from, to, promotion });
      if (move) {
        moves.push({
          san: move.san,
          fen: chess.fen(),
          color: move.color === 'w' ? 'white' : 'black',
          from,
          to,
        });
      }
    }

    allMoves = moves;
  }

  const MOVE_DELAY = 1200;
  const INITIAL_DELAY = 1500;

  function startAnimation() {
    if (!puzzle || isAnimating) return;
    isAnimating = true;

    // Start from one move before the blunder
    const startIndex = blunderMoveIndex > 0 ? blunderMoveIndex - 1 : 0;
    currentMoveIndex = startIndex;

    // Animate to the blunder first
    setTimeout(() => animateToIndex(blunderMoveIndex), INITIAL_DELAY);
  }

  function animateToIndex(targetIndex: number) {
    if (!puzzle || targetIndex >= allMoves.length) {
      finishAnimation();
      return;
    }

    currentMoveIndex = targetIndex;
    const move = allMoves[targetIndex];
    currentFen = move.fen;
    chessBoardRef?.setPosition(currentFen, { from: move.from, to: move.to });
    displayLastMove = { from: move.from, to: move.to };

    // Continue animation for solution moves
    if (targetIndex < allMoves.length - 1 && targetIndex >= blunderMoveIndex) {
      setTimeout(() => animateToIndex(targetIndex + 1), MOVE_DELAY);
    } else {
      finishAnimation();
    }
  }

  function finishAnimation() {
    isAnimating = false;
    phase = 'guessing';
  }

  async function loadRandomPuzzle() {
    loading = true;
    error = null;

    try {
      const randomPuzzle = await getRandomBlunderPuzzle();
      goto(`/elo/${randomPuzzle.id}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load puzzle';
      loading = false;
    }
  }

  // Track which puzzle ID we've loaded
  let loadedPuzzleId: string | null = null;

  $effect(() => {
    if (puzzleId && puzzleId !== loadedPuzzleId) {
      loadedPuzzleId = puzzleId;
      loadPuzzle(puzzleId);
    }
  });

  function handleHistoryNavigate(index: number) {
    if (isAnimating || !puzzle) return;

    currentMoveIndex = index;

    if (index >= 0 && index < allMoves.length) {
      const move = allMoves[index];
      currentFen = move.fen;
      chessBoardRef?.setPosition(currentFen, { from: move.from, to: move.to });
      displayLastMove = { from: move.from, to: move.to };
    }
  }

  function submitGuess() {
    if (!puzzle || !blunderingPlayer) return;

    actualElo = blunderingPlayer.rating;
    difference = Math.abs(eloGuess - actualElo);

    // Update stats
    totalGuesses++;
    totalDifference += difference;

    // Update streak (within 200 Elo is "close enough")
    if (difference <= 200) {
      streak++;
      if (streak > bestStreak) {
        bestStreak = streak;
      }
    } else {
      streak = 0;
    }

    saveStats();
    phase = 'revealed';
  }

  function getScoreMessage(diff: number): string {
    if (diff <= 50) return "Incredible! Almost exact!";
    if (diff <= 100) return "Excellent guess!";
    if (diff <= 200) return "Very close!";
    if (diff <= 300) return "Not bad!";
    if (diff <= 500) return "Could be closer...";
    return "Way off!";
  }

  function getScoreColor(diff: number): string {
    if (diff <= 100) return '#81b64c';
    if (diff <= 200) return '#96bc4b';
    if (diff <= 300) return '#e6a23c';
    return '#e06c6c';
  }

  const averageDifference = $derived(totalGuesses > 0 ? Math.round(totalDifference / totalGuesses) : 0);
</script>

<main>
  <header class="page-header">
    <h1>Guess the Elo</h1>
    {#if puzzle && phase === 'animating'}
      <p class="task-info">
        {#if isAnimating}
          Watching the blunder and punishment...
        {:else}
          Loading...
        {/if}
      </p>
    {:else if puzzle && phase === 'guessing'}
      <p class="task-info">
        <strong>{blunderingPlayer?.color === 'white' ? 'White' : 'Black'}</strong> played <strong>{puzzle.blunderSan}??</strong> — what's their rating?
      </p>
    {:else if puzzle && phase === 'revealed'}
      <p class="task-info" style="color: {getScoreColor(difference)}">
        {getScoreMessage(difference)}
      </p>
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
        <div class="meta-item stats-box">
          <div class="stat-row">
            <span class="stat-label">Games</span>
            <span class="stat-value">{totalGuesses}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Avg Diff</span>
            <span class="stat-value">{averageDifference}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Streak</span>
            <span class="stat-value">{streak}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Best</span>
            <span class="stat-value">{bestStreak}</span>
          </div>
        </div>
        <div class="meta-item puzzle-info">
          <div class="meta-row">
            <span class="meta-label">Puzzle</span>
            <a href={puzzle.puzzleUrl} target="_blank" rel="noopener" class="puzzle-id">#{puzzle.id}</a>
          </div>
          <div class="meta-row">
            <span class="meta-label">Mode</span>
            <span class="meta-value">{puzzle.gameType}</span>
          </div>
        </div>
      </div>

      <div class="board-section">
        <ChessBoard
          bind:this={chessBoardRef}
          fen={currentFen}
          orientation={blunderingPlayer?.color || 'white'}
          interactive={false}
          lastMove={displayLastMove ?? undefined}
          lastMoveColor={currentMoveIndex === blunderMoveIndex ? 'red' : 'green'}
        />
      </div>

      <div class="info-section">
        <div class="move-explorer">
          <h3>Moves</h3>
          <MoveHistory
            moves={allMoves}
            currentMoveIndex={currentMoveIndex}
            blunderIndex={blunderMoveIndex}
            minNavigableIndex={minNavigableIndex}
            maxNavigableIndex={maxNavigableIndex}
            onNavigate={handleHistoryNavigate}
          />
        </div>

        {#if phase === 'guessing'}
          <div class="guess-box">
            <p class="blunder-info">
              <span class="color-indicator {blunderingPlayer?.color}"></span>
              played <strong>{puzzle.blunderSan}??</strong>
            </p>
            <div class="slider-container">
              <input
                type="range"
                min="400"
                max="2800"
                step="25"
                bind:value={eloGuess}
                class="elo-slider"
              />
              <div class="elo-display">{eloGuess}</div>
            </div>
            <div class="elo-labels">
              <span>400</span>
              <span>1000</span>
              <span>1600</span>
              <span>2200</span>
              <span>2800</span>
            </div>
            <button class="primary-btn submit-btn" onclick={submitGuess}>
              Submit Guess
            </button>
          </div>
        {:else if phase === 'revealed'}
          <div class="result-box">
            <div class="result-comparison">
              <div class="result-item">
                <span class="result-label">Your Guess</span>
                <span class="result-value">{eloGuess}</span>
              </div>
              <div class="result-item actual">
                <span class="result-label">Actual</span>
                <span class="result-value">{actualElo}</span>
              </div>
            </div>
            <div class="difference-display" style="color: {getScoreColor(difference)}">
              {difference === 0 ? 'Perfect!' : `Off by ${difference}`}
            </div>
            <div class="blunder-recap">
              <p>
                <span class="color-indicator {blunderingPlayer?.color}"></span>
                <strong>{blunderingPlayer?.name}</strong> ({actualElo}) played <strong>{puzzle.blunderSan}??</strong>
              </p>
              <p class="punishment">Punishment: {puzzle.solutionSan.join(' ')}</p>
            </div>
            <button class="primary-btn" onclick={loadRandomPuzzle}>
              Next Puzzle
            </button>
          </div>
        {:else}
          <div class="action-box">
            <p class="instruction">
              {#if isAnimating}
                Playing the sequence...
              {:else}
                Starting...
              {/if}
            </p>
          </div>
        {/if}
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

  .page-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  h1 {
    margin-bottom: 0.25rem;
    color: #fff;
    font-weight: 500;
  }

  h3 {
    margin: 0 0 0.375rem 0;
    color: #787672;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 500;
  }

  .task-info {
    color: #787672;
    margin: 0;
    font-size: 0.9rem;
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

  .stats-box {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.375rem;
  }

  .stat-row {
    display: flex;
    flex-direction: column;
    text-align: center;
    padding: 0.25rem;
  }

  .stat-label {
    color: #787672;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    color: #bababa;
    font-size: 1rem;
    font-weight: 500;
  }

  .puzzle-info {
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

  .board-section {
    width: 100%;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .move-explorer {
    display: flex;
    flex-direction: column;
  }

  .move-explorer :global(.move-history) {
    max-height: 200px;
  }

  .action-box, .guess-box, .result-box {
    background: #262421;
    padding: 1rem;
    border-radius: 2px;
  }

  .instruction {
    color: #787672;
    margin: 0;
    text-align: center;
  }

  .primary-btn {
    width: 100%;
    padding: 0.75rem;
    background: #629924;
    color: #fff;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: 0.9rem;
    font-family: inherit;
    font-weight: 500;
    transition: background 0.1s;
  }

  .primary-btn:hover {
    background: #72a92e;
  }

  .blunder-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
  }

  .color-indicator {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .color-indicator.white {
    background: #fff;
    border: 1px solid #3d3a37;
  }

  .color-indicator.black {
    background: #000;
  }

  .slider-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .elo-slider {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    background: #3d3a37;
    border-radius: 3px;
    outline: none;
  }

  .elo-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: #629924;
    border-radius: 50%;
    cursor: pointer;
  }

  .elo-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #629924;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  .elo-display {
    font-size: 1.5rem;
    font-weight: 500;
    color: #fff;
    min-width: 4rem;
    text-align: right;
  }

  .elo-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: #787672;
    margin-bottom: 1rem;
    padding: 0 0.25rem;
  }

  .submit-btn {
    margin-top: 0.5rem;
  }

  .result-box {
    text-align: center;
  }

  .result-comparison {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-bottom: 1rem;
  }

  .result-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .result-label {
    font-size: 0.75rem;
    color: #787672;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .result-value {
    font-size: 1.75rem;
    font-weight: 500;
    color: #bababa;
  }

  .result-item.actual .result-value {
    color: #fff;
  }

  .difference-display {
    font-size: 1.25rem;
    font-weight: 500;
    margin-bottom: 1rem;
  }

  .blunder-recap {
    background: #1e1d1b;
    padding: 0.75rem;
    border-radius: 2px;
    margin-bottom: 1rem;
    text-align: left;
  }

  .blunder-recap p {
    margin: 0;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .blunder-recap .punishment {
    margin-top: 0.5rem;
    color: #787672;
    display: block;
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
</style>
