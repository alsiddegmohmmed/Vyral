import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { one } from '@/lib/db/client';
import { DataError, rateLimit } from '@/lib/data/api';
import { inspectImage, type ImageKind } from '@/lib/image-check';
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
  if (file.size > 1024 * 1024) return NextResponse.json({ error: 'Images can be up to 1 MB. Try a smaller or compressed file.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chk = inspectImage(bytes, kind);
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: 422 });
  const r = await one<{ id: string }>(
    `with i as (insert into images (org_id, kind, mime, bytes, width, height, sha256)
                select $1, $2, $3, $4, $5, $6, $7 where exists (select 1 from campaigns where id = $8 and org_id = $1) returning id),
          c as (update campaigns set ${COLUMN[kind]} = i.id, design_version = design_version + 1 from i where campaigns.id = $8 and campaigns.org_id = $1)
     select id from i`,
    [ctx.orgId, kind, chk.mime, Buffer.from(bytes), chk.width, chk.height, createHash('sha256').update(bytes).digest('hex'), campaignId]);
  if (!r) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });
  return NextResponse.json({ id: r.id, url: `/api/images/${r.id}`, width: chk.width, height: chk.height });
}

/** Remove an image from a card (the image row stays for passes already issued; cleanup can purge it). */
export async function DELETE(req: Request) {
  const ctx = await requireOwner();
  const { kind, campaignId } = (await req.json().catch(() => ({}))) as { kind?: ImageKind; campaignId?: string };
  if (!kind || !(kind in COLUMN) || !/^[0-9a-f-]{36}$/.test(campaignId ?? '')) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  await one(`update campaigns set ${COLUMN[kind]} = null, design_version = design_version + 1 where id = $1 and org_id = $2 returning id`, [campaignId, ctx.orgId]);
  return NextResponse.json({ ok: true });
}
