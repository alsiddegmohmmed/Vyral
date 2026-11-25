import { one } from '@/lib/db/client';

export const runtime = 'nodejs';

// Public (Apple/Google and customers' phones fetch card images). Served only as the
// validated raster type, never sniffed, never as HTML, immutable by id.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 });
  const img = await one<{ mime: string; bytes: Buffer }>('select mime, bytes from images where id = $1', [id]);
  if (!img) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(img.bytes), {
    headers: {
      'Content-Type': img.mime, 'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': 'inline',
    },
  });
}
