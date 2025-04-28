<script lang="ts">
  import { onMount } from "svelte";
  import Transcript from "./Transcript.svelte";
  import type { Transcriber } from "../lib/transcriber";

  export let transcriber: Transcriber;

  // Destructure the Svelte stores from the transcriber object
  const { isBusy, transcript } = transcriber;

  let audioUrl: string | null = null;
  let audioFile: File | null = null;
  let audioPlayer: HTMLAudioElement | null = null;

  async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      audioFile = input.files[0];
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      audioUrl = URL.createObjectURL(audioFile);
      await transcriber.transcribe(audioFile);
    }
  }

  function clearAudio() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
      audioFile = null;
      transcriber.transcript.set(undefined);
    }
  }
</script>

<div class="audio-manager">
  <label class="block">
    <span class="sr-only">Choose audio file</span>
    <button
      type="button"
      class="file-upload-btn"
      on:click={() => document.getElementById("file-input")?.click()}
      >Upload Audio</button
    >
    <input
      id="file-input"
      type="file"
      accept="audio/*"
      class="hidden"
      on:change={handleFileChange}
    />
  </label>
  {#if audioUrl}
    <div class="audio-controls">
      <audio bind:this={audioPlayer} src={audioUrl} controls></audio>
      <button on:click={clearAudio} class="ml-2 file-upload-btn">Clear</button>
    </div>
  {/if}
  {#if $isBusy}
    <div class="text-blue-600 mt-2">Transcribing audio, please wait...</div>
  {/if}
  <Transcript transcribedData={transcript} />
</div>

<style>
  .audio-manager {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .audio-controls {
    margin: 1rem 0;
    display: flex;
    align-items: center;
    gap: 1rem;
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
  .hidden {
    display: none;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
