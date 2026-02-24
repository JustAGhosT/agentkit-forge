/**
 * AgentKit Forge — Init Command
 * Creates a repo-specific overlay from __TEMPLATE__ and runs sync.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'fs';
import { resolve, basename } from 'path';
import yaml from 'js-yaml';

export async function runInit({ agentkitRoot, projectRoot, flags }) {
  const repoName = flags.repoName || basename(projectRoot);
  const force = flags.force || false;

  console.log(`[agentkit:init] Initializing for repo: ${repoName}`);

  // 1. Check if overlay already exists
  const overlayDir = resolve(agentkitRoot, 'overlays', repoName);
  if (existsSync(overlayDir) && !force) {
    throw new Error(
      `Overlay already exists at ${overlayDir}. Use --force to overwrite.`
    );
  }

  // 2. Copy __TEMPLATE__ overlay
  const templateDir = resolve(agentkitRoot, 'overlays', '__TEMPLATE__');
  if (!existsSync(templateDir)) {
    throw new Error(`Template overlay not found at ${templateDir}`);
  }

  console.log(`[agentkit:init] Copying overlay template...`);
  mkdirSync(overlayDir, { recursive: true });
  cpSync(templateDir, overlayDir, { recursive: true, force: true });

  // 3. Update repoName in settings.yaml
  const settingsPath = resolve(overlayDir, 'settings.yaml');
  if (existsSync(settingsPath)) {
    let settingsContent = readFileSync(settingsPath, 'utf-8');
    const settings = yaml.load(settingsContent);
    settings.repoName = repoName;
    writeFileSync(settingsPath, yaml.dump(settings, { lineWidth: 120 }), 'utf-8');
    console.log(`[agentkit:init] Updated overlay settings for: ${repoName}`);
  }

  // 4. Create .agentkit-repo marker file
  const markerPath = resolve(projectRoot, '.agentkit-repo');
  writeFileSync(markerPath, repoName + '\n', 'utf-8');
  console.log(`[agentkit:init] Created .agentkit-repo marker`);

  // 5. Run sync
  console.log(`[agentkit:init] Running sync...`);
  const { runSync } = await import('./sync.mjs');
  await runSync({ agentkitRoot, projectRoot, flags: { overlay: repoName } });

  console.log(`[agentkit:init] Done! Repo initialized as: ${repoName}`);
}
