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
  loadModel: (model?: SupportedModel) => Promise<void>;
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
      }
    };

    // Check worker status on load
    worker.postMessage({ type: 'status' });
  }

  async function loadModel(model: SupportedModel = 'Xenova/whisper-base') {
    if (!worker) throw new Error('Transcriber worker not available');
    workerStatus.set({ status: 'loading', message: 'Loading model...', model });
    worker.postMessage({ type: 'load-model', model, quantized: true });
  }

  async function transcribe(
    file: File,
    model: SupportedModel = 'Xenova/whisper-base',
    language: string = 'en'
  ) {
    if (!worker) {
      throw new Error('Transcriber worker not available');
    }

    isBusy.set(true);
    transcript.set({ isBusy: true, text: '', chunks: [] });
    workerStatus.set({
      status: 'transcribing',
      message: 'Starting transcription...'
    });

    try {
      const audioBuffer = await decodeAudioFile(file);
      const selectedModel = SUPPORTED_MODELS.find(m => m.id === model);

      worker.postMessage({
        audio: audioBuffer,
        model,
        multilingual: selectedModel?.languages.includes('multilingual') || false,
        quantized: true, // Use quantized models by default for better performance
        subtask: language === 'en' ? 'transcribe' : 'translate',
        language
      });
    } catch (err) {
      isBusy.set(false);
      workerStatus.set({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to process audio'
      });
      throw err;
    }
  }

  return {
    transcript,
    isBusy,
    transcribe,
    workerStatus,
    supportedModels: SUPPORTED_MODELS,
    loadModel
  };
}