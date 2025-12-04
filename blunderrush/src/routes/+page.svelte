<script lang="ts">
</script>

<main>
  <h1>BlunderRush</h1>
  <p class="subtitle">Chess puzzles with a twist</p>

  <div class="modes">
    <a href="/blunder" class="mode-card">
      <h2>Guess the Blunder</h2>
      <p>Find the blunder that was actually played in a real game</p>
    </a>

    <div class="mode-card disabled">
      <h2>Guess the Elo</h2>
      <p>See the blunder and guess the players' rating</p>
      <span class="coming-soon">Coming soon</span>
    </div>

    <div class="mode-card disabled">
      <h2>Elo Battle</h2>
      <p>Compete with friends to guess the elo fastest</p>
      <span class="coming-soon">Coming soon</span>
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
    max-width: 800px;
    margin: 0 auto;
    text-align: center;
    padding-top: 2rem;
  }

  h1 {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #888;
    font-size: 1.2rem;
    margin-bottom: 3rem;
  }

  .modes {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 400px;
    margin: 0 auto;
  }

  .mode-card {
    background: #2a2a4a;
    padding: 1.5rem;
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    text-align: left;
    transition: transform 0.15s, background 0.15s;
    position: relative;
  }

  .mode-card:not(.disabled):hover {
    background: #3a3a5a;
    transform: translateY(-2px);
  }

  .mode-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .mode-card h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.3rem;
  }

  .mode-card p {
    margin: 0;
    color: #aaa;
    font-size: 0.95rem;
  }

  .coming-soon {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: #4a4a6a;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
