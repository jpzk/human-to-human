import { cn } from "@/lib/utils";

type SpinnerProps = {
  size?: number;
  className?: string;
};

export function Spinner({ size = 12, className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-muted-foreground/70 border-t-transparent",
        className
      )}
      style={{ width: size, height: size }}
    />
  );
}
