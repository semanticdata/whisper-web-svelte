<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { SupportedModel, TranscriberModel } from "./transcriber";

  export let isOpen = false;
  export let supportedModels: TranscriberModel[];
  export let currentModel: SupportedModel;
  export let currentQuantized: boolean;
  export let currentMultilingual: boolean;

  let selectedModel: SupportedModel = currentModel;
  let quantized: boolean = currentQuantized;
  let multilingual: boolean = currentMultilingual;

  const dispatch = createEventDispatcher();

  function applySettings() {
    dispatch("settingsChanged", {
      model: selectedModel,
      quantized,
      multilingual,
    });
    closeModal();
  }

  let modalElement: HTMLDivElement;
  let previousActiveElement: HTMLElement | null = null;

  function closeModal() {
    isOpen = false;
    dispatch("close");
    // Return focus to the element that opened the modal
    if (previousActiveElement) {
      previousActiveElement.focus();
      previousActiveElement = null;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  // Focus management when modal opens/closes
  $: if (isOpen) {
    // Store the currently focused element before opening the modal
    previousActiveElement = document.activeElement as HTMLElement;

    // Use requestAnimationFrame to ensure the modal is in the DOM
    requestAnimationFrame(() => {
      if (modalElement) {
        // Focus the modal itself
        modalElement.focus();
      }
    });
  }

  // Update local state if props change from outside
  $: {
    selectedModel = currentModel;
    quantized = currentQuantized;
    multilingual = currentMultilingual;
  }
</script>

{#if isOpen}
  <!-- Modal Overlay - click outside to close -->
  <div class="modal-overlay" role="presentation" on:click={closeModal}>
    <!-- Modal Dialog -->
    <div
      bind:this={modalElement}
      class="modal-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      on:click|stopPropagation
      on:keydown={handleKeyDown}
      tabindex="-1"
    >
      <h2 id="settings-title" class="modal-title">Settings</h2>

      <div class="form-group">
        <label for="model-select-modal">Model:</label>
        <select id="model-select-modal" bind:value={selectedModel}>
          {#each supportedModels as model}
            <option value={model.id}>{model.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" bind:checked={quantized} />
          Quantized Model
        </label>
        <small
          >Uses less memory and can be faster, but may be less accurate.</small
        >
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" bind:checked={multilingual} />
          Multilingual Model
        </label>
        <small
          >Enables transcription for multiple languages. May require a larger
          model.</small
        >
      </div>

      <div class="modal-actions">
        <button class="button-secondary" on:click={closeModal}>Cancel</button>
        <button class="button-primary" on:click={applySettings}>Apply</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
    background-color: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 90%;
    max-width: 500px;
  }

  .modal-title {
    margin-top: 0;
    margin-bottom: 1.5rem;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group small {
    display: block;
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .form-group input[type="checkbox"] {
    margin-right: 0.5rem;
  }

  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #d1d5db; /* Tailwind gray-300 */
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
  }

  /* Basic button styling, can be expanded */
  button {
    padding: 0.6em 1.2em;
    border-radius: 8px;
    border: 1px solid transparent;
    font-size: 1em;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.25s;
  }

  .button-primary {
    background-color: #4f46e5; /* Tailwind indigo-600 */
    color: white;
  }
  .button-primary:hover {
    background-color: #4338ca; /* Tailwind indigo-700 */
  }

  .button-secondary {
    background-color: #e5e7eb; /* Tailwind gray-200 */
    color: #374151; /* Tailwind gray-700 */
    border: 1px solid #d1d5db; /* Tailwind gray-300 */
  }
  .button-secondary:hover {
    background-color: #d1d5db; /* Tailwind gray-300 */
  }
</style>
