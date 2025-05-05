<script lang="ts">
  import { createEventDispatcher } from "svelte";
  export let transcript: string = "";
  const dispatch = createEventDispatcher();

  let name = "";
  let address = "";
  let phone = "";
  let notes = "";

  function downloadAnnotated() {
    const annotated = `Name: ${name}\nAddress: ${address}\nPhone: ${phone}\nNotes: ${notes}\n\nTranscript:\n${transcript}`;
    const blob = new Blob([annotated], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "annotated_transcript.txt";
    link.click();
    URL.revokeObjectURL(url);
    dispatch("downloaded");
  }
</script>

<div class="annotate-container">
  <h2>Annotate Transcript</h2>
  <form on:submit|preventDefault={downloadAnnotated}>
    <label>
      Name:
      <input type="text" bind:value={name} placeholder="Enter name" />
    </label>
    <label>
      Address:
      <input type="text" bind:value={address} placeholder="Enter address" />
    </label>
    <label>
      Phone:
      <input type="text" bind:value={phone} placeholder="Enter phone" />
    </label>
    <label>
      Notes:
      <textarea bind:value={notes} placeholder="Enter notes"></textarea>
    </label>
    <label>
      Transcript:
      <textarea value={transcript} readonly rows="6"></textarea>
    </label>
    <button type="submit" class="file-upload-btn">Download as TXT</button>
  </form>
</div>

<style>
  .annotate-container {
    width: 500px;
    margin: 0 auto;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
    padding: 1rem;
    display: flex;
    flex-direction: column;
  }
  .annotate-container h2 {
    text-align: center;
    margin: 0;
  }
  .annotate-container form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .annotate-container label {
    display: flex;
    flex-direction: column;
    font-weight: 600;
  }
  .annotate-container input,
  .annotate-container textarea {
    font-size: 1rem;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 5px;
    margin-top: 0.2rem;
    background: #f9fafb;
    resize: vertical;
    font-family: inherit;
  }
  .annotate-container textarea[readonly] {
    background: #f3f4f6;
    color: #6b7280;
  }
  .file-upload-btn {
    background: #2563eb;
    color: #fff;
    border: none;
    padding: 0.7rem 1.5rem;
    border-radius: 5px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: 1rem;
    transition: background 0.2s;
  }
  .file-upload-btn:hover {
    background: #1d4ed8;
  }
</style>
