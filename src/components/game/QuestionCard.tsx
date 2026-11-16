import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getContrastTextColor } from "@/lib/utils";
import type { MultipleChoiceQuestion } from "@/types/game";

type QuestionCardProps = {
  question: MultipleChoiceQuestion;
  onAnswer?: (questionId: string, answerId: string) => void;
  hasAnswered?: boolean;
  myColor?: string | null;
  pickedIds?: string[]; // set during the answer reveal
};

export function QuestionCard({ question, onAnswer, hasAnswered = false, myColor, pickedIds }: QuestionCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  // Show answers 2 seconds after question is shown
  useEffect(() => {
    const timer = setTimeout(() => setShowAnswers(true), 2000);
    return () => clearTimeout(timer);
  }, [question.id]);

  // Reset state when question changes
  useEffect(() => {
    setSelectedId(null);
    setShowAnswers(false);
  }, [question.id]);

  const handleSelect = (answerId: string) => {
    if (hasAnswered || !showAnswers) return;
    setSelectedId(answerId);
    onAnswer?.(question.id, answerId);
  };

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
      <div className={`grid grid-cols-2 gap-4 w-full mobile:grid-cols-1 mobile:gap-2.5${pickedIds ? " answer-revealing" : ""}`}>
        {question.answers.map((answer, index) => {
          const isSelected = selectedId === answer.id;
          return (
            <motion.div
              key={answer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={showAnswers ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: index * 0.15 }}
            >
              <Button
                data-answer-id={answer.id}
                data-empty={pickedIds && !pickedIds.includes(answer.id) ? "" : undefined}
                variant="gameOutline"
                effect="expand"
                className="min-h-[144px] py-10 px-12 text-base mobile:min-h-[56px] mobile:py-3 mobile:px-4 mobile:text-[15px] whitespace-normal text-center w-full break-words"
                style={
                  isSelected && myColor
                    ? {
                        backgroundColor: myColor,
                        color: getContrastTextColor(myColor),
                        borderColor: myColor,
                      }
                    : undefined
                }
                onClick={() => handleSelect(answer.id)}
                disabled={hasAnswered || !showAnswers}
              >
                {answer.text}
              </Button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
