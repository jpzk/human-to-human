export interface ButtonCard {
  card_name: string;
  question: string;
  type: "buttons";
  answers: [string, string, string, string];
  audioFile?: string;
}

export interface SliderCard {
  card_name: string;
  question: string;
  type: "slider";
  answers: [string, string] | [string, string, string, string, string];
  audioFile?: string;
}

export type Card = ButtonCard | SliderCard;

export interface Deck {
  deck_name: string;
  introduction?: string;
  introAudioFile?: string;
  cards: Card[];
}

// Import pre-generated decks
import friendshipFortunes from "./decks-data/friendship-fortunes.json";
import loveInHarmony from "./decks-data/love-in-harmony.json";
import whispersOfTheHeart from "./decks-data/whispers-of-the-heart.json";
import officeAllies from "./decks-data/office-allies.json";

// All decks are pre-generated with audio files
const allDecks: Deck[] = [
  friendshipFortunes as Deck,
  loveInHarmony as Deck,
  whispersOfTheHeart as Deck,
  officeAllies as Deck,
];

export function getDecks(): Deck[] {
  return allDecks;
}

export function getDeck(deckName: string): Deck | undefined {
  return allDecks.find((d) => d.deck_name === deckName);
}
