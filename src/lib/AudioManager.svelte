<script lang="ts">
  import { onMount } from "svelte";
  import Transcript from "./Transcript.svelte";
  import AnnotateTranscript from "./AnnotateTranscript.svelte";
  import type { Transcriber, SupportedModel } from "../lib/transcriber";
  import { handleAudioFile, clearAudioState } from "./audioUtils";

  export let transcriber: ReturnType<
    typeof import("../lib/transcriber").createTranscriber
  >;
  export let model: SupportedModel = "Xenova/whisper-base";
  const { isBusy, transcript } = transcriber;
  const workerStatus = transcriber.workerStatus;

  let audioUrl: string | null = null;
  let audioFile: File | null = null;
  let audioPlayer: HTMLAudioElement | null = null;
  let isDragging = false;

  async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      audioFile = input.files[0];
      audioUrl = await handleAudioFile(audioFile, audioUrl);
    }
  }

  async function handleTranscribe() {
    if (audioFile) {
      await transcriber.transcribe(audioFile, model);
    }
  }

  function clearAudio() {
    clearAudioState(
      audioUrl,
      (url) => (audioUrl = url),
      (file) => (audioFile = file),
      () => transcriber.transcript.set(undefined)
    );
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    if (
      event.dataTransfer &&
      event.dataTransfer.files &&
      event.dataTransfer.files.length > 0
    ) {
      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith("audio/")) {
        audioFile = file;
        audioUrl = await handleAudioFile(audioFile, audioUrl);
      }
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
  }
</script>

<div class="audio-manager">
  <div
    class="drop-zone {isDragging ? 'drag-over' : ''}"
    on:drop={handleDrop}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    role="button"
    tabindex="0"
    aria-label="Drag and drop audio file here"
  >
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
    <div class="drop-text">or drag & drop an audio file here</div>
  </div>
  {#if audioUrl}
    <div class="audio-controls">
      <audio bind:this={audioPlayer} src={audioUrl} controls></audio>
      <button on:click={clearAudio} class="ml-2 file-upload-btn">Clear</button>
      <button
        on:click={handleTranscribe}
        class="ml-2 file-upload-btn"
        disabled={$isBusy ||
          !$workerStatus ||
          $workerStatus.status === "loading" ||
          $workerStatus.status === "transcribing"}
      >
        {#if $workerStatus.status === "loading"}
          Loading Model...
        {:else if $workerStatus.status === "transcribing"}
          {$transcript?.progress
            ? `Transcribing ${Math.round($transcript.progress.percent)}% (${$transcript.progress.elapsed}s)`
            : "Transcribing..."}
        {:else if $workerStatus.status === "error"}
          Retry Transcription
        {:else}
          Transcribe
        {/if}
      </button>
      {#if $transcript?.progress && $transcript.progress.remaining}
        <div class="progress-info">
          ~{Math.round($transcript.progress.remaining)}s remaining
        </div>
      {/if}
    </div>
  {/if}
  {#if $isBusy || ($transcript && !$isBusy && $transcript.text)}
    <AnnotateTranscript transcript={$transcript?.text ?? ""} />
  {:else}
    <Transcript transcribedData={transcript} />
  {/if}
</div>

<style>
  .audio-manager {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .drop-zone {
    width: 100%;
    max-width: var(--main-width);
    min-height: 120px;
    border: 2px dashed #646cff;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #23233a;
    transition:
      border-color 0.25s,
      background 0.25s;
    outline: none;
    padding: 1rem;
  }
  .drop-zone.drag-over {
    border-color: #2323a3;
    background: #2323a333;
  }
  .drop-text {
    color: #888;
    font-size: 1em;
    margin-top: 0.5em;
  }
  .audio-controls {
    margin: 1rem 0;
    display: flex;
    justify-content: space-between;
    width: var(--main-width);
  }
  .audio-controls audio {
    border-radius: 10px;
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
  .progress-info {
    color: #888;
    font-size: 0.9em;
    margin-left: 1rem;
  }
</style>
