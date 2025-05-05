<script lang="ts">
  import AudioManager from "./lib/AudioManager.svelte";
  import { createTranscriber } from "./lib/transcriber";
  const transcriber = createTranscriber();
</script>

<main class="app-root">
  <header class="header">
    <h1 class="main-title">Whisper Web</h1>
    <span class="main-subtitle">
      ML-powered speech recognition directly in your browser
    </span>
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
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    justify-content: space-between;
    align-items: center;
    padding-inline: 1rem;
    background: palegoldenrod;
  }
  .main-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a202c;
  }
  .main-subtitle {
    font-weight: 600;
    color: #374151;
  }
  .main-content {
    flex: 1;
    width: 100%;
    max-width: 100vw;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-block-start: 1rem;
    background: palevioletred;
  }
  .footer {
    width: 100%;
    padding: 1rem 0;
    text-align: center;
    color: #6b7280;
    background: palegoldenrod;
  }
</style>
