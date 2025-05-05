// Utility functions for exporting transcript data
import type { TranscriberData } from "./transcriber";

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTXT(data: TranscriberData | undefined) {
  const chunks = data?.chunks ?? [];
  const text = chunks.map((chunk) => chunk.text).join("").trim();
  const blob = new Blob([text], { type: "text/plain" });
  saveBlob(blob, "transcript.txt");
}

export function exportJSON(data: TranscriberData | undefined) {
  let jsonData = JSON.stringify(data?.chunks ?? [], null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  saveBlob(blob, "transcript.json");
}
