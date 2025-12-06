<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getRandomBlunderPuzzle } from '$lib/lichess';

  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const puzzle = await getRandomBlunderPuzzle();
      goto(`/elo/${puzzle.id}`, { replaceState: true });
    } catch (e) {
      console.error('Failed to load puzzle:', e);
      error = e instanceof Error ? e.message : 'Failed to load puzzle';
    }
  });
</script>

<main>
  <h1>Guess the Elo</h1>
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
    text-align: center;
  }

  h1 {
    margin-bottom: 2rem;
    color: #fff;
    font-weight: 500;
  }

  .loading {
    padding: 2rem;
    color: #787672;
  }

  .error {
    color: #e06c6c;
    padding: 2rem;
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
    margin-top: 1rem;
    transition: background 0.1s, border-color 0.1s;
  }

  button:hover {
    background: #3d3a37;
    border-color: #4d4a47;
  }
</style>
