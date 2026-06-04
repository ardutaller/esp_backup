# Ardutaller ESP32 Backup Tool

Web estática para GitHub Pages basada en `esptool-js` y Web Serial.

## Funciones

- Conectar ESP32/ED1 desde Chrome o Edge.
- Leer la Flash completa y descargar un `.bin`.
- Restaurar un `.bin` desde dirección `0x000000`.
- Borrar Flash completa, si la API disponible lo permite.
- Consola de estado.

## Uso en GitHub Pages

1. Crea un repositorio, por ejemplo `esp32-backup`.
2. Sube estos archivos a la raíz:
   - `index.html`
   - `style.css`
   - `app.js`
   - `README.md`
3. Activa GitHub Pages en `Settings > Pages`.
4. Abre la web desde Chrome o Edge.

## ED1 / ESP32-PICO-D4

Para ED1 se ha dejado por defecto una lectura de 4 MB:

```bash
esptool.py --chip esp32 read_flash 0x000000 0x400000 backup.bin
```

En la web equivale a:

- Dirección inicial: `0x000000`
- Tamaño Flash: `4 MB`

## Notas

- Web Serial necesita HTTPS. GitHub Pages lo cumple.
- Safari y Firefox no soportan Web Serial de forma estándar.
- Si falla la lectura, baja el baudrate o usa bloque de lectura de 4 KB.
- Usa la herramienta solo con placas propias o con autorización.
