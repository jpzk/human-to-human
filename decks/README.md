# Deck Generator

Generate custom decks with AI-generated questions and TTS audio narration.

## Prerequisites

Ensure you have the following environment variables set in `.env`:

```
MINIMAX_API_KEY=your-minimax-api-key
HUME_API_KEY=your-hume-api-key
```

## Usage

```bash
# Generate a deck with default 10 questions
npx tsx decks/generate-deck.ts --theme "friends"

# Generate a deck with custom number of questions
npx tsx decks/generate-deck.ts --theme "couples" --questions 8

# Short form
npx tsx decks/generate-deck.ts -t "adventures" -q 12
```

## Output

Each generated deck creates a folder with:

```
decks/<deck-name>/
  deck.json          # Deck data with audio file references
  intro.mp3          # Introduction narration
  q1_<name>.mp3      # Question 1 audio
  q2_<name>.mp3      # Question 2 audio
  ...
```

## Deck JSON Structure

```json
{
  "deck_name": "Deck Name",
  "introduction": "Introduction text read by narrator...",
  "introAudioFile": "intro.mp3",
  "cards": [
    {
      "card_name": "question_name",
      "question": "The question text?",
      "type": "buttons",
      "answers": ["Answer 1", "Answer 2", "Answer 3", "Answer 4"],
      "audioFile": "q1_question_name.mp3"
    }
  ]
}
```

## Question Types

- **buttons**: Multiple choice with 4 answers
- **slider**: Spectrum between two extremes (2 answers)

## Intimacy Ordering

Questions are automatically ordered from least to most intimate:
1. First third: Light, casual (hobbies, preferences)
2. Middle third: Medium depth (values, dreams)
3. Final third: Deep and vulnerable (fears, regrets)

The last 2-3 questions include `hideCursors: true` for privacy.

## Voice

Audio is generated using Hume AI's "Dacher" voice - a friendly, warm narrator voice that creates an emotionally-resonating experience.
