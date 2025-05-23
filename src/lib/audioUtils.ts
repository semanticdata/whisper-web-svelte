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
): Promise<string> {
  if (currentUrl) {
    revokeAudioUrl(currentUrl);
  }
  return createAudioUrl(file);
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
