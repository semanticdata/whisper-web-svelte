import { writable, type Writable } from 'svelte/store';

export type SupportedModel =
  | 'Xenova/whisper-tiny'
  | 'Xenova/whisper-base'
  | 'Xenova/whisper-small'
  | 'Xenova/whisper-medium'
  | 'distil-whisper/distil-medium.en'
  | 'distil-whisper/distil-large-v2'
  | 'Xenova/whisper-large-v3';

export interface TranscriberData {
  isBusy: boolean;
  text: string;
  chunks: { text: string; timestamp: [number, number | null] }[];
  progress?: {
    percent: number;
    elapsed: number;
    remaining: number | null;
  };
}

export interface TranscriberModel {
  id: SupportedModel;
  name: string;
  languages: string[];
  recommended: boolean;
}

export interface Transcriber {
  transcript: Writable<TranscriberData | undefined>;
  isBusy: Writable<boolean>;
  transcribe: (file: File, model?: SupportedModel, language?: string) => Promise<void>;
}

export interface WorkerStatus {
  status: 'loading' | 'ready' | 'error' | 'transcribing' | 'complete';
  message?: string;
  model?: string;
}

// Supported models (all free, no API key needed)
export const SUPPORTED_MODELS: TranscriberModel[] = [
  {
    id: 'Xenova/whisper-tiny',
    name: 'Whisper Tiny',
    languages: ['multilingual'],
    recommended: true
  },
  {
    id: 'Xenova/whisper-base',
    name: 'Whisper Base',
    languages: ['multilingual'],
    recommended: true
  },
  {
    id: 'Xenova/whisper-small',
    name: 'Whisper Small',
    languages: ['multilingual'],
    recommended: true
  },
  {
    id: 'Xenova/whisper-medium',
    name: 'Whisper Medium',
    languages: ['multilingual'],
    recommended: false // Larger model, slower but more accurate
  },
  {
    id: 'distil-whisper/distil-medium.en',
    name: 'Distil-Whisper Medium (English)',
    languages: ['en'],
    recommended: true
  },
  {
    id: 'distil-whisper/distil-large-v2',
    name: 'Distil-Whisper Large v2',
    languages: ['multilingual'],
    recommended: true
  },
  {
    id: 'Xenova/whisper-large-v3',
    name: 'Whisper Large v3',
    languages: ['multilingual'],
    recommended: false // Very large model
  }
];

function decodeAudioFile(file: File): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
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

export function createTranscriber(): Transcriber & {
  workerStatus: Writable<WorkerStatus>;
  supportedModels: typeof SUPPORTED_MODELS;
  loadModel: (model?: SupportedModel, quantized?: boolean, multilingual?: boolean) => Promise<void>;
  cancelTranscription: () => void;
} {
  const transcript = writable<TranscriberData | undefined>(undefined);
  const isBusy = writable(false);
  const workerStatus = writable<WorkerStatus>({
    status: 'loading',
    message: 'Loading model...'
  });

  let worker: Worker | undefined;
  try {
    if (typeof window !== 'undefined') {
      worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module'
      });
    }
  } catch (err) {
    console.error('Failed to initialize worker:', err);
    workerStatus.set({
      status: 'error',
      message: 'Failed to initialize transcriber worker'
    });
  }

  if (worker) {
    worker.onmessage = (event: MessageEvent) => {
      const { status, data = {}, model, error, progress, time } = event.data;

      switch (status) {
        case 'ready':
          workerStatus.set({
            status: 'ready',
            message: 'Model ready',
            model
          });
          break;

        case 'complete':
          if (data) {
            transcript.set({
              isBusy: false,
              text: data.text || '',
              chunks: data.chunks || [],
            });
          }
          isBusy.set(false);
          workerStatus.set({
            status: 'complete',
            message: 'Transcription complete',
            model
          });
          break;

        case 'update':
          if (data) {
            transcript.set({
              isBusy: true,
              text: Array.isArray(data) ? (data[0] || '') : (data.text || ''),
              chunks: Array.isArray(data) && data[1]?.chunks ? data[1].chunks : (data.chunks || []),
              progress: {
                percent: progress || 0,
                elapsed: time?.elapsed || 0,
                remaining: time?.remaining || null
              }
            });
          }
          workerStatus.set({
            status: 'transcribing',
            message: `Transcribing... ${progress ? Math.round(progress) + '%' : ''}`,
            model
          });
          break;

        case 'cancelled':
          isBusy.set(false);
          workerStatus.set({
            status: 'ready', // Or a new 'cancelled' status if you prefer more specific UI handling
            message: 'Transcription cancelled.',
            model: model // Keep the current model context
          });
          // Optionally clear partial transcript data
          // transcript.set(undefined);
          break;

        case 'error':
          console.error('Worker error:', error);
          isBusy.set(false);
          workerStatus.set({
            status: 'error',
            message: error?.message || String(error),
            model
          });
          break;

        case 'progress':
          if (data) {
            workerStatus.set({
              status: 'loading',
              message: `Downloading model (${data.file || 'unknown'}: ${data.progress || 0}%)`,
              model: data.name
            });
          }
          break;

        default:
          // For model loading progress or other messages
          // The 'progress' status from the worker now directly includes model name and file
          // if (data && data.status === 'progress') { // This specific check might be redundant if 'progress' case handles it
          //   workerStatus.set({
          //     status: 'loading',
          //     message: `Downloading model (${data.file || 'unknown'}: ${data.progress || 0}%)`,
          //     model: data.name
          //   });
          // }
          break;
      }
    };

    // Initial status check
    worker.postMessage({ type: 'status' });
  }

  function cancelTranscription() {
    if (worker) {
      console.log('Attempting to cancel transcription...');
      worker.postMessage({ type: 'cancel' });
    }
  }

  const loadModel = async (modelId: SupportedModel = 'Xenova/whisper-base', quantized: boolean = true, multilingual: boolean = false) => {
    if (!worker) return;
    // Find the model details to determine if it's multilingual by default if not specified
    const modelDetails = SUPPORTED_MODELS.find(m => m.id === modelId);
    const isModelMultilingual = modelDetails ? modelDetails.languages.includes('multilingual') : multilingual;

    workerStatus.set({ status: 'loading', message: `Loading model ${modelId || 'default'}...` });
    worker?.postMessage({ type: 'loadModel', model: modelId, quantized, multilingual });
  }

  async function transcribe(file: File, model: SupportedModel = 'Xenova/whisper-base', language?: string) {
    if (!worker) {
      const errorMsg = 'Worker not initialized';
      console.error(errorMsg);
      workerStatus.set({ status: 'error', message: errorMsg });
      return;
    }

    console.log('Starting transcription with model:', model);
    isBusy.set(true);
    transcript.set(undefined);

    try {
      // Ensure the model is loaded first
      const modelDetails = SUPPORTED_MODELS.find(m => m.id === model);
      if (!modelDetails) {
        throw new Error(`Model ${model} not found in supported models`);
      }

      const multilingual = modelDetails.languages.includes('multilingual');
      const quantized = true;

      console.log('Loading model:', { model, multilingual, quantized });
      workerStatus.set({ status: 'loading', message: 'Loading model...' });

      // Load the model and wait for it to be ready
      await loadModel(model, quantized, multilingual);

      // Wait for the worker to confirm the model is loaded
      await new Promise<void>((resolve, reject) => {
        console.log('Waiting for model to be ready...');
        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error('Model loading timed out after 30 seconds'));
        }, 30000);

        const unsubscribe = workerStatus.subscribe(status => {
          if (status.status === 'ready' && status.model === model) {
            console.log('Model ready, starting transcription');
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          } else if (status.status === 'error') {
            clearTimeout(timeout);
            unsubscribe();
            reject(new Error(status.message || 'Error loading model'));
          }
        });
      });

      // Now that the model is ready, process the audio
      console.log('Decoding audio file...');
      workerStatus.set({ status: 'transcribing', message: 'Preparing audio...' });
      const audio = await decodeAudioFile(file);

      console.log('Sending audio to worker for transcription...');
      workerStatus.set({ status: 'transcribing', message: 'Transcribing...' });

      console.log('Sending transcription request to worker', {
        model,
        multilingual,
        quantized,
        language,
        audioLength: audio.length
      });

      worker.postMessage({
        type: 'transcribe',  // Added missing type field
        audio,
        model,
        multilingual,
        quantized,
        language,
        subtask: 'transcribe'
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Transcription error:', errorMessage, err);

      isBusy.set(false);
      workerStatus.set({
        status: 'error',
        message: `Transcription failed: ${errorMessage}`,
        model
      });

      transcript.set({
        isBusy: false,
        text: '',
        chunks: [],
        progress: undefined
      });

      // Re-throw to allow caller to handle the error if needed
      throw err;
    }
  }

  return {
    transcript,
    isBusy,
    transcribe,
    workerStatus,
    supportedModels: SUPPORTED_MODELS,
    loadModel,
    cancelTranscription
  };
}