// Self-host the QR decoder WASM (architecture: no third-party CDN at the counter).
import fs from 'node:fs';
fs.mkdirSync('public/zxing', { recursive: true });
fs.copyFileSync('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', 'public/zxing/zxing_reader.wasm');
