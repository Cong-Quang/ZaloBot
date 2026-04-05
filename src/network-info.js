import os from 'node:os';
import { execSync } from 'node:child_process';

export function isWSL() {
  return Boolean(process.env.WSL_DISTRO_NAME) || os.release().toLowerCase().includes('microsoft');
}

export function getIPv4Addresses() {
  const nets = os.networkInterfaces();
  const rows = [];
  for (const [name, list] of Object.entries(nets)) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) {
        rows.push({ name, address: item.address, scope: 'local' });
      }
    }
  }
  return rows;
}

export function getWindowsIPv4Addresses() {
  if (!isWSL()) return [];
  try {
    const out = execSync(
      `powershell.exe -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254*' } | Select-Object -ExpandProperty IPAddress"`,
      { stdio: ['ignore', 'pipe', 'ignore'] },
    ).toString();

    return out
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((address) => ({ name: 'windows', address, scope: 'windows' }));
  } catch {
    return [];
  }
}

export function buildAccessUrls(host, port) {
  const urls = [];
  if (host === '0.0.0.0') {
    urls.push(`http://127.0.0.1:${port}/`);
    urls.push(`http://127.0.0.1:${port}/login`);
    urls.push(`http://localhost:${port}/`);
    urls.push(`http://localhost:${port}/login`);
    for (const row of [...getIPv4Addresses(), ...getWindowsIPv4Addresses()]) {
      urls.push(`http://${row.address}:${port}/`);
      urls.push(`http://${row.address}:${port}/login`);
    }
  } else {
    urls.push(`http://${host}:${port}/`);
    urls.push(`http://${host}:${port}/login`);
  }
  return [...new Set(urls)];
}
