# Lumia Koko

Offline chat-to-TTS for Lumia Stream, powered by [Kokoro AI](https://github.com/thewh1teagle/kokoro-rs). No cloud required — all voice synthesis runs locally on your machine.

## What it does

Lumia Koko connects to your local [Lumia Stream](https://lumiastream.com/) instance via WebSocket and reads chat messages aloud using Kokoro AI voices. Viewers control their own voice settings through chat commands, and moderators can manage TTS behaviour in real time.

Additional integrations:

- **Discord bot** — search voices, view viewer history, manage TTS from Discord
- **OBS overlay** — browser source at `http://localhost:8765/tts-overlay` shows the currently-speaking viewer
- **Stream Deck / remote control** — HTTP API at `http://localhost:8766` (e.g. `POST /toggle-tts`)

## Requirements

- [Node.js](https://nodejs.org/) (v20 or v22 recommended; v26 requires the setup notes below)
- [Lumia Stream](https://lumiastream.com/) running locally with the WebSocket API enabled

## Setup

```bash
# 1. Clone and install
git clone https://github.com/davidtstafford/lumia-koko.git
cd lumia-koko
npm install

# 2. Build and launch
npm run build && npm start
```

### First launch

1. Open the **Connection** tab and paste your Lumia Stream API key, then click **Connect**.
2. Open the **Kokoro Setup** tab and download the TTS model (one-time, ~1 GB).
3. Optionally configure Discord and chatbot reply platforms in their respective tabs.

## Development

```bash
npm run dev       # webpack watch (main) + webpack-dev-server (renderer)
```

The renderer is served from `http://localhost:3000` in dev mode with hot reload.

## Building for distribution

```bash
npm run dist:mac   # macOS .dmg
npm run dist:win   # Windows installer
npm run dist:all   # both platforms
```

Output goes to the `release/` folder.

## Chat commands

### Viewer commands

| Command | Description |
|---|---|
| `~help [command]` | List all commands, or get details on a specific one |
| `~hello` | Greeting + tip |
| `~voices [search]` | List available voices (optional filter) |
| `~setvoice <voice_id>` | Set your personal TTS voice (e.g. `~setvoice af_heart`) |
| `~setvoicespeed <0.25–4.0>` | Set your TTS speed (1.0 = normal) |
| `~setvolume <0–100>` | Set your TTS volume as a % of the master |
| `~randomvoice` | Get assigned a random voice |
| `~myvoice` | Show your current voice/speed/volume settings |
| `~resetvoice` | Reset to stream defaults |

### Moderator commands

| Command | Description |
|---|---|
| `~skip` | Skip the currently-playing TTS message |
| `~mutevoice <user> [mins]` | Silence a viewer's TTS (permanent or timed) |
| `~unmutevoice <user>` | Re-enable TTS for a muted viewer |
| `~cooldownvoice <user> [secs]` | Set a minimum gap between that viewer's TTS reads |
| `~uncooldownvoice <user>` | Remove per-viewer cooldown |
| `~mutetts` | Pause all TTS globally |
| `~unmutetts` | Resume all TTS globally |
| `~clearqueue` | Flush the entire TTS queue |

> Viewer lookup is case-insensitive and matches on both username and display name, so `~mutevoice AfricanPuppy` works regardless of how the name was recorded from each platform.

## Ports used

| Port | Purpose |
|---|---|
| 39231 | Lumia Stream WebSocket (inbound — Lumia's port) |
| 8765 | OBS browser-source overlay (HTTP + WebSocket) |
| 8766 | Remote control API (Stream Deck, etc.) |

## Project structure

```
src/
  main/           Electron main process
    api/          HTTP remote-control server (port 8766)
    commands/     Chat command processor
    database/     SQLite schema, migrations, service layer
    discord/      Discord bot integration
    lumia/        Lumia Stream WebSocket client
    obs/          OBS overlay server (port 8765)
    tts/          Kokoro AI synthesis service
  renderer/       React UI
    pages/        App pages (Connection, TTS, Voices, Viewers, etc.)
    services/     TTS queue and rules engine
```

## License

MIT — see [LICENSE](LICENSE) if present, or the `"license"` field in `package.json`.
