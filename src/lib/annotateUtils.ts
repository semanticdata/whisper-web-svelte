// Utility for formatting and downloading annotated transcripts
export function downloadAnnotatedTranscript({
  name,
  address,
  phone,
  notes,
  transcript,
  onDownloaded,
}: {
  name: string;
  address: string;
  phone: string;
  notes: string;
  transcript: string;
  onDownloaded?: () => void;
}) {
  const annotated = `Name: ${name}\nAddress: ${address}\nPhone: ${phone}\nNotes: ${notes}\n\nTranscript:\n${transcript}`;
  const blob = new Blob([annotated], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "annotated_transcript.txt";
  link.click();
  URL.revokeObjectURL(url);
  if (onDownloaded) onDownloaded();
}
