import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getContrastTextColor } from "@/lib/utils";
import type { SliderQuestion } from "@/types/game";

type SliderQuestionCardProps = {
  question: SliderQuestion;
  onAnswer: (questionId: string, value: number) => void;
  hasAnswered?: boolean;
  myColor?: string | null;
};

export function SliderQuestionCard({
  question,
  onAnswer,
  hasAnswered = false,
  myColor,
}: SliderQuestionCardProps) {
  const { config } = question;
  // Initialize to middle position (or closest to middle for even positions)
  const initialValue = Math.floor((config.positions - 1) / 2);
  const [value, setValue] = useState(initialValue);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Show controls 2 seconds after question is shown
  useEffect(() => {
    const timer = setTimeout(() => setShowControls(true), 2000);
    return () => clearTimeout(timer);
  }, [question.id]);

  // Reset state when question changes
  useEffect(() => {
    setValue(initialValue);
    setIsConfirmed(false);
    setShowControls(false);
  }, [question.id, initialValue]);

  const handleConfirm = () => {
    if (hasAnswered || isConfirmed || !showControls) return;
    setIsConfirmed(true);
    onAnswer(question.id, value);
  };

  const isDisabled = hasAnswered || isConfirmed || !showControls;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      transition={{ duration: 2, ease: [0.4, 0, 0.2, 1] }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-8 p-12 w-1/2 mobile:relative mobile:top-0 mobile:left-0 mobile:translate-x-0 mobile:translate-y-0 mobile:w-full mobile:min-h-full mobile:justify-center mobile:gap-6 mobile:px-5 mobile:pt-4 mobile:pb-16"
    >
      <h2 className="text-4xl font-semibold text-center text-foreground leading-[1.1] w-[66.666667vw] mobile:text-[22px] mobile:leading-snug mobile:w-full">
        {question.text}
      </h2>

      <motion.div
        className="w-full px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={showControls ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4 }}
      >
        <Slider
          positions={config.positions}
          value={value}
          labels={config.labels}
          labelStyle={config.labelStyle}
          onChange={setValue}
          disabled={isDisabled}
          playerColor={myColor}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={showControls ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Button
          variant="gameOutline"
          effect="expand"
          className="player-only h-auto py-4 px-8 text-base"
          style={
            isConfirmed && myColor
              ? {
                  backgroundColor: myColor,
                  color: getContrastTextColor(myColor),
                  borderColor: myColor,
                }
              : undefined
          }
          onClick={handleConfirm}
          disabled={isDisabled}
        >
          {isConfirmed ? "Confirmed" : "Confirm"}
        </Button>
      </motion.div>
    </motion.div>
  );
}
