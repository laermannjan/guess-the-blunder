<script lang="ts">
</script>

<div class="home">
  <div class="hero">
    <h1>Welcome to BlunderRush</h1>
    <p class="subtitle">Chess puzzles with a twist</p>
  </div>

  <div class="modes">
    <a href="/blunder" class="mode-card">
      <h2>Guess the Blunder</h2>
      <p>Find the blunder that was actually played in a real game. Can you think like a human?</p>
    </a>

    <a href="/elo" class="mode-card">
      <h2>Guess the Elo</h2>
      <p>Watch the blunder unfold, then guess the rating of the player who made it.</p>
    </a>

    <div class="mode-card disabled">
      <h2>Elo Battle</h2>
      <p>Compete with friends to guess the elo fastest</p>
      <span class="coming-soon">Coming soon</span>
    </div>
  </div>
</div>

<style>
  .home {
    max-width: 600px;
    margin: 0 auto;
    padding-top: 2rem;
  }

  .hero {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  h1 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
    color: #fff;
    font-weight: 500;
  }

  .subtitle {
    color: #787672;
    font-size: 0.95rem;
    margin: 0;
  }

  .modes {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .mode-card {
    background: #262421;
    padding: 1.25rem;
    border-radius: 3px;
    text-decoration: none;
    color: inherit;
    transition: background 0.1s, border-color 0.1s;
    position: relative;
    border: 1px solid #3d3a37;
  }

  .mode-card:not(.disabled):hover {
    background: #2b2926;
    border-color: #4d4a47;
  }

  .mode-card.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .mode-card h2 {
    margin: 0 0 0.375rem 0;
    font-size: 1rem;
    font-weight: 500;
    color: #fff;
  }

  .mode-card p {
    margin: 0;
    color: #787672;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .coming-soon {
    position: absolute;
    top: 0.875rem;
    right: 0.875rem;
    background: #2b2926;
    border: 1px solid #3d3a37;
    padding: 0.15rem 0.4rem;
    border-radius: 2px;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #787672;
  }
</style>
