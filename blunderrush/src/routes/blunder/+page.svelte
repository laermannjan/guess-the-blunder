<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getRandomBlunderPuzzle } from '$lib/lichess';

  let error = $state<string | null>(null);

  onMount(async () => {
    console.log('onMount fired, fetching puzzle...');
    try {
      const puzzle = await getRandomBlunderPuzzle();
      console.log('Got puzzle:', puzzle.id);
      goto(`/blunder/${puzzle.id}`, { replaceState: true });
    } catch (e) {
      console.error('Failed to load puzzle:', e);
      error = e instanceof Error ? e.message : 'Failed to load puzzle';
    }
  });
</script>

<main>
  <h1>Guess the Blunder</h1>
  {#if error}
    <div class="error">
      <p>Error: {error}</p>
      <button onclick={() => location.reload()}>Try Again</button>
    </div>
  {:else}
    <div class="loading">Loading random puzzle...</div>
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
    text-align: center;
  }

  h1 {
    margin-bottom: 2rem;
  }

  .loading {
    padding: 2rem;
    color: #888;
  }

  .error {
    color: #ff6b6b;
    padding: 2rem;
  }

  button {
    padding: 0.6rem 1.2rem;
    border: none;
    border-radius: 6px;
    background: #3a3a5a;
    color: #fff;
    cursor: pointer;
    font-size: 0.9rem;
    margin-top: 1rem;
  }

  button:hover {
    background: #4a4a7a;
  }
</style>
