// Utility functions for audio file handling and management

export function createAudioUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeAudioUrl(url: string | null) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

export async function handleAudioFile(
  file: File,
  currentUrl: string | null,
  onTranscribe: (file: File) => Promise<void>
): Promise<string> {
  if (currentUrl) {
    revokeAudioUrl(currentUrl);
  }
  const url = createAudioUrl(file);
  if (typeof onTranscribe === 'function') {
    await onTranscribe(file);
  }
  return url;
}

export function clearAudioState(
  audioUrl: string | null,
  setAudioUrl: (url: string | null) => void,
  setAudioFile: (file: File | null) => void,
  clearTranscript: () => void
) {
  if (audioUrl) {
    revokeAudioUrl(audioUrl);
  }
  setAudioUrl(null);
  setAudioFile(null);
  clearTranscript();
}
