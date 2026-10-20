// Headless Google Chrome, driven over the DevTools protocol with Node's built-in WebSocket
// (no packages). Every player gets an isolated browser context: their own storage and
// connections, as if each one were on a separate device.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { driver } from './driver.mjs';

export const DESKTOP = { width: 1280, height: 800 };
export const PHONE = { width: 390, height: 844, mobile: true };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROMES = {
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
  win32: [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).map((dir) => join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe')),
};

function findChrome() {
  const path = process.env.CHROME || (CHROMES[process.platform] || []).find((p) => existsSync(p));
  if (!path) throw new Error('Google Chrome not found: set CHROME to its path');
  return path;
}

// Starts Chrome with a throwaway profile; screenshots go to tests/out/<name>
export async function launch(name) {
  const out = fileURLToPath(new URL(`../out/${name}/`, import.meta.url));
  mkdirSync(out, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), 'gmm-chrome-'));
  const chrome = spawn(findChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
    // All players but one are background tabs: keep their timers and connections at full speed
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    'about:blank',
  ], { stdio: 'ignore' });
  const kill = () => chrome.kill();
  process.on('exit', kill);

  // Port 0: Chrome picks a free port and writes it, with the browser's address, to this file
  let endpoint;
  for (let i = 0; i < 150 && !endpoint; i++) {
    try {
      const [port, path] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n');
      if (path) endpoint = `ws://127.0.0.1:${port}${path}`;
    } catch {}
    if (!endpoint) await sleep(100);
  }
  if (!endpoint) throw new Error('Chrome did not start');
  const ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('Could not connect to Chrome'));
  });

  let seq = 0;
  const pending = new Map();
  const names = new Map(); // DevTools session -> player name
  const errors = []; // uncaught exceptions and console.error calls, on any player's page
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const call = pending.get(m.id);
      pending.delete(m.id);
      return m.error ? call?.reject(new Error(`${call.method}: ${m.error.message}`)) : call?.resolve(m.result);
    }
    const who = names.get(m.sessionId);
    if (m.method === 'Runtime.exceptionThrown') {
      const { exception, text } = m.params.exceptionDetails;
      errors.push(`${who}: ${exception?.description || text}`.slice(0, 300));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(`${who}: console.error ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`.slice(0, 300));
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

  // A player on their own device: DESKTOP, PHONE or any { width, height, mobile, scale }
  async function player(playerName, { width, height, mobile = false, scale = 2 } = DESKTOP) {
    const { browserContextId } = await send('Target.createBrowserContext');
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    names.set(sessionId, playerName);
    const s = (method, params) => send(method, params, sessionId);
    const viewport = (w, h) => s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile });
    await s('Page.enable');
    await s('Runtime.enable');
    await viewport(width, height);
    if (mobile) await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await s('Emulation.setFocusEmulationEnabled', { enabled: true });
    await s('Page.addScriptToEvaluateOnNewDocument', { source: `(${driver})()` });

    const page = {
      name: playerName,
      // Runs JS in the page and returns its (JSON-friendly) result
      async eval(expr) {
        const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(`${playerName}: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
        return r.result.value;
      },
      async waitFor(expr, timeout = 20000) {
        const end = Date.now() + timeout;
        while (Date.now() < end) {
          try { if (await page.eval(expr)) return; } catch {}
          await sleep(150);
        }
        throw new Error(`${playerName}: timed out waiting for ${expr}`);
      },
      // Navigates (or reloads, without a url) and waits for the new page's home screen and fonts
      async load(url) {
        await page.eval('window.__stale = true').catch(() => {}); // a page already on its way out has no marker to set
        const nav = url ? await s('Page.navigate', { url }) : await s('Page.reload');
        if (nav?.errorText) throw new Error(`${playerName}: cannot open ${url}: ${nav.errorText}`);
        await page.waitFor(`!window.__stale && document.readyState === 'complete' && !!document.querySelector('#home')`, 30000);
        await page.eval('document.fonts.ready.then(() => true)');
      },
      reload: () => page.load(),
      // Opens the game as a returning player: their name and doodle are already saved here
      async open(url, avatar) {
        await page.load(url);
        await page.eval(`localStorage.setItem('gmm:name', ${JSON.stringify(JSON.stringify(playerName))});
          localStorage.setItem('gmm:avatar', ${JSON.stringify(JSON.stringify(avatar))}); true`);
        await page.reload();
      },
      async resize(w, h) {
        await viewport(w, h);
        await sleep(400);
      },
      // Saves a JPEG to tests/out/<name>/<file>, or to `file` when it's an absolute path
      async shot(file) {
        await s('Page.bringToFront');
        await sleep(250);
        const { data } = await s('Page.captureScreenshot', { format: 'jpeg', quality: 86 });
        writeFileSync(isAbsolute(file) ? file : join(out, file), Buffer.from(data, 'base64'));
      },
      close: () => send('Target.closeTarget', { targetId }),
    };
    return page;
  }

  async function close() {
    process.off('exit', kill);
    ws.close();
    const exited = new Promise((resolve) => chrome.once('exit', resolve));
    chrome.kill();
    await Promise.race([exited, sleep(5000)]);
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  }

  return { player, errors, out, close };
}
