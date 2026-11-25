'use client';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { Button } from './button';

export function QRBlock({ value, label, size = 176 }: { value: string; label: string; size?: number }) {
  const [svg, setSvg] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', margin: 4, errorCorrectionLevel: 'M' }).then(setSvg);
  }, [value]);
  return (
    <figure className="flex flex-col items-center gap-3">
      <div role="img" aria-label={label} style={{ width: size, height: size }} className="rounded-md bg-white [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="max-w-full break-all text-center font-mono text-xs text-text-muted">{value}</figcaption>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={async () => { await navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          <Copy aria-hidden className="size-4" /> {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
          a.download = 'qr-code.svg';
          a.click();
        }}>
          <Download aria-hidden className="size-4" /> SVG
        </Button>
      </div>
    </figure>
  );
}
