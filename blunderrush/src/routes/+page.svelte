<script lang="ts">
  import ChessBoard from '$lib/components/ChessBoard.svelte';
  import MoveHistory from '$lib/components/MoveHistory.svelte';

  interface MoveEntry {
    san: string;
    fen: string;
    color: 'white' | 'black';
    from: string;
    to: string;
  }

  const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  let moveHistory: MoveEntry[] = $state([]);
  let currentMoveIndex = $state(-1);  // -1 = starting position
  let startingFen = $state(STARTING_FEN);
  let orientation: 'white' | 'black' = $state('white');

  let chessBoardRef: ChessBoard;

  // Computed current FEN based on move index
  let currentFen = $derived(
    currentMoveIndex === -1 ? startingFen : moveHistory[currentMoveIndex].fen
  );

  // Whether we're at the latest position (can make moves)
  let isAtLatest = $derived(currentMoveIndex === moveHistory.length - 1 || (moveHistory.length === 0 && currentMoveIndex === -1));

  function handleMove(move: { from: string; to: string; promotion?: string; uci: string; san: string; fen: string; color: 'white' | 'black' }) {
    // Only allow moves if we're at the latest position
    if (!isAtLatest) {
      // Truncate history and allow new branch
      moveHistory = moveHistory.slice(0, currentMoveIndex + 1);
    }

    moveHistory = [...moveHistory, {
      san: move.san,
      fen: move.fen,
      color: move.color,
      from: move.from,
      to: move.to,
    }];
    currentMoveIndex = moveHistory.length - 1;
  }

  function handleNavigate(index: number) {
    if (index < -1 || index >= moveHistory.length) return;
    currentMoveIndex = index;

    // Update the board position
    if (index === -1) {
      chessBoardRef?.setPosition(startingFen);
    } else {
      const move = moveHistory[index];
      chessBoardRef?.setPosition(move.fen, { from: move.from, to: move.to });
    }
  }

  function flipBoard() {
    orientation = orientation === 'white' ? 'black' : 'white';
  }

  function resetBoard() {
    startingFen = STARTING_FEN;
    moveHistory = [];
    currentMoveIndex = -1;
    chessBoardRef?.setPosition(STARTING_FEN);
  }

  function loadTestPosition() {
    // A famous position - Italian Game
    startingFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    moveHistory = [];
    currentMoveIndex = -1;
    chessBoardRef?.setPosition(startingFen);
  }

  function loadPuzzlePosition() {
    // A position where Black just blundered with ...f6?? allowing Qh5#
    // This is similar to what we'd show in a reverse puzzle
    startingFen = 'rnbqkbnr/ppppp1pp/5p2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    moveHistory = [];
    currentMoveIndex = -1;
    chessBoardRef?.setPosition(startingFen);
  }
</script>

<main>
  <h1>BlunderRush</h1>
  <p class="subtitle">Find the blunder that was actually played</p>

  <div class="demo-container">
    <div class="board-wrapper">
      <ChessBoard
        bind:this={chessBoardRef}
        fen={currentFen}
        {orientation}
        interactive={isAtLatest}
        onMove={handleMove}
      />
    </div>

    <div class="controls">
      <h3>Controls</h3>
      <div class="button-group">
        <button onclick={flipBoard}>Flip Board</button>
        <button onclick={resetBoard}>Reset</button>
        <button onclick={loadTestPosition}>Italian Game</button>
        <button onclick={loadPuzzlePosition}>Puzzle Position</button>
      </div>

      <h3>Move History</h3>
      <p class="hint">Use arrow keys to navigate</p>
      <MoveHistory
        moves={moveHistory}
        {currentMoveIndex}
        onNavigate={handleNavigate}
      />

      <h3>Current FEN</h3>
      <code class="fen">{currentFen}</code>
    </div>
  </div>
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
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    color: #fff;
  }

  .subtitle {
    text-align: center;
    color: #888;
    margin-bottom: 2rem;
  }

  .demo-container {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .board-wrapper {
    width: 100%;
    max-width: 480px;
  }

  .controls {
    flex: 1;
    min-width: 280px;
    max-width: 400px;
  }

  h3 {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    color: #aaa;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .button-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  button {
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 6px;
    background: #3a3a5a;
    color: #fff;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  button:hover {
    background: #4a4a7a;
  }

  .hint {
    font-size: 0.75rem;
    color: #666;
    margin: 0 0 0.5rem 0;
  }

  .fen {
    display: block;
    padding: 1rem;
    background: #2a2a4a;
    border-radius: 8px;
    font-size: 0.8rem;
    word-break: break-all;
    color: #8f8;
  }

  @media (max-width: 768px) {
    .demo-container {
      flex-direction: column;
      align-items: center;
    }

    .controls {
      width: 100%;
      max-width: 480px;
    }
  }
</style>
