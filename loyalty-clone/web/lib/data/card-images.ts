import 'server-only';
import { createHash } from 'node:crypto';
import { one } from '@/lib/db/client';
import { inspectImage, type ImageKind } from '@/lib/image-check';
import type { OrgContext } from './api';

const COLUMN: Record<ImageKind, string> = { logo: 'logo_image_id', icon: 'icon_image_id', stamp: 'stamp_image_id' };

/** Store an image and attach it to the org's card in one statement. Shared by /api/images and the new-card wizard. */
export async function attachCardImage(ctx: OrgContext, campaignId: string, kind: ImageKind, bytes: Uint8Array):
  Promise<{ ok: true; id: string; width: number; height: number } | { ok: false; status: number; error: string }> {
  if (bytes.length > 1024 * 1024) return { ok: false, status: 413, error: 'Images can be up to 1 MB. Try a smaller or compressed file.' };
  const chk = inspectImage(bytes, kind);
  if (!chk.ok) return { ok: false, status: 422, error: chk.error };
  const r = await one<{ id: string }>(
    `with i as (insert into images (org_id, kind, mime, bytes, width, height, sha256)
                select $1, $2, $3, $4, $5, $6, $7 where exists (select 1 from campaigns where id = $8 and org_id = $1) returning id),
          c as (update campaigns set ${COLUMN[kind]} = i.id, design_version = design_version + 1 from i where campaigns.id = $8 and campaigns.org_id = $1)
     select id from i`,
    [ctx.orgId, kind, chk.mime, Buffer.from(bytes), chk.width, chk.height, createHash('sha256').update(bytes).digest('hex'), campaignId]);
  if (!r) return { ok: false, status: 404, error: 'Card not found.' };
  return { ok: true, id: r.id, width: chk.width, height: chk.height };
}

/** A PNG data URL from the browser, as bytes (null if it isn't one). */
export function pngFromDataUrl(u: string | undefined): Uint8Array | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(u ?? '');
  return m ? new Uint8Array(Buffer.from(m[1], 'base64')) : null;
}
