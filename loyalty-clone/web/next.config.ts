import path from 'node:path';
import type { NextConfig } from 'next';

// The clone lives inside the Vyral site repo for now. Root = loyalty-clone/, so
// the app can import the design tokens from ../replica/design and Next doesn't
// treat the site repo above as its workspace.
const root = path.join(__dirname, '..');

const config: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default config;
