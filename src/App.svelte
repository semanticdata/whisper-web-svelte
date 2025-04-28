<script lang="ts">
  import AudioManager from './lib/AudioManager.svelte';
  import { createTranscriber } from './lib/transcriber';
  const transcriber = createTranscriber();
</script>

<main>
  <div class="container">
    <h1 class="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl text-center">
      Whisper Web
    </h1>
    <h2 class="mt-3 mb-5 px-4 text-center text-1xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
      ML-powered speech recognition directly in your browser
    </h2>
    <AudioManager {transcriber} />
    <div class="absolute bottom-4">
      Made with <a class="underline" href="https://github.com/xenova/transformers.js">🤗 Transformers.js</a>
    </div>
  </div>
</main>

<style>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
.absolute.bottom-4 {
  position: absolute;
  bottom: 1rem;
}
</style>
