import * as React from "react";
import { cn } from "@/lib/utils";

export type SliderProps = {
  positions: number;           // Number of snap positions (e.g., 5 or 6)
  value: number;               // 0 to positions-1 (index-based)
  labels?: string[];
  labelStyle?: "all" | "edges"; // "all" = show all, "edges" = first/last only (default: "all")
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Categorical slider with discrete snapping positions and labels.
 * Uses native range input with custom styling for accessibility and cross-browser support.
 */
export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ positions, value, labels, labelStyle = "all", onChange, disabled = false, className }, ref) => {
    // Derive min/max/step from positions
    const min = 0;
    const max = positions - 1;
    const step = 1;
    
    const tickPositions = Array.from({ length: positions }, (_, i) => i);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    };

    // Calculate thumb position percentage for visual indicator
    const thumbPosition = max > 0 ? (value / max) * 100 : 0;

    return (
      <div className={cn("w-full", className)}>
        {/* Slider track container */}
        <div className="relative pt-2 pb-8">
          {/* Track background */}
          <div className="absolute top-2 left-0 right-0 h-2 bg-muted rounded-full" />
          
          {/* Active track fill */}
          <div
            className="absolute top-2 left-0 h-2 bg-primary rounded-full transition-all duration-150"
            style={{ width: `${thumbPosition}%` }}
          />

          {/* Tick marks */}
          <div className="absolute top-2 left-0 right-0 h-2 flex justify-between px-0">
            {tickPositions.map((tick, index) => (
              <div
                key={tick}
                className={cn(
                  "w-1 h-2 rounded-full transition-colors",
                  tick <= value ? "bg-primary-foreground/50" : "bg-muted-foreground/30"
                )}
                style={{
                  position: "absolute",
                  left: `${((tick - min) / (max - min)) * 100}%`,
                  transform: "translateX(-50%)",
                }}
              />
            ))}
          </div>

          {/* Native range input (invisible but functional for accessibility) */}
          <input
            ref={ref}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className={cn(
              "absolute top-0 left-0 w-full h-6 opacity-0 cursor-pointer z-10",
              disabled && "cursor-not-allowed"
            )}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={labels && labels[value] ? labels[value] : String(value)}
          />

          {/* Custom thumb */}
          <div
            className={cn(
              "absolute top-0 w-6 h-6 bg-primary rounded-full shadow-md border-2 border-background transition-all duration-150",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
            style={{
              left: `${thumbPosition}%`,
              transform: "translateX(-50%)",
            }}
          />

          {/* Labels below track */}
          {labels && labels.length > 0 && (
            <div className="absolute top-8 left-0 right-0 flex justify-between">
              {labels.map((label, index) => {
                // Skip non-edge labels if labelStyle is "edges"
                const isEdge = index === 0 || index === labels.length - 1;
                if (labelStyle === "edges" && !isEdge) return null;
                
                const position = labels.length > 1 ? (index / (labels.length - 1)) * 100 : 50;
                const isSelected = value === index;
                return (
                  <span
                    key={index}
                    className={cn(
                      "text-xs text-center transition-colors",
                      isSelected ? "text-primary font-medium" : "text-muted-foreground"
                    )}
                    style={{
                      position: "absolute",
                      left: `${position}%`,
                      transform: "translateX(-50%)",
                      width: labelStyle === "edges" ? "auto" : `${100 / labels.length}%`,
                    }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Slider.displayName = "Slider";
