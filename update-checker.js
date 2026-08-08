const https = require('https');
const pkg = require('./package.json');

const GITHUB_REPO_URL = 'https://github.com/WADADADANG/HyperHotkey';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/WADADADANG/HyperHotkey/main/package.json';

let cachedUpdateStatus = {
  hasUpdate: false,
  currentVersion: pkg.version || '2.2.1',
  latestVersion: pkg.version || '2.2.1',
  repoUrl: GITHUB_REPO_URL,
  checkedAt: null
};

function compareVersions(v1, v2) {
  const p1 = String(v1).split('.').map(Number);
  const p2 = String(v2).split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num2 > num1) return 1;  // v2 is newer
    if (num1 > num2) return -1; // v1 is newer
  }
  return 0;
}

function checkForUpdates(callback) {
  const req = https.get(GITHUB_RAW_URL, {
    headers: { 'User-Agent': 'HyperHotkey-Update-Checker' },
    timeout: 5000
  }, (res) => {
    if (res.statusCode !== 200) {
      if (callback) callback(cachedUpdateStatus);
      return;
    }
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const remotePkg = JSON.parse(data);
        const remoteVersion = remotePkg.version;
        const localVersion = pkg.version || '2.0.0';

        if (remoteVersion && compareVersions(localVersion, remoteVersion) === 1) {
          cachedUpdateStatus = {
            hasUpdate: true,
            currentVersion: localVersion,
            latestVersion: remoteVersion,
            repoUrl: GITHUB_REPO_URL,
            checkedAt: new Date().toISOString()
          };

          console.log('\n===============================================================');
          console.log(`🔔 [Update Alert] A new version is available on GitHub!`);
          console.log(`   Current: v${localVersion}  ➔  Latest: v${remoteVersion}`);
          console.log(`👉 Download update: ${GITHUB_REPO_URL}`);
          console.log('===============================================================\n');
        } else {
          cachedUpdateStatus = {
            hasUpdate: false,
            currentVersion: localVersion,
            latestVersion: remoteVersion || localVersion,
            repoUrl: GITHUB_REPO_URL,
            checkedAt: new Date().toISOString()
          };
        }
      } catch (e) {}
      if (callback) callback(cachedUpdateStatus);
    });
  });

  req.on('error', () => {
    if (callback) callback(cachedUpdateStatus);
  });
  req.on('timeout', () => {
    req.destroy();
    if (callback) callback(cachedUpdateStatus);
  });
}

function getUpdateStatus() {
  return cachedUpdateStatus;
}

module.exports = {
  checkForUpdates,
  getUpdateStatus
};
