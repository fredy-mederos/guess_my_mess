# Tests

End-to-end tests that play real games in headless Google Chrome, one isolated browser per player, plus a
quick check of the word packs. Nothing to install: you need [Node.js](https://nodejs.org) 22 or newer and
Google Chrome. Each test serves this checkout by itself, and players connect through the public PeerJS
server, so you need an internet connection.

## Run them

From the repository root:

```bash
node --test
```

This runs every `tests/*.test.mjs` file at once, in about 40 seconds:

| File | What it checks |
| --- | --- |
| `words.test.mjs` | Word packs (tidy, no word twice) and guess matching, without a browser |
| `game.test.mjs` | A 3-player game on laptops and a phone: a character change mid-room, three turns, the vote and the results |
| `phone.test.mjs` | The phone layout: guess box above the keyboard, aligned reveal scores, full-width board for the drawer |
| `hints.test.mjs` | Letter blanks for a six-word phrase, and hint letters showing up in the right places |
| `smoke.test.mjs` | The quick one: two players meet in a room and start a game |

Run a single file with `node --test tests/phone.test.mjs`. Screenshots from each run land in `tests/out/`
(not committed), handy when a step fails.

## After a release

The smoke test can check the live site:

```bash
BASE_URL=https://fredy-mederos.github.io/guess_my_mess/ node --test tests/smoke.test.mjs
```

`BASE_URL` works with every test.

## Stress test

```bash
node tests/stress.mjs
```

20 players on phones, laptops and tablets play a full round with chat floods, reactions, a player reloading,
the host reloading and a player leaving (about 8 minutes). It prints a report (join times, guess round trips,
whether every screen saw the same drawings and scores) and saves it with screenshots in `tests/out/stress/`.
For another room size, pass the number of players: `node tests/stress.mjs 8`.

## README screenshots

```bash
node tests/screenshots.mjs
```

Plays a scripted 4-player game and retakes `docs/screenshots/desktop.jpg` and `mobile.jpg`. To look at them
first, pass another folder: `node tests/screenshots.mjs tests/out/screenshots`.

## How they work

- `lib/browser.mjs` starts Chrome and drives it over the DevTools protocol with Node's built-in WebSocket.
  Every player gets an isolated browser context, like a separate device.
- `lib/driver.mjs` runs inside each player's page and plays like a person would: pointer events on the board,
  the real buttons, the chat box.
- Pages open with `?debug`, which exposes the game state as `window.__gmm.state()`, so tests wait for the game
  instead of sleeping.
- If Chrome isn't installed in the usual place, set `CHROME` to its path.
