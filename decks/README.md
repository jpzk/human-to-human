# Deck Generator

Generate custom decks with AI-generated questions.

## Prerequisites

Ensure you have the following environment variable set in `.env`:

```
MINIMAX_API_KEY=your-minimax-api-key
```

## Usage

### Using Makefile (Recommended - runs in Docker container)

```bash
# Make sure the dev container is running first
make up-d

# Generate a deck with default 10 questions
make generate-deck THEME="friends"

# Generate a deck with custom number of questions
make generate-deck THEME="couples" QUESTIONS=8

# Generate an adventures deck with 12 questions
make generate-deck THEME="adventures" QUESTIONS=12
```

### Direct execution (requires local Node.js and dependencies)

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
  deck.json          # Deck data with questions
```

## Deck JSON Structure

```json
{
  "deck_name": "Deck Name",
  "introduction": "Introduction text...",
  "cards": [
    {
      "card_name": "question_name",
      "question": "The question text?",
      "type": "buttons",
      "answers": ["Answer 1", "Answer 2", "Answer 3", "Answer 4"]
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
