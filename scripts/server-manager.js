#!/usr/bin/env node
/**
 * 서버 관리 - Go API (8080) + Next.js (3000)
 * 프로젝트 루트에서: node scripts/server-manager.js
 * 또는 start-servers.bat / stop.bat
 */

const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

const PORTS = { go: 8080, next: 3000 };
const WEB_URL_HTTP = 'http://localhost:3000';
const WEB_URL_HTTPS = 'https://localhost:3000';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

/** 5초 후 화면 정리(cls) 후 URL 열고, 콜백(보통 showMenu) 실행. useHttps면 https://localhost:3000 */
function openBrowser(thenShowMenu, useHttps) {
  const url = useHttps ? WEB_URL_HTTPS : WEB_URL_HTTP;
  const delayMs = 5000;
  console.log('  ' + delayMs / 1000 + '초 후 화면 정리 후 브라우저를 엽니다...');
  setTimeout(() => {
    process.stdout.write('\x1B[2J\x1B[H');
    if (isWin) {
      spawn(`cmd /c start "" "${url}"`, [], { shell: true, stdio: 'ignore' });
    } else {
      const open = process.platform === 'darwin' ? 'open' : 'xdg-open';
      spawn(open, [url], { stdio: 'ignore' }).on('error', () => {});
    }
    if (typeof thenShowMenu === 'function') thenShowMenu();
  }, delayMs);
}

function showMenu() {
  console.log('');
  console.log('  ═══════════════════════════════════════');
  console.log('    양돈농장 관리 - 서버 관리');
  console.log('  ═══════════════════════════════════════');
  console.log('    1. 시작 (HTTP)');
  console.log('    2. 시작 (HTTPS)');
  console.log('    3. 종료');
  console.log('  ═══════════════════════════════════════');
  console.log('    Go API :8080  |  Next :3000');
  console.log('  ═══════════════════════════════════════');
  rl.question('  선택 (1~3): ', (answer) => {
    const n = answer.trim();
    if (n === '1') startBackground(false);
    else if (n === '2') startBackground(true);
    else if (n === '3') stopAll().then(() => showMenu());
    else {
      console.log('  1~3 중 입력하세요.');
      showMenu();
    }
  });
}

function startInWindows(useHttps) {
  if (!isWin) {
    console.log('  창에서 실행은 Windows만 지원합니다. 1 또는 2번(백그라운드)을 사용하세요.');
    startBackground(!!useHttps);
    return;
  }
  console.log('\n  [서버를 새 창에서 시작합니다...' + (useHttps ? ' (HTTPS)' : '') + ']\n');
  const backendPath = path.join(ROOT, 'backend');
  const frontendPath = path.join(ROOT, 'frontend');

  const esc = (p) => p.replace(/"/g, '""');
  if (fs.existsSync(path.join(backendPath, 'go.mod'))) {
    spawn(`cmd /c start "Go API :8080" cmd /k cd /d "${esc(backendPath)}" && set PORT=8080 && go run ./cmd/api`, [], { shell: true, stdio: 'ignore' });
    console.log('  Go API  → http://localhost:8080 (창 열림, go run)');
  }
  if (fs.existsSync(path.join(frontendPath, 'package.json'))) {
    const devCmd = useHttps ? 'npm run dev:https' : 'npm run dev -- -p 3000';
    spawn(`cmd /c start "Next.js :3000" cmd /k cd /d "${esc(frontendPath)}" && ${devCmd}`, [], { shell: true, stdio: 'ignore' });
    console.log('  Next.js → ' + (useHttps ? 'https' : 'http') + '://localhost:3000 (창 열림)');
  }
  console.log('\n  접속: ' + (useHttps ? WEB_URL_HTTPS : WEB_URL_HTTP) + '  |  종료: 3번 실행\n');
  openBrowser(showMenu, useHttps);
}

function startBackground(useHttps) {
  console.log('\n  [서버 시작 중...' + (useHttps ? ' (HTTPS)' : '') + ']\n');
  const backendDir = path.join(ROOT, 'backend');
  const frontendDir = path.join(ROOT, 'frontend');
  if (fs.existsSync(path.join(backendDir, 'go.mod'))) {
    const go = spawn('go run ./cmd/api', [], {
      cwd: backendDir,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PORT: String(PORTS.go) },
      shell: true,
      windowsHide: true,
    });
    go.unref();
    console.log('  Go API  → http://localhost:' + PORTS.go + ' (go run)');
  }
  if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
    const devScript = useHttps ? 'dev:https' : 'dev';
    const next = spawn('npm run ' + devScript, [], {
      cwd: frontendDir,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
      shell: true,
      windowsHide: true,
    });
    next.unref();
    console.log('  Next.js → ' + (useHttps ? 'https' : 'http') + '://localhost:' + PORTS.next);
  }
  console.log('\n  종료: 3번 실행 또는 stop.bat\n');
  openBrowser(showMenu, useHttps);
}

function startBackendOnly() {
  const backendPath = path.join(ROOT, 'backend');
  if (!fs.existsSync(path.join(backendPath, 'go.mod'))) {
    console.log('  backend/go.mod 없음.');
    showMenu();
    return;
  }
  const esc = (p) => p.replace(/"/g, '""');
  console.log('\n  [Backend만 시작...]\n');
  if (isWin) {
    spawn(`cmd /c start "Go API :8080" cmd /k cd /d "${esc(backendPath)}" && set PORT=8080 && go run ./cmd/api`, [], { shell: true, stdio: 'ignore' });
    console.log('  Go API → http://localhost:8080 (창 열림, go run)\n');
  } else {
    const go = spawn('go run ./cmd/api', [], {
      cwd: backendPath,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PORT: String(PORTS.go) },
      shell: true,
    });
    go.unref();
    console.log('  Go API → http://localhost:8080 (go run)\n');
  }
  showMenu();
}

function startFrontendOnly() {
  const frontendPath = path.join(ROOT, 'frontend');
  if (!fs.existsSync(path.join(frontendPath, 'package.json'))) {
    console.log('  frontend/package.json 없음.');
    showMenu();
    return;
  }
  const esc = (p) => p.replace(/"/g, '""');
  console.log('\n  [Frontend만 시작...]\n');
  if (isWin) {
    spawn(`cmd /c start "Next.js :3000" cmd /k cd /d "${esc(frontendPath)}" && npm run dev -- -p 3000`, [], { shell: true, stdio: 'ignore' });
    console.log('  Next.js → http://localhost:3000 (창 열림)\n');
  } else {
    const next = spawn('npm run dev', [], {
      cwd: frontendPath,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
      shell: true,
    });
    next.unref();
    console.log('  Next.js → http://localhost:3000\n');
  }
  showMenu();
}

function getPidsOnPort(port) {
  return new Promise((resolve) => {
    const cmd = isWin ? 'netstat' : 'netstat';
    const args = isWin ? ['-ano'] : ['-tlnp'];
    const proc = spawn(cmd, args, { windowsHide: true });
    let out = '';
    proc.stdout.on('data', (c) => { out += c.toString(); });
    proc.stderr.on('data', () => {});
    proc.on('close', () => {
      const pids = new Set();
      if (isWin) {
        const lines = out.split(/\r?\n/);
        for (const line of lines) {
          if (line.includes(':' + port) && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const last = parts[parts.length - 1];
            if (/^\d+$/.test(last)) pids.add(last);
          }
        }
      } else {
        const re = new RegExp(`:${port}\\s+.*?LISTEN\\s+(\\d+)`, 'g');
        let m;
        while ((m = re.exec(out)) !== null) pids.add(m[1].trim());
      }
      resolve([...pids]);
    });
  });
}

function killPid(pid) {
  return new Promise((resolve) => {
    const cmd = isWin ? 'taskkill' : 'kill';
    const args = isWin ? ['/PID', pid, '/F'] : [pid];
    const proc = spawn(cmd, args, { stdio: 'ignore', windowsHide: true });
    proc.on('close', (code) => resolve(code === 0));
  });
}

async function stopPort(port) {
  const pids = await getPidsOnPort(port);
  if (pids.length === 0) {
    console.log('  포트 ' + port + ': 실행 중 없음');
  } else {
    for (const pid of pids) {
      await killPid(pid);
      console.log('  포트 ' + port + ' 종료 (PID ' + pid + ')');
    }
  }
}

async function stopAll() {
  console.log('\n  [전체 서버 종료 중...]\n');
  await stopPort(PORTS.go);
  await stopPort(PORTS.next);
  console.log('\n  완료.\n');
}

const arg = process.argv[2] && process.argv[2].toLowerCase();
if (arg === 'start' || arg === 'start-window') {
  if (isWin) startInWindows(false);
  else startBackground(false);
} else if (arg === 'start-https') {
  if (isWin) startInWindows(true);
  else startBackground(true);
} else if (arg === 'go-next') {
  if (isWin) startInWindows(false);
  else startBackground(false);
} else if (arg === 'stop') {
  stopAll().then(() => process.exit(0));
} else {
  showMenu();
}
