import { writable, type Writable } from 'svelte/store';

export interface TranscriberData {
  isBusy: boolean;
  text: string;
  chunks: { text: string; timestamp: [number, number | null] }[];
}

export interface Transcriber {
  transcript: Writable<TranscriberData | undefined>;
  isBusy: Writable<boolean>;
  transcribe: (file: File) => Promise<void>;
}

export interface WorkerStatus {
  status: 'loading' | 'ready' | 'error' | 'transcribing' | 'complete';
  message?: string;
  model?: string;
}

function decodeAudioFile(file: File): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const audioContext = new AudioContext({ sampleRate: 16000 }); // Whisper expects 16kHz
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        // Use the first channel (mono)
        const float32 = audioBuffer.getChannelData(0);
        resolve(new Float32Array(float32));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function createTranscriber(): Transcriber & { workerStatus: Writable<WorkerStatus> } {
  const transcript = writable<TranscriberData | undefined>(undefined);
  const isBusy = writable(false);
  const workerStatus = writable<WorkerStatus>({ status: 'loading', message: 'Loading model...' });

  // Create the worker
  // NOTE: If using Vite or SvelteKit, you may need to use an import.meta.url or special syntax for worker path resolution.
  let worker: Worker | undefined;
  try {
    if (typeof window !== 'undefined') {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    }
  } catch (err) {
    console.error('Failed to initialize worker:', err);
  }

  // Listen for messages from the worker
  if (worker) {
    worker.onmessage = (event: MessageEvent) => {
      console.log('Message from worker:', event.data);
      const { status, data, model } = event.data;
      if (status === 'ready') {
        workerStatus.set({ status: 'ready', message: 'Model ready', model });
      } else if (status === 'complete') {
        transcript.set({
          isBusy: false,
          text: data.text,
          chunks: data.chunks,
        });
        isBusy.set(false);
        workerStatus.set({ status: 'complete', message: 'Transcription complete', model });
      } else if (status === 'update') {
        // Live partial transcription feedback
        // data: [partialText, {chunks: [...] }]
        transcript.set({
          isBusy: true,
          text: Array.isArray(data) ? data[0] : data.text,
          chunks: Array.isArray(data) && data[1]?.chunks ? data[1].chunks : data.chunks,
        });
        workerStatus.set({ status: 'transcribing', message: 'Transcribing...', model });
      } else if (status === 'error') {
        console.error('Worker error:', data);
        workerStatus.set({ status: 'error', message: String(data), model });
      }
    };
    // Send a ping to get model status on load
    worker.postMessage({ type: 'status' });
  }

  async function transcribe(file: File) {
    if (!worker) return;
    isBusy.set(true);
    transcript.set({ isBusy: true, text: '', chunks: [] });
    workerStatus.set({ status: 'transcribing', message: 'Transcribing...' });
    const audioBuffer = await decodeAudioFile(file);
    // Send to worker (adapt as needed for your worker's API)
    worker.postMessage({
      audio: audioBuffer,
      model: 'Xenova/whisper-tiny', // public model, tokenless loading
      multilingual: false,
      quantized: false,
      subtask: 'transcribe',
      language: 'en',
    });
  }

  return {
    transcript,
    isBusy,
    transcribe,
    workerStatus,
  };
}
