import { getDeck as getStaticDeck, type Deck, type Card } from "../lib/decks";
import type { Question } from "../types/game";
import { QuestionType } from "../types/game";

// Adapter: convert Card → Question
function cardToQuestion(card: Card): Question {
  const baseQuestion = {
    id: card.card_name,
    text: card.question,
    audioFile: card.audioFile,
  };

  if (card.type === "buttons") {
    return {
      ...baseQuestion,
      type: QuestionType.MULTIPLE_CHOICE,
      answers: card.answers.map((text, i) => ({ id: `a${i + 1}`, text })),
    };
  } else {
    // Slider cards: 2 answers = 6 positions with edge labels, 5 answers = 5 positions with all labels
    const answerCount = card.answers.length;
    if (answerCount === 2) {
      return {
        ...baseQuestion,
        type: QuestionType.SLIDER,
        config: {
          positions: 6,
          labels: [card.answers[0], "", "", "", "", card.answers[1]],
          labelStyle: "edges" as const,
        },
      };
    } else if (answerCount === 5) {
      return {
        ...baseQuestion,
        type: QuestionType.SLIDER,
        config: {
          positions: 5,
          labels: card.answers,
          labelStyle: "all" as const,
        },
      };
    } else {
      throw new Error(`Slider card must have 2 or 5 answers, got ${answerCount}`);
    }
  }
}

export function deckToQuestions(deck: Deck): Question[] {
  return deck.cards.map(cardToQuestion);
}

export function getDeck(name: string): Deck | undefined {
  return getStaticDeck(name);
}
