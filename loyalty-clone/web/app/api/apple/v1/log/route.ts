// Error logs from devices. https://developer.apple.com/documentation/walletpasses/log-a-message
// POST body LogEntries { logs: [string] } → 200. Only the count is logged: entries can contain
// serial numbers and URLs, and the endpoint is unauthenticated.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { logs?: unknown } | null;
  const count = Array.isArray(body?.logs) ? body.logs.length : 0;
  console.info(`[apple-wallet] device log: ${count} entr${count === 1 ? 'y' : 'ies'}`);
  return new Response(null, { status: 200 });
}
