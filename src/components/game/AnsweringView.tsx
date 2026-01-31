import { QuestionCard } from "./QuestionCard";
import { PLACEHOLDER_QUESTIONS } from "@/types/game";
import { getAnsweredCount, hasUserAnsweredQuestion } from "@/services/gameService";
import type { Question } from "@/types/game";

type AnsweringViewProps = {
  currentQuestion: Question;
  currentQuestionIndex: number;
  totalPlayers: number;
  answeredBy: Record<string, string[]>;
  myId: string | null;
  myName: string | null;
  onAnswer: (questionId: string, answerId: string) => void;
};

export function AnsweringView({
  currentQuestion,
  currentQuestionIndex,
  totalPlayers,
  answeredBy,
  myId,
  myName,
  onAnswer,
}: AnsweringViewProps) {
  const totalQuestions = PLACEHOLDER_QUESTIONS.length;
  const answeredCount = getAnsweredCount(currentQuestion.id, answeredBy);

  return (
    <>
      {/* Player and progress info */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-background/80 backdrop-blur-sm border border-border rounded-full z-10">
        <span className="text-sm font-medium">
          Players: <span className="text-primary">{totalPlayers}</span>
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="text-sm font-medium">
          Question {currentQuestionIndex + 1}/{totalQuestions}
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="text-sm font-medium">
          Answered: <span className="text-primary">{answeredCount}/{totalPlayers}</span>
        </span>
      </div>
      {/* Question progress indicator */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {PLACEHOLDER_QUESTIONS.map((q, idx) => {
          const isAnswered = hasUserAnsweredQuestion(q.id, myName, answeredBy);
          const isCurrent = idx === currentQuestionIndex;
          return (
            <div
              key={q.id}
              className={`w-3 h-3 rounded-full transition-all ${
                isAnswered
                  ? "bg-green-500"
                  : isCurrent
                  ? "bg-primary ring-2 ring-primary ring-offset-2"
                  : "bg-muted"
              }`}
              title={q.text}
            />
          );
        })}
      </div>
      <QuestionCard key={currentQuestion.id} question={currentQuestion} onAnswer={onAnswer} />
    </>
  );
}
