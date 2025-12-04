# BlunderRush

A unique chess puzzle platform where you find the **historical blunder** that was actually played in a real game, rather than finding the best move.

## Tech Stack

- **SvelteKit** - Minimal, fast web framework
- **TypeScript** - Type-safe development
- **Chessground** - Lichess's battle-tested chess board UI
- **chess.js** - Chess move validation and game logic
- **Stockfish.wasm** - Browser-based position evaluation

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check
```

## Project Structure

```
src/
├── lib/
│   ├── components/     # Svelte components (ChessBoard, EvalBar, etc.)
│   ├── stores/         # State management (puzzleStore, etc.)
│   ├── workers/        # Web Workers (Stockfish)
│   ├── db/            # Puzzle database (JSON)
│   ├── types.ts       # TypeScript type definitions
│   └── chess.ts       # chess.js wrapper
├── routes/            # SvelteKit pages
│   ├── +page.svelte   # Puzzle list
│   └── puzzle/[id]/   # Puzzle solver
scripts/               # Puzzle processing scripts
```

## License

GPL v3 (required by Chessground and Stockfish dependencies)

## Credits

- Puzzles: [Lichess.org](https://lichess.org) (CC0 Public Domain)
- Chess Board: [Chessground](https://github.com/lichess-org/chessground)
- Chess Logic: [chess.js](https://github.com/jhlywa/chess.js)
- Engine: [Stockfish](https://stockfishchess.org/)
