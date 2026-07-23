// Registers the "@/" path-alias resolver hook (ts-alias-hooks.mjs) so
// bare-node scripts can import shared app modules. Use via:
//   node --import ./scripts/register-alias.mjs scripts/<name>.ts

import { register } from 'node:module';

register('./ts-alias-hooks.mjs', import.meta.url);
