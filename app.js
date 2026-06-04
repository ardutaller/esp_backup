import { ESPLoader, Transport } from "https://unpkg.com/esptool-js@0.6.0/bundle.js";

let port = null;
let transport = null;
let loader = null;
let connected = false;

const $ = (id) => document.getElementById(id);
const logEl = $("log");
const statusEl = $("status");
const progress = $("progress");
const progressText = $("progressText");

function log(msg = "") {
  const text = typeof msg === "string" ? msg : JSON.stringify(msg);
  logEl.textContent += text + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function parseHexOrDec(value) {
  const v = String(value).trim().toLowerCase();
  return v.startsWith("0x") ? parseInt(v, 16) : parseInt(v, 10);
}

function setProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  progress.value = pct;
  progressText.textContent =
    `${pct}% (${done.toLocaleString("es-ES")} / ${total.toLocaleString("es-ES")} bytes)`;
}

function ensureWebSerial() {
  if (!("serial" in navigator)) {
    throw new Error(
      "Web Serial no disponible. Usa Chrome o Edge en HTTPS."
    );
  }
}

async function connect() {
  ensureWebSerial();

  if (connected) return;

  const baudrate = Number($("baudrate").value);

  log("Solicitando puerto serie...");

  port = await navigator.serial.requestPort();

  transport = new Transport(port, true);

  const terminal = {
    clean() {
      logEl.textContent = "";
    },
    writeLine(data) {
      log(data);
    },
    write(data) {
      logEl.textContent += data;
      logEl.scrollTop = logEl.scrollHeight;
    },
  };

  loader = new ESPLoader({
    transport,
    baudrate,
    terminal,
    debugLogging: false,
  });

  setStatus("Conectando...");

  const chip = await loader.main();

  connected = true;

  setStatus(`Conectado: ${chip}`);
  log(`Chip detectado: ${chip}`);
}

async function disconnect() {
  try {
    if (loader && connected) {
      await loader.after("hard_reset");
    }
  } catch (e) {}

  try {
    if (transport) await transport.disconnect();
  } catch (e) {
    try {
      if (port) await port.close();
    } catch (_) {}
  }

  port = null;
  transport = null;
  loader = null;
  connected = false;

  setStatus("Sin conectar");
  log("Desconectado");
}

async function requireConnection() {
  if (!connected) {
    await connect();
  }
}

async function backupFlash() {
  await requireConnection();

  alert(
    "La lectura de Flash completa aún depende de la versión concreta de esptool-js. Primero vamos a verificar la conexión."
  );

  log("Conexión correcta.");
}

async function restoreFlash() {
  alert("Pendiente de implementar.");
}

async function eraseFlash() {
  alert("Pendiente de implementar.");
}

async function resetDevice() {
  if (!loader) return;

  await loader.after("hard_reset");
  log("Reset enviado.");
}

function bind(id, fn) {
  $(id).addEventListener("click", async () => {
    try {
      $(id).disabled = true;
      await fn();
    } catch (e) {
      console.error(e);
      log("ERROR: " + (e?.message || e));
      setStatus("Error");
    } finally {
      $(id).disabled = false;
    }
  });
}

bind("btnConnect", connect);
bind("btnDisconnect", disconnect);
bind("btnBackup", backupFlash);
bind("btnRestore", restoreFlash);
bind("btnErase", eraseFlash);
bind("btnReset", resetDevice);

$("btnClear").addEventListener("click", () => {
  logEl.textContent = "";
});

log("Ardutaller ESP32 Backup Tool cargado.");
log("Pulsa 'Conectar ESP32'.");
