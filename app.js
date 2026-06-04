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

async function backupFlash() {
  await requireConnection();

  const start = parseHexOrDec($("readAddr").value);
  const totalSize = parseHexOrDec($("flashSize").value);
  const chunkSize = parseHexOrDec($("chunkSize").value);

  const parts = [];
  let read = 0;

  log(`Iniciando backup desde 0x${start.toString(16)}. Tamaño: ${totalSize} bytes.`);
  setProgress(0, totalSize);

  while (read < totalSize) {
    const currentSize = Math.min(chunkSize, totalSize - read);
    const address = start + read;

    log(`Leyendo 0x${address.toString(16)} - ${currentSize} bytes...`);

    const data = await loader.readFlash(address, currentSize);

    parts.push(data instanceof Uint8Array ? data : new Uint8Array(data));
    read += currentSize;
    setProgress(read, totalSize);
  }

  const blob = new Blob(parts, { type: "application/octet-stream" });
  const filename = `esp32-backup-${totalSize / 1024 / 1024}MB.bin`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

  log(`Backup completado: ${filename}`);
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
