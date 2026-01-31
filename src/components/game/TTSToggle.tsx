import { Button } from "@/components/ui/button";

type TTSToggleProps = {
  enabled: boolean;
  ttsState: "idle" | "loading" | "playing" | "error";
  onToggle: () => void;
};

// Speaker icon SVG
const SpeakerIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

// Muted speaker icon SVG
const MutedSpeakerIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

// Loading spinner SVG
const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export function TTSToggle({ enabled, ttsState, onToggle }: TTSToggleProps) {
  const isLoading = ttsState === "loading";
  const isPlaying = ttsState === "playing";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={enabled ? "Disable text-to-speech" : "Enable text-to-speech"}
      className="absolute top-4 right-4 h-10 w-10 z-20"
      disabled={isLoading}
      title={enabled ? "Disable text-to-speech" : "Enable text-to-speech"}
    >
      {isLoading && <LoadingSpinner className="h-5 w-5 animate-spin" />}
      {!isLoading && enabled && (
        <SpeakerIcon className={`h-5 w-5 ${isPlaying ? "animate-pulse" : ""}`} />
      )}
      {!isLoading && !enabled && <MutedSpeakerIcon className="h-5 w-5" />}
    </Button>
  );
}
