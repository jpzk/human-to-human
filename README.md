# Human to Human

A multiplayer compatibility game where strangers answer questions anonymously, get matched based on how similarly they think, and then awkwardly reveal themselves to each other. Think of it as speed dating, but with less pressure and more anonymous animal names.

## What It Does

You join a room, pick a deck of questions (friendship, love, office politics, etc.), and answer them while watching other players' cursors float around like digital ghosts. It's oddly comforting knowing someone else is there, even if they're just a colored dot named "Swift Panda."

The game calculates compatibility scores based on your answers—because nothing says "we should be friends" like both picking "coffee" over "tea." Then an AI writes a lovely narrative about your group's answers, turning "you both like mornings" into a poetic tale of cosmic alignment.

Once you're done reading about your compatibility scores (which are definitely not just percentages, they're *meaningful* percentages), you can request to reveal identities. If both parties agree (mutual reveal), you get to chat. It's like a digital handshake, but with more typing and less awkward eye contact.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS (the usual suspects)
- **Backend**: PartyKit (WebSocket server that handles all the real-time chaos)
- **AI**: MiniMax API for generating narratives and connection insights (turns data into poetry)
- **Audio**: Prerecorded MP3 files (we tried TTS, but it sounded like a robot reading a grocery list)
- **Deployment**: Docker (because "it works on my machine" isn't a deployment strategy)

## Prerequisites

- **Docker** and **Docker Compose** (required—this is a Docker project)
- A MiniMax API key (set `MINIMAX_API_KEY` in `.env` if you want AI-generated stories; otherwise it'll use perfectly fine fallback templates that won't judge you)

> **Note**: While you *can* run this without Docker (Node.js 18+, npm/yarn), we recommend using Docker. It handles all dependencies, ensures consistent environments, and saves you from the "it works on my machine" conversation.

## Getting Started

This project uses Docker for development and production. All common tasks are handled through the Makefile.

### Quick Start

```bash
# Start the development environment
make up
```

The app will be available at `http://localhost:5173`. PartyKit runs separately on its own port because microservices are a thing now, and we're going with it.

### Makefile Commands

The project includes a Makefile with convenient commands for common tasks:

#### Development Commands

- **`make up`** - Start the development container (builds if needed)
- **`make up-d`** - Start in detached mode (runs in background)
- **`make down`** - Stop the container
- **`make restart`** - Restart the container
- **`make logs`** - View container logs (follow mode)
- **`make shell`** - Open a shell inside the running container
- **`make build`** - Build the Docker image
- **`make clean`** - Remove containers, networks, and volumes
- **`make prune`** - Remove all unused Docker resources (use with caution)
- **`make install`** - Rebuild node_modules volume (useful after adding dependencies)
- **`make npm <command>`** - Run npm commands inside the container (e.g., `make npm install express`)

#### Deck Generation

- **`make generate-deck THEME="theme-name" QUESTIONS=10`** - Generate a new deck with TTS audio
  - Example: `make generate-deck THEME="friends" QUESTIONS=10`
  - Optional: `VOICE="voice-id"` to specify a voice

#### Production Deployment

- **`make production`** - Deploy to production (run on your production server)
  - Pulls latest code from git
  - Builds and starts production containers
  - Cleans up old Docker images

### Running Without Docker (Not Recommended)

If you really want to run it without Docker:

```bash
# Install dependencies
npm install

# Run dev server (Vite + PartyKit)
npm run dev

# Build for production
npm run build
```

This creates a `dist/` folder full of optimized files that you can serve however you want. PartyKit will serve it if you're using their platform, or you can use nginx, Caddy, or whatever web server you trust. We're not picky.

## Project Structure

```
src/
├── client/          # React app (the thing users see)
├── components/       # React components (because we're not barbarians)
├── hooks/           # Custom React hooks (useWebSocket, useGameState, etc.)
├── lib/             # Utilities and AI clients
├── services/        # Business logic (deck loading, game state)
├── types/           # TypeScript types (because types are good)
└── server.ts        # PartyKit server (the thing that handles WebSocket chaos)

decks/               # Question decks with audio files
public/decks/        # Served audio files (MP3s for each question)
```

## How It Works

1. **Lobby**: Host creates a room, picks a deck (friendship, love, office drama—you know, the classics), and shares the link. Other players join and get assigned random animal names and colors. You might be "Swift Panda" or "Calm Owl" or "Rusty Bee"—embrace your new identity.

2. **Intro**: Players listen to an intro audio that sets the mood (or skip it if you're impatient—we won't judge). Then everyone waits for 75% of players to be ready. It's like waiting for everyone to arrive at a party, but digital and with less awkward small talk.

3. **Answering**: Questions appear one at a time, like a gentle interrogation. Players answer via multiple choice buttons or sliders (because sometimes you need nuance). Audio plays for each question if enabled (because reading is hard). Once everyone answers, it auto-advances. No take-backsies—your first instinct is your final answer, just like life.

4. **Results**: Compatibility scores are calculated using advanced math (exact matches for choices, proximity calculations for sliders). The AI then generates a narrative about your group's answers, turning "you both prefer mornings" into a beautiful story about cosmic alignment. Players can see their matches ranked by compatibility—it's like a leaderboard, but for friendship potential.

5. **Reveal**: Players can request to reveal identities. If both parties agree (mutual reveal), a chat opens. If not, it just sits there pending, like a text message you're waiting for someone to respond to. No pressure, but also all the pressure.

6. **Chat**: Once revealed, players can chat freely. Well, mostly freely—it's rate limited to 10 messages per 10 seconds because we're not running a spam service, and also because typing that fast is impressive but also concerning.

## Features

- **Real-time cursors**: See where other players are moving their mouse in real-time. It's oddly intimate watching someone's cursor hover over an answer, knowing they're thinking about it. Click their cursor to nudge them (with a 10-second cooldown, because we're not monsters who spam-nudge people).

- **Audio playback**: Prerecorded MP3 files for questions, because sometimes you want to hear the question instead of reading it. Toggle on/off because some people have ears and some people have headphones and some people are in a library.

- **AI narratives**: MiniMax generates beautiful stories about your group's answers, turning data points into poetry. Falls back to perfectly fine templates if the API fails or you're running it locally without an API key. The templates won't judge you, we promise.

- **Connection insights**: The AI explains why you're compatible with someone in a way that's more poetic than "you both answered similarly." It's like having a friend who's really good at explaining why you and someone else would get along.

- **Mutual reveal**: Both parties must agree before identities are revealed. No surprises, just mutual consent. It's like a digital handshake, but with more typing and less awkward eye contact.

## Decks

Decks are JSON files with questions, answer options, and audio file references. Think of them as conversation starters, but structured and with audio. Currently available:

- **Friendship Fortunes**: For when you want to deepen existing friendships or make new ones
- **Love in Harmony**: For couples who want to learn more about each other (or confirm they're compatible)
- **Whispers of the Heart**: For those deep, meaningful conversations
- **Office Allies**: For team building that doesn't involve trust falls or awkward icebreakers

Want to add more? Create a deck JSON and corresponding audio files. The structure should be obvious if you look at existing decks—we believe in learning by example, not by reading documentation.

## Environment Variables

- `MINIMAX_API_KEY`: Your MiniMax API key for AI features. Optional, but recommended unless you're perfectly happy reading template narratives (which are also fine, we're not judging).

## Known Limitations

- **No persistence**: Rooms die when the last person leaves. State is ephemeral, just like your hopes and dreams. But also like a good conversation—sometimes the moment is what matters, not the recording.

- **Rate limiting is basic**: Don't abuse it or we'll add CAPTCHA, and nobody wants that. Be nice to the servers, they're trying their best.

- **Audio files are large**: Host them on a CDN if you care about load times. Or don't, and watch your users wait. Your call.

- **No mobile optimization**: Desktop only, because we're not masochists and mobile WebSocket + cursor tracking + audio playback is a special kind of hell. Maybe one day, but today is not that day.

## Contributing

Found a bug? Have an idea? Want to add a feature? Fork it, change it, submit a PR. We're always happy to see what people build with this. Or don't—it's your life, and we respect that.

## License

Check the LICENSE file if you care about that sort of thing. Or don't. We're not your lawyer, and this isn't legal advice. But if you're using this for something commercial, maybe check it out? Just a thought.

## Credits

Built with Cursor (the AI coding assistant that made this possible), MiniMax (for turning data into poetry), and Hume.ai (for the audio magic). These tools are pretty great, and we're grateful they exist.

---

*Remember: This is just a game. The real connections happen when you actually talk to people. But hey, if this helps break the ice, we're here for it.*
