import { useState, useCallback, useRef, useEffect } from "react";

type AudioState = "idle" | "loading" | "playing" | "error";

/**
 * Simple hook for playing prerecorded audio files (MP3s from deck)
 * Does NOT include TTS generation - only plays existing audio files
 */
export function useAudio() {
  const [state, setState] = useState<AudioState>("idle");
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  // Initialize AudioContext lazily
  const getAudioContext = useCallback((): AudioContext | null => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.error("Failed to create AudioContext:", error);
        return null;
      }
    }
    return audioContextRef.current;
  }, []);

  // Stop current playback
  const stop = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (error) {
        // Source may already be stopped
      }
      currentSourceRef.current = null;
    }
    setState("idle");
  }, []);

  // Play audio from AudioBuffer
  const playAudio = useCallback(
    async (audioBuffer: AudioBuffer) => {
      const audioContext = getAudioContext();
      if (!audioContext) {
        setState("error");
        setTimeout(() => setState("idle"), 3000);
        return;
      }

      // Resume context if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Stop any currently playing audio
      stop();

      try {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        source.onended = () => {
          setState("idle");
          currentSourceRef.current = null;
        };

        source.start(0);
        currentSourceRef.current = source;
        setState("playing");
      } catch (error) {
        console.error("Failed to play audio:", error);
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }
    },
    [getAudioContext, stop]
  );

  // Play prerecorded audio from URL
  const playPrerecordedAudio = useCallback(
    async (url: string) => {
      if (!url) return;

      // Stop any current playback
      stop();

      // Check cache first
      const cached = audioCacheRef.current.get(url);
      if (cached) {
        await playAudio(cached);
        return;
      }

      // Set loading state
      setState("loading");

      try {
        // Fetch audio file
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioContext = getAudioContext();
        if (!audioContext) {
          setState("error");
          setTimeout(() => setState("idle"), 3000);
          return;
        }

        // Decode and cache
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioCacheRef.current.set(url, audioBuffer);
        await playAudio(audioBuffer);
      } catch (error) {
        console.error("Failed to play prerecorded audio:", error);
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }
    },
    [getAudioContext, playAudio, stop]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    state,
    playPrerecordedAudio,
    stop,
  };
}
