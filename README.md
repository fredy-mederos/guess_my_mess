# Guess My Mess

A drawing & guessing party game for teams. One person draws, everyone else races to guess
the word in the chat. Share a link, play in the browser, and there's no server to run.

## Features

- **Private rooms**: create a room, copy the link, and your team joins. The room ID is a random,
  unguessable string kept after the `#`, so it never reaches the web server.
- **Make your character**: build a doodle avatar (color, eyes, mouth, hat) and pick a name.
- **Game setup** (host): word pack language (English, Español, Deutsch), difficulty,
  number of rounds, drawing time, how many words to choose from, letter hints, "close guess"
  hints, and **your own custom words** (mixed in or used on their own).
- **Drawing tools**: pen, pencil, marker, ink nib, spray, neon, rainbow, eraser, fill bucket,
  line/rectangle/ellipse, 24 colors plus a custom picker, brush size, paper color, undo, clear.
- **Scoring**: faster guesses score more, the first guess gets a bonus, and the drawer earns
  points for every correct guess. Final podium plus a **hall of fame** that persists on the host's device.
- **Chat**: guesses go in the chat. Correct answers are hidden, near misses get a private
  "so close!", and players who already guessed can talk without spoiling it.
- Reactions, sound effects, notebook (light) / chalkboard (dark) themes, works on phones and big screens.
- Survives reloads: the host can refresh and the room comes back. Guests rejoin and keep their score.

## How it works (no server)

The site is plain static files, so GitHub Pages can host it. Multiplayer happens **peer-to-peer**
over WebRTC:

```
          ┌──────────── host's browser ────────────┐
guest ◀──▶│  game engine: turns, timer, word, score │◀──▶ guest
guest ◀──▶│  (the host is also a player)            │◀──▶ guest
          └─────────────────────────────────────────┘
```

- The browser that creates the room **is the game server**. It holds the secret word and sends
  each player only what they're allowed to see.
- The free public [PeerJS](https://peerjs.com) server is only used to introduce browsers to each
  other. Drawings, guesses and chat go directly between browsers, encrypted (DTLS).
- **The host must keep the tab open.** Closing it ends the room. A reload is fine.
- Some corporate networks or VPNs block peer-to-peer connections. If a teammate can't join,
  try without the VPN. PeerJS falls back to its relay servers when it can.

## Run it locally

```bash
python3 serve.py
```

It prints two addresses: `localhost` for this computer, and your network IP for phones and
laptops on the same Wi-Fi. Create the room from the network-IP address so the invite link
works on other devices.

## Deploy on GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`**.
3. Share `https://<user>.github.io/<repo>/` with the team. Each "Create a room" makes a new private link.

Pages for private repositories needs a paid GitHub plan. On a free account, make the repo
public first. The site itself is public either way; rooms stay private because of their
random links.

## Customize

- **Words**: edit `js/words/en.js`, `es.js`, `de.js` (easy / medium / hard lists).
- **New language**: copy one of those files, then register it in `js/words/index.js`.
- **Timing & scoring**: constants at the top of `js/engine.js`.

## Project layout

```
index.html          page skeleton
css/base.css        theme (notebook / chalkboard), sketchy buttons & cards, home screen
css/game.css        room layout, board, toolbar, chat, overlays, responsive rules
js/main.js          boot + glue between network, engine and UI
js/net.js           PeerJS transport: host star, heartbeats, reconnects
js/engine.js        host-only game logic (the source of truth)
js/board.js         canvas, brushes, fill, shapes, op replay
js/toolbar.js       drawer's tools
js/avatar.js        doodle avatar parts
js/words/           word packs
js/ui/              home, lobby, game overlays, chat
serve.py            local dev server (no caching, prints LAN address)
```
