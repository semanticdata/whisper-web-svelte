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
  <input type="file" accept="audio/*" on:change={handleFileChange} />
  {#if audioUrl}
    <div class="audio-controls">
      <audio bind:this={audioPlayer} src={audioUrl} controls></audio>
      <button on:click={clearAudio}>Clear</button>
    </div>
  {/if}
  {#if $isBusy}
    <div>Transcribing audio, please wait...</div>
  {/if}
  <Transcript transcribedData={transcript} />
</div>

<style>
  .audio-manager {
    width: 100%;
  }
  .audio-controls {
    margin: 1rem 0;
  }
</style>
