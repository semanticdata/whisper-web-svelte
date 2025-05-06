<script lang="ts">
  import { get } from "svelte/store";
  import type { Writable } from "svelte/store";
  import type { TranscriberData } from "../lib/transcriber";
  import { exportTXT, exportJSON } from "./exportUtils";
  /**
   * transcribedData: a Svelte writable store containing the transcript data
   */
  export let transcribedData: Writable<TranscriberData | undefined>;

  function handleExportTXT() {
    exportTXT(get(transcribedData));
  }

  function handleExportJSON() {
    exportJSON(get(transcribedData));
  }
</script>

<div class="transcript">
  <div class="transcript-text">
    {#if $transcribedData}
      {#if $transcribedData.isBusy}
        <div class="progress-container">
          <div class="progress-bar"></div>
        </div>
        <p><em>Transcribing...</em></p>
      {/if}
      {#if $transcribedData.text}
        <div class="transcript-span-container">
          <span role="textbox" class="transcript-span"
            >{$transcribedData.text}</span
          >
        </div>
      {/if}
    {:else}
      <p>No transcript yet.</p>
    {/if}
  </div>
  {#if $transcribedData && !$transcribedData.isBusy && $transcribedData.text}
    <div class="transcript-actions">
      <button on:click={handleExportTXT} class="file-upload-btn"
        >Export TXT</button
      >
      <button on:click={handleExportJSON} class="file-upload-btn ml-2"
        >Export JSON</button
      >
    </div>
  {/if}
</div>

<style>
  .transcript {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .transcript-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .file-upload-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.6em 1.2em;
    font-size: 1em;
    font-weight: 500;
    border-radius: 8px;
    border: 1px solid #646cff;
    background: #1a1a1a;
    color: #fff;
    cursor: pointer;
    transition: border-color 0.25s;
  }
  .file-upload-btn:hover {
    border-color: #747bff;
    background: #2323a3;
  }
  .ml-2 {
    margin-left: 0.5rem;
  }
  .transcript-text {
    width: 100%;
    max-width: 600px;
    text-align: left;
    color: #374151;
  }
  .transcript-text em {
    color: #888;
  }
  .transcript-text p {
    text-align: center;
  }
  .transcript-span-container {
    border: 1px solid #374151;
    border-radius: 8px;
    margin-block-end: 1rem;
    padding: 0.5rem;
  }
  .progress-container {
    width: 100%;
    max-width: 600px;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    margin: 1rem 0 0.5rem 0;
  }
  .progress-bar {
    width: 40%;
    height: 100%;
    background: linear-gradient(90deg, #6366f1 0%, #60a5fa 100%);
    border-radius: 4px;
    animation: progress-indeterminate 1.2s infinite linear;
  }
  @keyframes progress-indeterminate {
    0% {
      margin-left: -40%;
    }
    100% {
      margin-left: 100%;
    }
  }
</style>
