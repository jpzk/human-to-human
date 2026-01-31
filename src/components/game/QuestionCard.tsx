import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Question } from "@/types/game";

type QuestionCardProps = {
  question: Question;
  onAnswer?: (questionId: string, answerId: string) => void;
};

export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (answerId: string) => {
    setSelectedId(answerId);
    onAnswer?.(question.id, answerId);
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-8 p-12 border border-border rounded-lg max-w-xl w-[90%]">
      <h2 className="text-2xl font-semibold text-center text-foreground">
        {question.text}
      </h2>
      <div className="grid grid-cols-2 gap-4 w-full">
        {question.answers.map((answer) => (
          <Button
            key={answer.id}
            variant={selectedId === answer.id ? "default" : "gameOutline"}
            effect="expand"
            className="h-auto py-5 px-6 text-base whitespace-normal text-center"
            onClick={() => handleSelect(answer.id)}
          >
            {answer.text}
          </Button>
        ))}
      </div>
    </div>
  );
}
