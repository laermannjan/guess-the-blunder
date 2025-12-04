<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chessground } from 'chessground';
  import { Chess } from 'chess.js';
  import { getLegalMoves, toChessgroundDests, getTurnFromFen, moveToUci } from '$lib/chess';
  import type { Api } from 'chessground/api';
  import type { Config } from 'chessground/config';
  import type { Key } from 'chessground/types';

  // Props
  let {
    fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    orientation = 'white' as 'white' | 'black',
    interactive = true,
    onMove = undefined as ((move: { from: string; to: string; promotion?: string; uci: string; san: string; fen: string; color: 'white' | 'black' }) => void) | undefined,
    lastMove = undefined as { from: string; to: string } | undefined,
    lastMoveColor = 'green' as 'green' | 'red', // green for normal, red for opponent's last move
  } = $props();

  // Internal state
  let boardEl: HTMLDivElement;
  let ground: Api | null = null;
  let chess: Chess;

  // Initialize chess.js instance
  $effect(() => {
    chess = new Chess(fen);
  });

  // Update board when FEN changes
  $effect(() => {
    if (ground && fen) {
      chess = new Chess(fen);
      const legalMoves = getLegalMoves(chess);
      const turn = getTurnFromFen(fen);

      ground.set({
        fen: fen,
        turnColor: turn,
        movable: {
          color: interactive ? turn : undefined,
          dests: interactive ? toChessgroundDests(legalMoves) : undefined,
          free: false,
        },
        check: chess.isCheck(),
      });
    }
  });

  // Update orientation when it changes
  $effect(() => {
    if (ground) {
      ground.set({ orientation });
    }
  });

  onMount(() => {
    chess = new Chess(fen);
    const legalMoves = getLegalMoves(chess);
    const turn = getTurnFromFen(fen);

    const config: Config = {
      fen: fen,
      orientation: orientation,
      turnColor: turn,
      lastMove: lastMove ? [lastMove.from as Key, lastMove.to as Key] : undefined,
      animation: {
        enabled: true,
        duration: 200,
      },
      movable: {
        color: interactive ? turn : undefined,
        free: false,
        dests: interactive ? toChessgroundDests(legalMoves) : undefined,
        showDests: true,
      },
      draggable: {
        enabled: interactive,
        showGhost: true,
      },
      selectable: {
        enabled: interactive,
      },
      highlight: {
        lastMove: true,
        check: true,
      },
      premovable: {
        enabled: false,
      },
      events: {
        move: (orig: Key, dest: Key) => {
          handleMove(orig as string, dest as string);
        },
      },
    };

    ground = Chessground(boardEl, config);
  });

  onDestroy(() => {
    if (ground) {
      ground.destroy();
    }
  });

  function handleMove(from: string, to: string) {
    // Check if this is a promotion
    const piece = chess.get(from as any);
    const isPromotion = piece?.type === 'p' &&
      ((piece.color === 'w' && to[1] === '8') ||
       (piece.color === 'b' && to[1] === '1'));

    let promotion: string | undefined;
    if (isPromotion) {
      // Default to queen promotion for now
      // TODO: Add promotion picker UI
      promotion = 'q';
    }

    // Try to make the move
    try {
      const move = chess.move({ from: from as any, to: to as any, promotion });

      if (move && onMove) {
        onMove({
          from: move.from,
          to: move.to,
          promotion: move.promotion,
          uci: moveToUci(move),
          san: move.san,
          fen: chess.fen(),
          color: move.color === 'w' ? 'white' : 'black',
        });
      }

      // Update the board with new position
      if (ground) {
        const newLegalMoves = getLegalMoves(chess);
        const newTurn = getTurnFromFen(chess.fen());

        ground.set({
          fen: chess.fen(),
          turnColor: newTurn,
          movable: {
            color: interactive ? newTurn : undefined,
            dests: interactive ? toChessgroundDests(newLegalMoves) : undefined,
          },
          check: chess.isCheck(),
        });
      }
    } catch (e) {
      // Invalid move, reset the board
      if (ground) {
        ground.set({ fen: chess.fen() });
      }
    }
  }

  // Expose method to set position externally
  export function setPosition(newFen: string, lastMove?: { from: string; to: string }) {
    chess = new Chess(newFen);
    if (ground) {
      const legalMoves = getLegalMoves(chess);
      const turn = getTurnFromFen(newFen);

      ground.set({
        fen: newFen,
        turnColor: turn,
        lastMove: lastMove ? [lastMove.from as Key, lastMove.to as Key] : undefined,
        movable: {
          color: interactive ? turn : undefined,
          dests: interactive ? toChessgroundDests(legalMoves) : undefined,
        },
        check: chess.isCheck(),
      });
    }
  }

  // Expose method to get current FEN
  export function getFen(): string {
    return chess.fen();
  }
</script>

<div class="board-container" class:red-last-move={lastMoveColor === 'red'}>
  <div class="board" bind:this={boardEl}></div>
</div>

<style>
  .board-container {
    width: 100%;
    max-width: 560px;
    aspect-ratio: 1;
  }

  .board {
    width: 100%;
    height: 100%;
  }

  /* Import Chessground base styles */
  :global(.cg-wrap) {
    width: 100%;
    height: 100%;
    position: relative;
    display: block;
  }

  :global(cg-container) {
    position: absolute;
    width: 100%;
    height: 100%;
    display: block;
    top: 0;
  }

  :global(cg-board) {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    line-height: 0;
    background-size: cover;
    cursor: pointer;
  }

  /* Default board colors (brown theme) */
  :global(cg-board) {
    background-color: #b58863;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='50' height='50' fill='%23f0d9b5'/%3E%3Crect x='50' width='50' height='50' fill='%23b58863'/%3E%3Crect y='50' width='50' height='50' fill='%23b58863'/%3E%3Crect x='50' y='50' width='50' height='50' fill='%23f0d9b5'/%3E%3C/svg%3E");
    background-size: 25% 25%;
  }

  :global(cg-board piece) {
    position: absolute;
    top: 0;
    left: 0;
    width: 12.5%;
    height: 12.5%;
    background-size: cover;
    z-index: 2;
    will-change: transform;
    pointer-events: none;
  }

  :global(cg-board piece.dragging) {
    cursor: grabbing;
    z-index: 11;
  }

  :global(cg-board piece.anim) {
    z-index: 8;
  }

  :global(cg-board piece.ghost) {
    opacity: 0.3;
  }

  :global(cg-board square) {
    position: absolute;
    top: 0;
    left: 0;
    width: 12.5%;
    height: 12.5%;
    pointer-events: none;
  }

  :global(cg-board square.move-dest) {
    background: radial-gradient(rgba(20, 85, 30, 0.5) 22%, transparent 0);
    pointer-events: auto;
  }

  :global(cg-board square.move-dest.oc) {
    background: radial-gradient(transparent 0%, transparent 80%, rgba(20, 85, 30, 0.3) 80%);
  }

  :global(cg-board square.last-move) {
    background-color: rgba(155, 199, 0, 0.41);
  }

  /* Red last-move highlight for opponent's previous move */
  .red-last-move :global(cg-board square.last-move) {
    background-color: rgba(255, 100, 100, 0.5);
  }

  :global(cg-board square.selected) {
    background-color: rgba(20, 85, 30, 0.5);
  }

  :global(cg-board square.check) {
    background: radial-gradient(ellipse at center, rgba(255, 0, 0, 1) 0%, rgba(231, 0, 0, 1) 25%, rgba(169, 0, 0, 0) 89%, rgba(158, 0, 0, 0) 100%);
  }

  /* Piece images using Lichess CBurnett set via data URIs */
  :global(cg-board piece.white.pawn) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cpath d='M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z' fill='%23fff' stroke='%23000' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  }

  :global(cg-board piece.white.knight) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cg fill='none' fill-rule='evenodd' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21' fill='%23fff'/%3E%3Cpath d='M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3' fill='%23fff'/%3E%3Cpath d='M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z' fill='%23000'/%3E%3C/g%3E%3C/svg%3E");
  }

  :global(cg-board piece.white.bishop) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cg fill='none' fill-rule='evenodd' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cg fill='%23fff' stroke-linecap='butt'%3E%3Cpath d='M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z'/%3E%3Cpath d='M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z'/%3E%3Cpath d='M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z'/%3E%3C/g%3E%3Cpath d='M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5' stroke-linejoin='miter'/%3E%3C/g%3E%3C/svg%3E");
  }

  :global(cg-board piece.white.rook) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cg fill='%23fff' fill-rule='evenodd' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5' stroke-linecap='butt'/%3E%3Cpath d='M34 14l-3 3H14l-3-3'/%3E%3Cpath d='M31 17v12.5H14V17' stroke-linecap='butt' stroke-linejoin='miter'/%3E%3Cpath d='M31 29.5l1.5 2.5h-20l1.5-2.5'/%3E%3Cpath d='M11 14h23' fill='none' stroke-linejoin='miter'/%3E%3C/g%3E%3C/svg%3E");
  }

  :global(cg-board piece.white.queen) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cg fill='%23fff' fill-rule='evenodd' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z'/%3E%3Cpath d='M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z' stroke-linecap='butt'/%3E%3Cpath d='M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z' stroke-linecap='butt'/%3E%3Cpath d='M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0' fill='none'/%3E%3C/g%3E%3C/svg%3E");
  }

  :global(cg-board piece.white.king) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cg fill='none' fill-rule='evenodd' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22.5 11.63V6M20 8h5' stroke-linejoin='miter'/%3E%3Cpath d='M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5' fill='%23fff' stroke-linecap='butt' stroke-linejoin='miter'/%3E%3Cpath d='M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z' fill='%23fff'/%3E%3Cpath d='M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0'/%3E%3C/g%3E%3C/svg%3E");
  }

  :global(cg-board piece.black.pawn) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cpath d='M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z' stroke='%23000' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  }

  :global(cg-board piece.black.knight) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cg fill='none' fill-rule='evenodd' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21' fill='%23000'/%3E%3Cpath d='M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3' fill='%23000'/%3E%3Cpath d='M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z' fill='%23fff' stroke='%23fff'/%3E%3C/g%3E%3C/svg%3E");
  }

  :global(cg-board piece.black.bishop) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cg fill='none' fill-rule='evenodd' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cg fill='%23000' stroke-linecap='butt'%3E%3Cpath d='M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z'/%3E%3Cpath d='M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z'/%3E%3Cpath d='M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z'/%3E%3C/g%3E%3Cpath d='M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5' stroke='%23fff' stroke-linejoin='miter'/%3E%3C/g%3E%3C/svg%3E");
  }

  :global(cg-board piece.black.rook) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cg fill-rule='evenodd' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 39h27v-3H9v3zm3.5-7l1.5-2.5h17l1.5 2.5h-20zm-.5 4v-4h21v4H12z' stroke-linecap='butt'/%3E%3Cpath d='M14 29.5v-13h17v13H14z' stroke-linecap='butt' stroke-linejoin='miter'/%3E%3Cpath d='M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z' stroke-linecap='butt'/%3E%3Cpath d='M12 35.5h21m-20-4h19m-18-2h17m-17-13h17M11 14h23' fill='none' stroke='%23fff' stroke-width='1' stroke-linejoin='miter'/%3E%3C/g%3E%3C/svg%3E");
  }

  :global(cg-board piece.black.queen) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cg fill-rule='evenodd' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cg stroke='none'%3E%3Ccircle cx='6' cy='12' r='2.75'/%3E%3Ccircle cx='14' cy='9' r='2.75'/%3E%3Ccircle cx='22.5' cy='8' r='2.75'/%3E%3Ccircle cx='31' cy='9' r='2.75'/%3E%3Ccircle cx='39' cy='12' r='2.75'/%3E%3C/g%3E%3Cpath d='M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z' stroke-linecap='butt'/%3E%3Cpath d='M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z' stroke-linecap='butt'/%3E%3Cpath d='M11 38.5a35 35 1 0 0 23 0' fill='none' stroke-linecap='butt'/%3E%3Cpath d='M11 29a35 35 1 0 1 23 0m-21.5 2.5h20m-21 3a35 35 1 0 0 22 0m-23 3a35 35 1 0 0 24 0' fill='none' stroke='%23fff'/%3E%3C/g%3E%3C/svg%3E");
  }

  :global(cg-board piece.black.king) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='45' height='45'%3E%3Cg fill='none' fill-rule='evenodd' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22.5 11.63V6' stroke-linejoin='miter'/%3E%3Cpath d='M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5' fill='%23000' stroke-linecap='butt' stroke-linejoin='miter'/%3E%3Cpath d='M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z' fill='%23000'/%3E%3Cpath d='M20 8h5' stroke-linejoin='miter'/%3E%3Cpath d='M32 29.5s8.5-4 6.03-9.65C34.15 14 25 18 22.5 24.5l.01 2.1-.01-2.1C20 18 9.906 14 6.997 19.85c-2.497 5.65 4.853 9 4.853 9' stroke='%23fff'/%3E%3Cpath d='M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0' stroke='%23fff'/%3E%3C/g%3E%3C/svg%3E");
  }
</style>
