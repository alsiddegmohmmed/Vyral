// Generates the CSS from tokens.json. Never edit the .css outputs by hand.
//   node replica/design/build-tokens.mjs
// Outputs (next to this file):
//   tokens.css          plain CSS custom properties (usable anywhere)
//   tailwind-theme.css  Tailwind v4 @theme mapping, so components write
//                       `bg-surface text-muted rounded-md`, never raw hex
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(fs.readFileSync(path.join(dir, 'tokens.json'), 'utf8'));
const pub = (o) => Object.entries(o).filter(([k]) => !k.startsWith('_'));
const header = '/* GENERATED from tokens.json by build-tokens.mjs. Do not edit. */\n';

const vars = [];
for (const [k, v] of pub(t.color)) vars.push(`  --tk-color-${k}: ${v};`);
for (const [k, v] of pub(t.font)) vars.push(`  --tk-font-${k}: ${v};`);
for (const [k, v] of pub(t.type)) {
  vars.push(`  --tk-text-${k}: ${v.size / 16}rem;`);
  vars.push(`  --tk-text-${k}--line-height: ${v.line / v.size};`);
  vars.push(`  --tk-text-${k}--font-weight: ${v.weight};`);
}
for (const [k, v] of pub(t.radius)) vars.push(`  --tk-radius-${k}: ${v}px;`);
for (const [k, v] of pub(t.shadow)) vars.push(`  --tk-shadow-${k}: ${v};`);
for (const [k, v] of pub(t.motion)) vars.push(`  --tk-motion-${k}: ${v};`);
for (const [k, v] of pub(t.layout)) if (typeof v === 'number') vars.push(`  --tk-layout-${k}: ${v}px;`);
for (const [k, v] of pub(t.z)) vars.push(`  --tk-z-${k}: ${v};`);

const tokensCss = `${header}:root {
${vars.join('\n')}
}

@media (prefers-reduced-motion: reduce) {
  :root { --tk-motion-fast: 0ms; --tk-motion-base: 0ms; --tk-motion-slow: 0ms; }
}
`;

// Tailwind v4: theme keys point at the raw --tk-* variables (inline), so a
// runtime override of --tk-color-* (e.g. merchant theming) flows through every
// utility, and no theme variable ever references itself.
const theme = [];
theme.push('  --color-*: initial;');
for (const [k] of pub(t.color)) theme.push(`  --color-${k}: var(--tk-color-${k});`);
theme.push('  --color-transparent: transparent;', '  --color-current: currentColor;', '  --color-white: #fff;', '  --color-black: #000;');
for (const [k] of pub(t.font)) theme.push(`  --font-${k}: var(--tk-font-${k});`);
for (const [k] of pub(t.type)) {
  theme.push(`  --text-${k}: var(--tk-text-${k});`);
  theme.push(`  --text-${k}--line-height: var(--tk-text-${k}--line-height);`);
  theme.push(`  --text-${k}--font-weight: var(--tk-text-${k}--font-weight);`);
}
theme.push('  --radius-*: initial;');
for (const [k] of pub(t.radius)) theme.push(`  --radius-${k}: var(--tk-radius-${k});`);
theme.push('  --shadow-*: initial;');
for (const [k] of pub(t.shadow)) theme.push(`  --shadow-${k}: var(--tk-shadow-${k});`);
theme.push(`  --spacing: 4px;`);
for (const [k, v] of pub(t.layout.breakpoints)) theme.push(`  --breakpoint-${k}: ${v / 16}rem;`);
theme.push(`  --ease-out: ${t.motion.ease};`);

const twCss = `${header}@theme inline {
${theme.join('\n')}
}
`;

fs.writeFileSync(path.join(dir, 'tokens.css'), tokensCss);
fs.writeFileSync(path.join(dir, 'tailwind-theme.css'), twCss);
console.log(`tokens.css: ${vars.length} vars, tailwind-theme.css: ${theme.length} entries`);
