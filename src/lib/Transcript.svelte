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
  <button on:click={exportTXT}>Export TXT</button>
  <button on:click={exportJSON}>Export JSON</button>
  <div class="transcript-text">
    {#if $transcribedData}
      {#if $transcribedData.isBusy}
        <p><em>Transcribing... (partial result)</em></p>
      {/if}
      {#if $transcribedData.text}
        <p>{$transcribedData.text}</p>
      {/if}
      {#if $transcribedData.chunks && $transcribedData.chunks.length > 0}
        <ul>
          {#each $transcribedData.chunks as chunk}
            <li>
              [{chunk.timestamp[0]} - {chunk.timestamp[1] ?? "end"}] {chunk.text}
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <p>No transcript yet.</p>
    {/if}
  </div>
</div>

<style>
  .transcript {
    width: 100%;
  }
  .transcript-text {
    margin-top: 1rem;
  }
  .transcript-text em {
    color: #888;
  }
  .transcript-text ul {
    margin: 0.5rem 0 0 1rem;
    padding: 0;
    font-size: 0.95em;
  }
</style>
