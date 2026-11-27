// "Reward first": the one card layout, shared by the web card, the designer and wizard
// previews, and the Apple and Google passes (replica/design: card layouts, option B).
// Top to bottom: name and visits to go · the reward as the headline · the stamps ·
// stamp count · QR code with the typed code under it.
// Pure: no imports, so node --test, the server and client components can all load it.

/** Stamps on the strip: one row up to 10, then two or three even rows. */
export function stripColumns(total: number): number {
  const n = Math.max(1, Math.floor(total));
  const rows = n <= 10 ? 1 : n <= 20 ? 2 : 3;
  return Math.ceil(n / rows);
}

/** Apple shows roughly this many characters of the big reward text before cutting it off. */
export const REWARD_FITS = 20;

export type RewardState = {
  rewardName: string;
  rewardsAvailable: number;
  currentStamps: number;
  totalStamps: number;
  /** mystery box cards: prizes won and not yet handed over */
  mystery?: { boxes: { name: string; opened: boolean }[] };
};

/**
 * The headline: what the customer is working towards, or what is ready now.
 * `kind` says which notification applies when the value changes to it.
 */
export function rewardHeadline(d: RewardState): { label: string; value: string; kind: 'progress' | 'ready' | 'box_waiting' | 'box_opened' } {
  const name = d.rewardName.trim() || 'Your reward';
  if (d.mystery) {
    const waiting = d.mystery.boxes.filter((b) => !b.opened).length;
    const won = d.mystery.boxes.filter((b) => b.opened).map((b) => b.name);
    if (waiting) return { label: 'Mystery box', value: waiting > 1 ? `${waiting} boxes ready to open` : 'Ready to open', kind: 'box_waiting' };
    if (won.length) return { label: 'You won', value: won.join(', '), kind: 'box_opened' };
    return { label: 'Your reward', value: 'Mystery box', kind: 'progress' };
  }
  // the value itself changes when a reward becomes ready, so Apple notifies exactly then
  if (d.rewardsAvailable > 1) return { label: 'Rewards ready', value: `${d.rewardsAvailable} × ${name}`, kind: 'ready' };
  if (d.rewardsAvailable === 1) return { label: 'Reward ready', value: `${name} ready`, kind: 'ready' };
  return { label: 'Your reward', value: name, kind: 'progress' };
}

/** "4 visits" to the next reward (one stamp per visit is the common case). */
export function toGo(d: Pick<RewardState, 'currentStamps' | 'totalStamps'>): { label: string; value: string } {
  const left = Math.max(0, d.totalStamps - d.currentStamps);
  return { label: 'To go', value: left === 0 ? 'Ready' : `${left} ${left === 1 ? 'visit' : 'visits'}` };
}

export const stampCount = (d: Pick<RewardState, 'currentStamps' | 'totalStamps'>) => `${d.currentStamps}/${d.totalStamps}`;
