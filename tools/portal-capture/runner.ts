import fs from 'fs';
import path from 'path';
import { config } from './capture.config';

// Import flows
import { run as run01 } from './flows/01-brief';
import { run as run02 } from './flows/02-roster';
import { run as run03 } from './flows/03-assets';
import { run as run04 } from './flows/04-recap';
import { run as run05 } from './flows/05-calendar';

const flows: Record<string, () => Promise<void>> = {
  '01-brief': run01,
  '02-roster': run02,
  '03-assets': run03,
  '04-recap': run04,
  '05-calendar': run05,
};

const metadata: Record<string, any> = {
  '01-brief': { beat: '02', duration: '26s', frames: 26 * 30 },
  '02-roster': { beat: '03', duration: '32s', frames: 32 * 30 },
  '03-assets': { beat: '04', duration: '26s', frames: 26 * 30 },
  '04-recap': { beat: '07', duration: '32s', frames: 32 * 30 },
  '05-calendar': { beat: '08', duration: '26s', frames: 26 * 30 },
};

async function main() {
  const args = process.argv.slice(2);
  const targetFlow = args[0];

  if (!fs.existsSync(config.outDir)) {
    fs.mkdirSync(config.outDir, { recursive: true });
  }

  const manifestPath = path.join(config.outDir, 'manifest.json');
  let manifest: any = { captures: [] };
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {}
  }

  const runFlow = async (name: string) => {
    if (flows[name]) {
      await flows[name]();
      
      // Update manifest
      const existingIdx = manifest.captures.findIndex((c: any) => c.flow === name);
      const entry = {
        flow: name,
        beat: metadata[name].beat,
        duration: metadata[name].duration,
        frameCount: metadata[name].frames,
        timestamp: new Date().toISOString(),
        baseUrl: config.baseUrl,
      };
      
      if (existingIdx >= 0) {
        manifest.captures[existingIdx] = entry;
      } else {
        manifest.captures.push(entry);
      }
      
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    } else {
      console.error(`Unknown flow: ${name}`);
    }
  };

  if (targetFlow === 'all' || !targetFlow) {
    for (const name of Object.keys(flows)) {
      await runFlow(name);
    }
  } else {
    await runFlow(targetFlow);
  }
}

main().catch(console.error);
