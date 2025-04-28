<script lang="ts">
  import AudioManager from "./lib/AudioManager.svelte";
  import { createTranscriber } from "./lib/transcriber";
  const transcriber = createTranscriber();
</script>

<main class="app-root">
  <header class="header">
    <h1 class="main-title">Whisper Web</h1>
    <h2 class="main-subtitle">
      ML-powered speech recognition directly in your browser
    </h2>
  </header>
  <section class="main-content">
    <AudioManager {transcriber} />
  </section>
  <footer class="footer">
    Made with <a
      class="underline"
      href="https://github.com/xenova/transformers.js">🤗 Transformers.js</a
    >
  </footer>
</main>

<style>
  .app-root {
    min-height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    background: #f6f8fa;
  }
  .header {
    padding: 2rem 1rem 1rem 1rem;
    text-align: center;
  }
  .main-title {
    font-size: 2.5rem;
    font-weight: 800;
    color: #1a202c;
    margin-bottom: 0.5rem;
  }
  .main-subtitle {
    font-size: 1.1rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 1.5rem;
  }
  .main-content {
    flex: 1;
    width: 100%;
    max-width: 100vw;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 1rem;
  }
  .footer {
    width: 100%;
    padding: 2rem 0 1rem 0;
    text-align: center;
    font-size: 0.95rem;
    color: #6b7280;
  }
</style>
