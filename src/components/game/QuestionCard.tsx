import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getContrastTextColor } from "@/lib/utils";
import type { MultipleChoiceQuestion } from "@/types/game";

type QuestionCardProps = {
  question: MultipleChoiceQuestion;
  onAnswer?: (questionId: string, answerId: string) => void;
  hasAnswered?: boolean;
  myColor?: string | null;
};

export function QuestionCard({ question, onAnswer, hasAnswered = false, myColor }: QuestionCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (answerId: string) => {
    if (hasAnswered) return;
    setSelectedId(answerId);
    onAnswer?.(question.id, answerId);
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-8 p-12 border border-border rounded-lg max-w-xl w-[90%]">
      <h2 className="text-2xl font-semibold text-center text-foreground">
        {question.text}
      </h2>
      <div className="grid grid-cols-2 gap-4 w-full">
        {question.answers.map((answer) => {
          const isSelected = selectedId === answer.id;
          return (
            <Button
              key={answer.id}
              variant={isSelected ? "default" : "gameOutline"}
              effect="expand"
              className="min-h-[72px] py-5 px-6 text-base whitespace-normal text-center"
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
              disabled={hasAnswered}
            >
              {answer.text}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
