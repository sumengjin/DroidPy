import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { DEFAULT_FILES } from '../src/data/defaultFiles';
import { generateGitHubApkProjectZip } from '../src/services/androidApkBuilder';

async function main() {
  const rootDir = process.cwd();
  const androidDir = path.join(rootDir, 'android');

  if (fs.existsSync(path.join(androidDir, 'settings.gradle.kts'))) {
    console.log('android/settings.gradle.kts 已存在，略過重新產生。');
    return;
  }

  console.log('正在產生 DroidPy Android Gradle 專案與內嵌 Termux 橋接程式...');
  const blob = await generateGitHubApkProjectZip({
    appTitle: 'DroidPy',
    packageId: 'org.droidpy.app',
    includeStoragePermission: true,
    files: DEFAULT_FILES,
    bridgeToken: 'droidpy-local',
  });

  const buffer = Buffer.from(await blob.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);

  let count = 0;
  for (const [relativePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!relativePath.startsWith('android/')) continue;

    const targetPath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const content = await entry.async('nodebuffer');
    fs.writeFileSync(targetPath, content);
    count += 1;
  }

  const distDir = path.join(rootDir, 'dist');
  const wwwDir = path.join(androidDir, 'app', 'src', 'main', 'assets', 'www');
  if (fs.existsSync(distDir)) {
    fs.rmSync(wwwDir, { recursive: true, force: true });
    fs.mkdirSync(wwwDir, { recursive: true });
    fs.cpSync(distDir, wwwDir, { recursive: true, force: true });
    console.log('已將 dist/ 離線網頁資源同步至 android/app/src/main/assets/www/');
  }

  console.log(`完成！已產出 ${count} 個 Android 專案檔案至 ./android`);
}

main().catch((err) => {
  console.error('產生 Android 專案失敗:', err);
  process.exit(1);
});
