<script lang="ts">
  import { page } from '$app/stores';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();

  const navItems = [
    { href: '/blunder', label: 'Guess the Blunder' },
    { href: '/elo', label: 'Guess the Elo' },
  ];

  const isActive = (href: string) => {
    const path = $page.url.pathname;
    return path === href || path.startsWith(href + '/');
  };
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="app-layout">
  <nav class="sidebar">
    <a href="/" class="logo">
      <span class="logo-icon">??</span>
      <span class="logo-text">BlunderRush</span>
    </a>

    <div class="nav-items">
      {#each navItems as item}
        <a
          href={item.href}
          class="nav-item"
          class:active={isActive(item.href)}
        >
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </div>
  </nav>

  <main class="main-content">
    {@render children()}
  </main>
</div>

<style>
  :global(body) {
    font-family: 'Berkeley Mono', 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
    margin: 0;
    padding: 0;
    background: #161512;
    color: #bababa;
    min-height: 100vh;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app-layout {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: 200px;
    background: #1a1816;
    border-right: 1px solid #2b2926;
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
    flex-shrink: 0;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 1rem;
    margin-bottom: 1.5rem;
    text-decoration: none;
    color: inherit;
  }

  .logo-icon {
    background: #b33430;
    color: #fff;
    font-weight: 700;
    font-size: 0.85rem;
    padding: 0.25rem 0.375rem;
    border-radius: 3px;
    line-height: 1;
  }

  .logo-text {
    font-size: 1rem;
    font-weight: 500;
    color: #fff;
  }

  .logo:hover .logo-text {
    color: #bababa;
  }

  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .nav-item {
    display: flex;
    align-items: center;
    padding: 0.625rem 1rem;
    text-decoration: none;
    color: #8b8987;
    font-size: 0.85rem;
    transition: background 0.1s, color 0.1s;
    border-left: 3px solid transparent;
  }

  .nav-item:hover {
    background: #262421;
    color: #bababa;
  }

  .nav-item.active {
    background: #262421;
    color: #fff;
    border-left-color: #b33430;
  }

  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .main-content {
    flex: 1;
    padding: 1.5rem;
    overflow-x: hidden;
  }

  @media (max-width: 768px) {
    .app-layout {
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid #2b2926;
      padding: 0.75rem 0;
    }

    .logo {
      margin-bottom: 0.75rem;
    }

    .nav-items {
      flex-direction: row;
      overflow-x: auto;
      padding: 0 0.5rem;
      gap: 0.25rem;
    }

    .nav-item {
      border-left: none;
      border-bottom: 2px solid transparent;
      padding: 0.5rem 0.75rem;
      border-radius: 2px;
    }

    .nav-item.active {
      border-left-color: transparent;
      border-bottom-color: #b33430;
    }

    .main-content {
      padding: 1rem;
    }
  }
</style>
