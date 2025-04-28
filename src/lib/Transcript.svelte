<script lang="ts">
  // Accepts a Svelte writable store as a prop
  import { get } from "svelte/store";
  import type { Writable } from "svelte/store";
  import type { TranscriberData } from "../lib/transcriber";
  /**
   * transcribedData: a Svelte writable store containing the transcript data
   */
  export let transcribedData: Writable<TranscriberData | undefined>;

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportTXT() {
    const data = get(transcribedData);
    const chunks = data?.chunks ?? [];
    const text = chunks
      .map((chunk) => chunk.text)
      .join("")
      .trim();
    const blob = new Blob([text], { type: "text/plain" });
    saveBlob(blob, "transcript.txt");
  }

  function exportJSON() {
    const data = get(transcribedData);
    let jsonData = JSON.stringify(data?.chunks ?? [], null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    saveBlob(blob, "transcript.json");
  }
</script>

<div class="transcript">
  <div class="transcript-text">
    {#if $transcribedData}
      {#if $transcribedData.isBusy}
        <p><em>Transcribing... (partial result)</em></p>
      {/if}
      {#if $transcribedData.text}
        <p>{$transcribedData.text}</p>
      {/if}
    {:else}
      <p>No transcript yet.</p>
    {/if}
  </div>
  {#if $transcribedData && !$transcribedData.isBusy && $transcribedData.text}
    <div class="transcript-actions">
      <button on:click={exportTXT} class="file-upload-btn">Export TXT</button>
      <button on:click={exportJSON} class="file-upload-btn ml-2"
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
    /* margin-top: 1rem; */
    width: 100%;
    max-width: 600px;
    text-align: left;
    color: #374151;
  }
  .transcript-text em {
    color: #888;
  }
</style>
