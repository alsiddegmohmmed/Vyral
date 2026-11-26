import { NextResponse } from 'next/server';
import { one } from '@/lib/db/client';
import { DataError, rateLimit } from '@/lib/data/api';
import { type ImageKind } from '@/lib/image-check';
import { attachCardImage } from '@/lib/data/card-images';
import { requireOwner } from '@/lib/session';

export const runtime = 'nodejs';
const COLUMN: Record<ImageKind, string> = { logo: 'logo_image_id', icon: 'icon_image_id', stamp: 'stamp_image_id' };

/** Owner uploads a card image; stored and attached to the card in one statement. kind+campaignId in the form. */
export async function POST(req: Request) {
  const ctx = await requireOwner();
  try { await rateLimit(`upload:${ctx.orgId}`, 30, 600); } catch (e) { return NextResponse.json({ error: (e as DataError).message }, { status: 429 }); }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const kind = String(form?.get('kind') ?? '') as ImageKind;
  const campaignId = String(form?.get('campaignId') ?? '');
  if (!(file instanceof File) || !(kind in COLUMN) || !/^[0-9a-f-]{36}$/.test(campaignId)) return NextResponse.json({ error: 'Choose an image to upload.' }, { status: 400 });
  const r = await attachCardImage(ctx, campaignId, kind, new Uint8Array(await file.arrayBuffer()));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ id: r.id, url: `/api/images/${r.id}`, width: r.width, height: r.height });
}

/** Remove an image from a card (the image row stays for passes already issued; cleanup can purge it). */
export async function DELETE(req: Request) {
  const ctx = await requireOwner();
  const { kind, campaignId } = (await req.json().catch(() => ({}))) as { kind?: ImageKind; campaignId?: string };
  if (!kind || !(kind in COLUMN) || !/^[0-9a-f-]{36}$/.test(campaignId ?? '')) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  await one(`update campaigns set ${COLUMN[kind]} = null, design_version = design_version + 1 where id = $1 and org_id = $2 returning id`, [campaignId, ctx.orgId]);
  return NextResponse.json({ ok: true });
}
