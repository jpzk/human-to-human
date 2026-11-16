import { AnimatePresence } from "framer-motion";
import { QuestionCard } from "./QuestionCard";
import { SliderQuestionCard } from "./SliderQuestionCard";
import { QuestionType } from "@/types/game";
import { getAnsweredCount, hasUserAnsweredQuestion } from "@/services/gameService";
import type { Question } from "@/types/game";
import type { AnswerRevealMessage } from "@/types/messages";
import { AnswerRevealLayer } from "./AnswerRevealLayer";

type AnsweringViewProps = {
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  questions: Question[];
  totalPlayers: number;
  answeredBy: Record<string, string[]>;
  myId: string | null;
  myName: string | null;
  myColor: string | null;
  onAnswer: (questionId: string, answerId: string) => void;
  onSliderAnswer: (questionId: string, value: number) => void;
  answerReveal?: AnswerRevealMessage | null;
  revealStarts?: Record<string, { x: number; y: number } | undefined>;
};

export function AnsweringView({
  currentQuestion,
  currentQuestionIndex,
  questions,
  totalPlayers,
  answeredBy,
  myId,
  myName,
  myColor,
  onAnswer,
  onSliderAnswer,
  answerReveal,
  revealStarts = {},
}: AnsweringViewProps) {
  if (!currentQuestion) return null;
  
  const totalQuestions = questions.length;
  const answeredCount = getAnsweredCount(currentQuestion.id, answeredBy);
  const hasAnswered = hasUserAnsweredQuestion(currentQuestion.id, myName, answeredBy);
  const reveal = answerReveal && answerReveal.questionId === currentQuestion.id ? answerReveal : null;
  const pickedIds = reveal ? reveal.answers.map((a) => a.answerId).filter((x): x is string => !!x) : undefined;

  return (
    <>
      {/* Question progress indicator */}
      <div className="absolute top-[calc(50%+280px)] left-1/2 -translate-x-1/2 flex gap-2 z-10 mobile:fixed mobile:top-auto mobile:bottom-5">
        {questions.map((q, idx) => {
          const isAnswered = hasUserAnsweredQuestion(q.id, myName, answeredBy);
          const isCurrent = idx === currentQuestionIndex;
          return (
            <div
              key={q.id}
              className={`w-3 h-3 rounded-full transition-all ${
                isAnswered
                  ? "bg-[#f09a85]"
                  : isCurrent
                  ? "bg-primary ring-2 ring-primary ring-offset-2"
                  : "bg-muted"
              }`}
              title={q.text}
            />
          );
        })}
      </div>
      {/* Polymorphic question rendering based on question type */}
      <AnimatePresence mode="wait">
        {currentQuestion.type === QuestionType.MULTIPLE_CHOICE ? (
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            onAnswer={onAnswer}
            hasAnswered={hasAnswered}
            myColor={myColor}
            pickedIds={pickedIds}
          />
        ) : currentQuestion.type === QuestionType.SLIDER ? (
          <SliderQuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            onAnswer={onSliderAnswer}
            hasAnswered={hasAnswered}
            myColor={myColor}
          />
        ) : null}
      </AnimatePresence>
      {reveal && (
        <AnswerRevealLayer
          key={reveal.questionId}
          reveal={reveal}
          starts={revealStarts}
          sliderPositions={currentQuestion.type === QuestionType.SLIDER ? currentQuestion.config.positions : undefined}
        />
      )}
    </>
  );
}
