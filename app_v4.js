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

window.espBackupConnect = connect;
window.connectedChipFamily = window.connectedChipFamily || "";
window.detectedChipFamily = window.detectedChipFamily || "";
window.espChipFamily = window.espChipFamily || "";

function log(msg = "") {
  const text = typeof msg === "string" ? msg : JSON.stringify(msg);
  logEl.textContent += text + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function parseHexOrDec(value) {
  const trimmed = String(value).trim().toLowerCase();
  if (trimmed.startsWith("0x")) return parseInt(trimmed, 16);
  return parseInt(trimmed, 10);
}

function setProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  progress.value = pct;
  progressText.textContent = `${pct}% (${done.toLocaleString("es-ES")} / ${total.toLocaleString("es-ES")} bytes)`;
}

function ensureWebSerial() {
  if (!("serial" in navigator)) {
    throw new Error("Este navegador no soporta Web Serial. Usa Chrome o Edge en HTTPS.");
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

  setStatus("Conectando en modo bootloader...");
  const chip = await loader.main();

  connected = true;
  window.connectedChipFamily = chip;
  window.detectedChipFamily = chip;
  window.espChipFamily = chip;
  window.espBackupConnect = connect;
  setStatus(`Conectado: ${chip}`);
  log(`Conectado a: ${chip}`);

  if (typeof loader.readFlash !== "function") {
    log("AVISO: esta versión cargada no expone readFlash(). Revisa la importación de esptool-js.");
  }
}

async function disconnect() {
  try {
    if (loader && connected) await loader.after("hard_reset");
  } catch (e) {
    log("No se pudo hacer reset al desconectar: " + e.message);
  }

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
  window.connectedChipFamily = "";
  window.detectedChipFamily = "";
  window.espChipFamily = "";

  setStatus("Sin conectar");
  log("Desconectado.");
}

async function requireConnection() {
  if (!connected || !loader) await connect();
}

async function backupFlash() {
  await requireConnection();

  if (typeof loader.readFlash !== "function") {
    throw new Error("readFlash() no está disponible en la librería cargada. No se puede hacer backup con esta carga de esptool-js.");
  }

  const start = parseHexOrDec($("readAddr").value);
  const totalSize = parseHexOrDec($("flashSize").value);
  const chunkSize = parseHexOrDec($("chunkSize").value);

  const parts = [];
  let read = 0;

  log(`Iniciando backup desde 0x${start.toString(16)}. Tamaño: ${totalSize} bytes. Bloque: ${chunkSize} bytes.`);
  setProgress(0, totalSize);

  while (read < totalSize) {
    const currentSize = Math.min(chunkSize, totalSize - read);
    const address = start + read;

    log(`Leyendo 0x${address.toString(16)} - ${currentSize} bytes...`);

    const data = await loader.readFlash(
      address,
      currentSize,
      (_packet, progressBytes, totalBytes) => {
        setProgress(read + Math.min(progressBytes, totalBytes), totalSize);
      }
    );

    parts.push(data instanceof Uint8Array ? data : new Uint8Array(data));
    read += currentSize;

    setProgress(read, totalSize);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const blob = new Blob(parts, { type: "application/octet-stream" });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `esp32-backup-${totalSize / 1024 / 1024}MB-${timestamp}.bin`;

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
  await requireConnection();

  const file = $("binFile").files[0];
  if (!file) throw new Error("Selecciona primero un archivo .bin para restaurar.");

  const address = parseHexOrDec($("writeAddr").value);
  const eraseAll = $("eraseBefore").checked;
  const data = new Uint8Array(await file.arrayBuffer());

  log(`Restaurando ${file.name} (${data.length} bytes) en 0x${address.toString(16)}.`);

  const options = {
    fileArray: [{ data, address }],
    flashSize: "keep",
    flashMode: "keep",
    flashFreq: "keep",
    eraseAll,
    compress: true,
    reportProgress: (_fileIndex, written, total) => setProgress(written, total),
  };

  await loader.writeFlash(options);

  log("Restauración completada.");
  await loader.after("hard_reset");
}

async function eraseFlash() {
  await requireConnection();

  const ok = confirm("Vas a borrar la Flash completa de la ESP32. ¿Continuar?");
  if (!ok) return;

  log("Borrando Flash completa...");

  if (typeof loader.eraseFlash === "function") {
    await loader.eraseFlash();
  } else if (typeof loader.erase_flash === "function") {
    await loader.erase_flash();
  } else {
    throw new Error("La versión cargada de esptool-js no expone eraseFlash(). Puedes restaurar un .bin usando la opción 'Borrar antes de restaurar'.");
  }

  log("Flash borrada.");
}

async function resetDevice() {
  if (!loader) return;

  await loader.after("hard_reset");
  log("Reset enviado.");
}

function bind(id, fn) {
  const el = $(id);

  if (!el) {
    console.warn(`No existe el elemento #${id}`);
    return;
  }

  el.addEventListener("click", async () => {
    try {
      el.disabled = true;
      await fn();
    } catch (e) {
      console.error(e);
      log("ERROR: " + (e?.message || e));
      setStatus("Error. Revisa la consola.");
    } finally {
      el.disabled = false;
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

window.addEventListener("beforeunload", () => {
  try {
    if (port) port.close();
  } catch (_) {}
});

log("Ardutaller ESP32 Backup Tool cargado.");
log("Conecta la placa por USB y pulsa 'Conectar ESP32'. Si no entra en bootloader, mantén BOOT/OK mientras conectas o al pulsar conectar.");
