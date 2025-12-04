<script lang="ts">
  import { onMount } from 'svelte';
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
    onNavigate = undefined as ((index: number) => void) | undefined,
  } = $props();

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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentMoveIndex > -1 && onNavigate) {
        onNavigate(currentMoveIndex - 1);
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentMoveIndex < moves.length - 1 && onNavigate) {
        onNavigate(currentMoveIndex + 1);
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
    if (onNavigate) {
      onNavigate(index);
    }
  }
</script>

<div class="move-history" tabindex="0">
  {#if moves.length === 0}
    <p class="placeholder">Make a move to see history...</p>
  {:else}
    {#each groupedMoves as group}
      <div class="move-row">
        <span class="move-number">{group.moveNumber}.</span>
        {#if group.white}
          <button
            class="move white"
            class:active={currentMoveIndex === group.whiteIndex}
            onclick={() => handleMoveClick(group.whiteIndex)}
          >
            {group.white.san}
          </button>
        {:else}
          <span class="move empty">...</span>
        {/if}
        {#if group.black}
          <button
            class="move black"
            class:active={currentMoveIndex === group.blackIndex}
            onclick={() => handleMoveClick(group.blackIndex)}
          >
            {group.black.san}
          </button>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .move-history {
    padding: 0.75rem;
    background: #302e2c;
    border-radius: 4px;
    min-height: 60px;
    max-height: 300px;
    overflow-y: auto;
    outline: none;
  }

  .move-history:focus {
    box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.5);
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
    align-items: center;
    margin-bottom: 2px;
  }

  .move-number {
    color: #999;
    font-size: 0.85rem;
    width: 28px;
    flex-shrink: 0;
    text-align: right;
    padding-right: 6px;
  }

  .move {
    font-family: inherit;
    font-size: 0.9rem;
    padding: 3px 8px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    min-width: 50px;
    text-align: center;
    transition: background-color 0.1s;
  }

  .move.white {
    background: #dad5d0;
    color: #1a1a1a;
    margin-right: 4px;
  }

  .move.white:hover {
    background: #eae5e0;
  }

  .move.white.active {
    background: #b0b0b0;
    color: #000;
  }

  .move.black {
    background: #4a4a4a;
    color: #e0e0e0;
  }

  .move.black:hover {
    background: #5a5a5a;
  }

  .move.black.active {
    background: #666666;
    color: #fff;
  }

  .move.empty {
    background: transparent;
    color: #666;
    cursor: default;
    min-width: 50px;
    margin-right: 4px;
  }
</style>
