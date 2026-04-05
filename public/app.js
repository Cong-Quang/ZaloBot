async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function niceStatusClass(value) {
  if (value === 'connected' || value === true) return 'ok';
  if (value === 'connecting' || value === 'booting' || value === 'waiting') return 'warn';
  if (value === 'error' || value === 'declined' || value === 'expired' || value === false) return 'err';
  return '';
}

// Zalo Actions
async function logoutZalo() {
  if (!confirm('Bạn có chắc muốn đăng xuất Zalo? Session sẽ bị xóa và bạn cần quét lại QR.')) return;
  try {
    await api('/api/zalo/logout', { method: 'POST' });
    alert('Đã đăng xuất Zalo. Đang tải lại trạng thái...');
    location.reload();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

async function reloginZalo() {
  if (!confirm('Bạn có chắc muốn đăng nhập lại Zalo?')) return;
  try {
    await api('/api/zalo/relogin', { method: 'POST' });
    alert('Đang thực hiện đăng nhập lại...');
    location.reload();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

async function logoutAdmin() {
  try {
    await api('/api/logout', { method: 'POST' });
    location.href = '/login';
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

// UI Helpers
function updateNavActive() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('href') === path) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

async function updateStatusBanner() {
  try {
    const data = await api('/api/health');
    const banner = document.getElementById('zaloStatusBanner');
    if (banner) {
      const isConnected = data.zalo.connected;
      const accountName = data.zalo.account?.displayName ? ` (${data.zalo.account.displayName})` : '';
      banner.className = `badge ${isConnected ? 'ok' : 'err'}`;
      banner.textContent = isConnected ? `Zalo Connected${accountName}` : 'Zalo Disconnected';
    }
  } catch (err) {
    console.error('Failed to update status banner', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateNavActive();
  updateStatusBanner();
  setInterval(updateStatusBanner, 10000);

  const btnLogoutZalo = document.getElementById('btnLogoutZalo');
  if (btnLogoutZalo) btnLogoutZalo.onclick = logoutZalo;

  const btnReloginZalo = document.getElementById('btnReloginZalo');
  if (btnReloginZalo) btnReloginZalo.onclick = reloginZalo;

  const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');
  if (btnLogoutAdmin) btnLogoutAdmin.onclick = logoutAdmin;
});
