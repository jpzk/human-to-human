type AudioToggleProps = {
  enabled: boolean;
  audioState: "idle" | "loading" | "playing" | "error";
  onToggle: () => void;
};

export function AudioToggle({ enabled, audioState, onToggle }: AudioToggleProps) {
  const isLoading = audioState === "loading";
  const isPlaying = audioState === "playing";

  return (
    <button
      onClick={onToggle}
      className="absolute top-4 right-4 z-10 p-3 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
      title={enabled ? "Disable audio" : "Enable audio"}
      aria-label={enabled ? "Disable audio" : "Enable audio"}
    >
      <span className="text-xl">
        {isLoading ? (
          <span className="inline-block animate-spin">⏳</span>
        ) : enabled ? (
          <span className={isPlaying ? "text-primary" : ""}>🔊</span>
        ) : (
          <span className="opacity-50">🔇</span>
        )}
      </span>
    </button>
  );
}
