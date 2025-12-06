<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';

  interface MoveEntry {
    san: string;      // Short algebraic notation (e.g., "e4", "Nf3", "dxe4")
    fen: string;      // Position after this move
    color: 'white' | 'black';
  }

  // Props
  let {
    moves = [] as MoveEntry[],
    currentMoveIndex = -1,  // -1 means at starting position, 0 = first move, etc.
    puzzleStartIndex = -1,  // Index of the move where the puzzle starts (to highlight with red outline)
    blunderIndex = -1,      // Index of the blunder move (will show ?? after it)
    minNavigableIndex = -1, // Minimum index the user can navigate to (-1 = start position)
    maxNavigableIndex = -1, // Maximum index the user can navigate to (-1 = no limit)
    onNavigate = undefined as ((index: number) => void) | undefined,
  } = $props();

  let containerRef: HTMLDivElement;

  // Auto-scroll to bottom when moves change or on mount
  $effect(() => {
    if (moves.length > 0 && containerRef) {
      tick().then(() => {
        containerRef.scrollTop = containerRef.scrollHeight;
      });
    }
  });

  // Group moves into full moves (white + black)
  let groupedMoves = $derived.by(() => {
    const groups: { moveNumber: number; white?: MoveEntry; black?: MoveEntry; whiteIndex: number; blackIndex: number }[] = [];

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const moveNumber = Math.floor(i / 2) + 1;

      if (move.color === 'white') {
        groups.push({ moveNumber, white: move, whiteIndex: i, blackIndex: -1 });
      } else {
        // Black move - add to existing group or create new one
        if (groups.length > 0 && !groups[groups.length - 1].black) {
          groups[groups.length - 1].black = move;
          groups[groups.length - 1].blackIndex = i;
        } else {
          // Rare case: game starts with black to move
          groups.push({ moveNumber, black: move, whiteIndex: -1, blackIndex: i });
        }
      }
    }

    return groups;
  });

  function canNavigateTo(index: number): boolean {
    if (minNavigableIndex !== -1 && index < minNavigableIndex) return false;
    if (maxNavigableIndex !== -1 && index > maxNavigableIndex) return false;
    return true;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = currentMoveIndex - 1;
      if (newIndex >= -1 && canNavigateTo(newIndex) && onNavigate) {
        onNavigate(newIndex);
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = currentMoveIndex + 1;
      if (newIndex < moves.length && canNavigateTo(newIndex) && onNavigate) {
        onNavigate(newIndex);
      }
    }
  }

  onMount(() => {
    if (browser) {
      window.addEventListener('keydown', handleKeydown);
      return () => {
        window.removeEventListener('keydown', handleKeydown);
      };
    }
  });

  function handleMoveClick(index: number) {
    if (onNavigate && canNavigateTo(index)) {
      onNavigate(index);
    }
  }

  function getMoveDisplay(move: MoveEntry | undefined, index: number): string {
    if (!move) return '';
    if (index === blunderIndex) {
      return `${move.san}??`;
    }
    return move.san;
  }
</script>

<div class="move-history" role="grid" aria-label="Game moves" bind:this={containerRef}>
  {#if moves.length === 0}
    <p class="placeholder">No moves yet...</p>
  {:else}
    {#each groupedMoves as group}
      <div class="move-row">
        <span class="move-number">{group.moveNumber}</span>
        <button
          class="move white-move"
          class:active={currentMoveIndex === group.whiteIndex}
          class:puzzle-start={puzzleStartIndex === group.whiteIndex}
          class:blunder={blunderIndex === group.whiteIndex}
          class:out-of-range={!canNavigateTo(group.whiteIndex)}
          onclick={() => handleMoveClick(group.whiteIndex)}
          disabled={group.whiteIndex === -1}
        >
          {getMoveDisplay(group.white, group.whiteIndex)}
        </button>
        <button
          class="move black-move"
          class:active={currentMoveIndex === group.blackIndex}
          class:puzzle-start={puzzleStartIndex === group.blackIndex}
          class:blunder={blunderIndex === group.blackIndex}
          class:out-of-range={!canNavigateTo(group.blackIndex)}
          onclick={() => handleMoveClick(group.blackIndex)}
          disabled={group.blackIndex === -1}
        >
          {getMoveDisplay(group.black, group.blackIndex)}
        </button>
      </div>
    {/each}
  {/if}
</div>

<style>
  .move-history {
    background: #2b2926;
    border-radius: 4px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .placeholder {
    color: #666;
    font-style: italic;
    margin: 0;
    text-align: center;
    padding: 1rem;
  }

  .move-row {
    display: flex;
    align-items: stretch;
  }

  .move-row:nth-child(odd) {
    background: #2b2926;
  }

  .move-row:nth-child(even) {
    background: #262421;
  }

  .move-number {
    background: #1f1d1b;
    color: #5c5955;
    font-size: 0.75rem;
    width: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 0;
    font-family: 'Berkeley Mono', 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  }

  .move {
    font-family: 'Berkeley Mono', 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
    font-size: 0.85rem;
    padding: 5px 8px;
    border: none;
    cursor: pointer;
    flex: 1;
    text-align: left;
    transition: background-color 0.1s;
    color: #bababa;
    background: transparent;
  }

  .move:disabled {
    cursor: default;
  }

  .move:not(:disabled):hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .move.white-move {
    border-right: 1px solid #1a1917;
  }

  .move.active {
    background: #3692e7;
    color: #fff;
    font-weight: bold;
  }

  .move.active:hover {
    background: #3692e7;
  }

  .move.puzzle-start {
    outline: 2px solid rgba(220, 90, 90, 0.6);
    outline-offset: -2px;
  }

  .move.puzzle-start.active {
    outline-color: rgba(220, 90, 90, 0.8);
  }

  .move.blunder {
    color: #e06c6c;
    font-weight: 500;
  }

  .move.blunder.active {
    background: #a03030;
    color: #fff;
  }

  .move.out-of-range {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .move.out-of-range:hover {
    background: transparent;
  }
</style>
