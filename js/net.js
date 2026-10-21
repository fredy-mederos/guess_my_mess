// Peer-to-peer transport on top of PeerJS (loaded globally from the CDN in index.html).
// The public PeerJS server is only used to introduce browsers to each other; game traffic
// then flows directly between them, or through PeerJS's free relay when two networks can't
// reach each other (phones on mobile data, say). Everyone connects to the host (a star), and
// the host relays. Heartbeats catch players whose tab died without a clean "close".

const PREFIX = 'guessmymess-v1-';
const PEER_OPTS = { debug: 1 };
// 'binary' (BinaryPack) splits big messages into chunks; 'json' silently drops anything over
// ~16 KB, which drawing snapshots and canvas catch-up for late joiners easily exceed
const CONN_OPTS = { reliable: true, serialization: 'binary' };
const PING_MS = 4000;
const DEAD_MS = 14000;
const JOIN_MS = 20000;  // how long a first join keeps trying before saying what went wrong
const KNOCK_MS = 8000;  // a join the host hasn't answered by then is sent again

export function hostRoom(roomId, { onReady, onJoin, onMessage, onLeave, onError }) {
  const conns = new Map(); // clientId -> { conn, seen }
  let peer;
  let attempts = 0;
  let closed = false;

  function start() {
    peer = new Peer(PREFIX + roomId, PEER_OPTS);
    peer.on('open', () => { attempts = 0; onReady(); });
    peer.on('connection', accept);
    peer.on('disconnected', () => { if (!closed && !peer.destroyed) peer.reconnect(); });
    peer.on('error', (e) => {
      // After a host reload the server can hold on to our old ID for a few seconds
      if (e.type === 'unavailable-id' && attempts++ < 6) {
        peer.destroy();
        return setTimeout(start, 2500);
      }
      if (e.type === 'peer-unavailable') return; // a guest vanished mid-handshake
      onError(e.type);
    });
  }

  function accept(conn) {
    const cid = typeof conn.metadata?.cid === 'string' ? conn.metadata.cid.slice(0, 24) : null;
    if (!cid) return conn.close();
    conn.on('open', () => {
      const old = conns.get(cid);
      conns.set(cid, { conn, seen: Date.now() });
      if (old) old.conn.close(); // same player reconnecting: the new link wins
      onJoin(cid);
    });
    conn.on('data', (msg) => {
      const entry = conns.get(cid);
      if (!entry || entry.conn !== conn || !msg || typeof msg !== 'object') return;
      entry.seen = Date.now();
      if (msg.t === 'pong') return;
      onMessage(cid, msg);
    });
    const drop = () => {
      if (conns.get(cid)?.conn !== conn) return;
      conns.delete(cid);
      onLeave(cid);
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const [cid, entry] of conns) {
      if (now - entry.seen > DEAD_MS) {
        conns.delete(cid);
        entry.conn.close();
        onLeave(cid);
      } else if (entry.conn.open) {
        entry.conn.send({ t: 'ping' });
      }
    }
  }, PING_MS);

  start();

  return {
    sendTo(cid, msg) {
      const entry = conns.get(cid);
      if (entry?.conn.open) entry.conn.send(msg);
    },
    kick(cid) {
      const entry = conns.get(cid);
      if (!entry) return;
      conns.delete(cid);
      setTimeout(() => entry.conn.close(), 300); // let the "kicked" message go out first
    },
    close() {
      closed = true;
      clearInterval(heartbeat);
      peer?.destroy();
    },
  };
}

export function joinRoom(roomId, cid, { onOpen, onMessage, onStatus, onFail }) {
  let peer;
  let conn = null;
  let everConnected = false;
  let closed = false;
  let lastHeard = 0;
  let retryTimer = null;
  let giveUpAt = 0;
  let missing = false; // the PeerJS server said nobody holds this room right now

  // The host has replied to this attempt, so only the network route between us is left
  const answered = (c) => !!c?.peerConnection?.remoteDescription;

  function connect() {
    if (closed) return;
    clearTimeout(retryTimer);
    const old = conn;
    conn = peer.connect(PREFIX + roomId, { ...CONN_OPTS, metadata: { cid } });
    old?.close(); // an unanswered attempt; a late answer to it must not open a second link
    const c = conn;
    c.on('open', () => {
      if (c !== conn) return;
      everConnected = true;
      giveUpAt = 0;
      lastHeard = Date.now();
      onStatus('connected');
      onOpen();
    });
    c.on('data', (msg) => {
      if (c !== conn || !msg || typeof msg !== 'object') return;
      lastHeard = Date.now();
      if (msg.t === 'ping') return c.send({ t: 'pong' });
      onMessage(msg);
    });
    // PeerJS reports a failed route only here, then drops the attempt without a "close"
    c.on('error', (e) => {
      if (c === conn && !everConnected && e.type === 'negotiation-failed') fail('nopath');
    });
    c.on('close', () => { if (c === conn) lost(); });
    // A host on a phone who switched apps can't answer, and the request may be gone by the
    // time they're back: until we're in, ask again
    if (!everConnected) retryTimer = setTimeout(() => { if (c === conn && !answered(c)) connect(); }, KNOCK_MS);
  }

  function lost() {
    if (closed) return;
    conn = null;
    if (!everConnected) return; // the first attempt reports through the timeout/error path
    if (!giveUpAt) giveUpAt = Date.now() + 90000;
    if (Date.now() > giveUpAt) return onFail('lost');
    onStatus('reconnecting');
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (peer.disconnected && !peer.destroyed) peer.reconnect();
      connect();
    }, 2500);
  }

  peer = new Peer(PEER_OPTS);
  onStatus('connecting');
  // Out of time: say whether PeerJS was unreachable, the room missing, the host silent, or the
  // host found but no route between the two devices worked
  const firstTimeout = setTimeout(() => {
    if (everConnected) return;
    fail(!peer.open ? 'timeout' : answered(conn) ? 'nopath' : missing ? 'notfound' : 'silent');
  }, JOIN_MS);
  function fail(reason) {
    clearTimeout(firstTimeout);
    if (!closed) onFail(reason);
  }

  peer.on('open', connect);
  peer.on('disconnected', () => { if (!closed && !peer.destroyed) peer.reconnect(); });
  peer.on('error', (e) => {
    if (e.type === 'peer-unavailable') {
      if (everConnected) return lost(); // a host that's reloading
      // No such room, or a host who's away for a moment: keep asking until JOIN_MS is up
      missing = true;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { if (!answered(conn)) connect(); }, 2500);
      return;
    }
    if (!everConnected) fail(e.type);
  });

  const watchdog = setInterval(() => {
    if (conn?.open && Date.now() - lastHeard > DEAD_MS) {
      const dead = conn;
      conn = null;
      dead.close();
      lost();
    }
  }, PING_MS);

  return {
    send(msg) {
      if (conn?.open) conn.send(msg);
    },
    close() {
      closed = true;
      clearInterval(watchdog);
      clearTimeout(retryTimer);
      clearTimeout(firstTimeout);
      peer?.destroy();
    },
  };
}
