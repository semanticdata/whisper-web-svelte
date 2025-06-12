<script lang="ts">
  import AudioManager from "./lib/AudioManager.svelte";
  import SettingsModal from "./lib/SettingsModal.svelte";
  import {
    createTranscriber,
    type SupportedModel,
    type TranscriberModel,
  } from "./lib/transcriber";
  import { get } from "svelte/store";

  const transcriber = createTranscriber();
  const supportedModels = transcriber.supportedModels;
  const workerStatus = transcriber.workerStatus;

  let selectedModel: SupportedModel = "Xenova/whisper-base";
  let quantized: boolean = true; // Default to quantized
  let multilingual: boolean = false; // Default to not multilingual
  let isSettingsModalOpen = false;

  // Load initial model
  transcriber.loadModel(selectedModel, quantized, multilingual);

  function handleSettingsChange(event: CustomEvent) {
    selectedModel = event.detail.model;
    quantized = event.detail.quantized;
    multilingual = event.detail.multilingual;
    transcriber.loadModel(selectedModel, quantized, multilingual);
    isSettingsModalOpen = false;
  }

  function openSettingsModal() {
    isSettingsModalOpen = true;
  }
</script>

<main class="app-root">
  <header class="header">
    <h1 class="main-title">Whisper Web</h1>
    <span class="main-subtitle">
      ML-powered speech recognition directly in your browser
    </span>
  </header>
  <div class="model-status-bar">
    <button
      on:click={openSettingsModal}
      class="settings-button"
      aria-label="Open settings"
    >
      ⚙️ Settings
    </button>
    <span class="status-text">
      {$workerStatus.status === "loading"
        ? `Loading model... ${$workerStatus.message || ""}`
        : $workerStatus.status === "ready"
          ? `Ready: ${$workerStatus.model}`
          : $workerStatus.status === "transcribing"
            ? "Transcribing audio..."
            : $workerStatus.status === "error"
              ? `Error: ${$workerStatus.message}`
              : $workerStatus.status === "complete"
                ? "Transcription complete"
                : "Initializing..."}</span
    >
  </div>
  <section class="main-content">
    <AudioManager {transcriber} model={selectedModel} />
  </section>

  <SettingsModal
    bind:isOpen={isSettingsModalOpen}
    {supportedModels}
    currentModel={selectedModel}
    currentQuantized={quantized}
    currentMultilingual={multilingual}
    on:settingsChanged={handleSettingsChange}
    on:close={() => (isSettingsModalOpen = false)}
  />
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
    /* background: palegoldenrod; */
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
  .model-status-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border-bottom: 1px solid #e2e8f0;
  }
  .settings-button {
    background: none;
    border: 1px solid #d1d5db; /* Tailwind gray-300 */
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    color: #374151; /* Tailwind gray-700 */
  }
  .settings-button:hover {
    background-color: #e5e7eb; /* Tailwind gray-200 */
  }
  .status-text {
    font-weight: 500;
    color: #374151;
    margin-inline-start: auto;
  }
  .main-content {
    flex: 1;
    width: 100%;
    max-width: 100vw;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-block-start: 1rem;
    /* background: palevioletred; */
  }
  .footer {
    width: 100%;
    padding: 1rem 0;
    text-align: center;
    color: #6b7280;
    /* background: palegoldenrod; */
  }
</style>
