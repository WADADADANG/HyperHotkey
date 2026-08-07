import { currentLang } from '../i18n.js';

export function toast(msg, type = 'success') {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => { t.classList.add('show'); }); });
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3000);
}

export function addLog(type, key, detail) {
  const now = new Date();
  const t = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
  const list = document.getElementById('log-list');
  if (!list) return;
  const el = document.createElement('div');
  el.className = `log-item ${type}`;
  el.innerHTML = `<span class="log-time">${t}</span><span class="log-type ${type}">${type}</span><span class="log-key">${key}</span><span class="log-detail">${detail}</span>`;
  list.insertBefore(el, list.firstChild);
  while (list.children.length > 60) list.removeChild(list.lastChild);
}

export function clearLogs() {
  const list = document.getElementById('log-list');
  if (list) list.innerHTML = '';
}

let keyTimer;
export function flashKey(key) {
  const el = document.getElementById('key-flash');
  if (!el) return;
  el.textContent = 'KEY: ' + key;
  el.classList.add('active');
  clearTimeout(keyTimer);
  keyTimer = setTimeout(() => el.classList.remove('active'), 500);
}

export function updateSuspendButtonUI(isSuspended) {
  const btn = document.getElementById('gui-suspend-btn');
  if (!btn) return;
  if (isSuspended) {
    btn.textContent = currentLang === 'en' ? '🟢 Resume Bot' : '🟢 ทำงานต่อ';
    btn.style.borderColor = '#10b981';
    btn.style.color = '#10b981';
    btn.style.background = 'rgba(16,185,129,0.07)';
  } else {
    btn.textContent = currentLang === 'en' ? '🔴 Pause Bot' : '🔴 หยุดออโต้ทั้งหมด';
    btn.style.borderColor = '#ef4444';
    btn.style.color = '#ef4444';
    btn.style.background = 'rgba(239,68,68,0.07)';
  }
}

export async function toggleSuspendState() {
  try {
    const res = await fetch('/api/suspend/toggle', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      updateSuspendButtonUI(data.isSuspended);
      toast(
        data.isSuspended
          ? (currentLang === 'en' ? '⏸️ Auto-actions paused!' : '⏸️ หยุดการทำงานออโต้ทั้งหมดชั่วคราวแล้ว!')
          : (currentLang === 'en' ? '▶️ Auto-actions resumed!' : '▶️ ออโต้ทั้งหมดทำงานต่อตามปกติแล้ว!'),
        'info'
      );
    }
  } catch (err) {
    console.error("Failed to toggle suspend state:", err);
  }
}

export function setup3D() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas || typeof window.THREE === 'undefined') return;
  const card = canvas.parentElement;
  canvas.width = card.clientWidth;
  canvas.height = card.clientHeight;
  const THREE = window.THREE;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040a);
  const cam = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 100);
  cam.position.z = 7;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.width, canvas.height);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  const geo = new THREE.TorusKnotGeometry(1.4, 0.44, 120, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: .1, metalness: .8 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  scene.add(new THREE.AmbientLight(0xffffff, .4));
  const dl = new THREE.DirectionalLight(0xffffff, .8); dl.position.set(5, 5, 5); scene.add(dl);
  const pl = new THREE.PointLight(0x10b981, 1, 50); pl.position.set(-5, -3, 3); scene.add(pl);
  let targetScale = 1, speedMult = 1, frames = 0, last = performance.now();
  const colors = [0x6366f1, 0x10b981, 0xf59e0b, 0xef4444, 0x3b82f6, 0x8b5cf6, 0xec4899];
  function animate() {
    requestAnimationFrame(animate);
    mesh.rotation.x += .01 * speedMult;
    mesh.rotation.y += .014 * speedMult;
    mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), .1);
    renderer.render(scene, cam);
    frames++;
    const now = performance.now();
    if (now - last >= 1000) {
      const fpsCount = document.getElementById('fps-count');
      if (fpsCount) fpsCount.textContent = Math.round(frames * 1000 / (now - last));
      frames = 0; last = now;
    }
  }
  animate();
  window.trigger3D = key => {
    targetScale = 1.35; setTimeout(() => targetScale = 1, 150);
    const c = colors[Math.floor(Math.random() * colors.length)];
    mat.color.setHex(c);
    const colorEl = document.getElementById('obj-color');
    if (colorEl) {
      colorEl.textContent = '#' + c.toString(16).padStart(6, '0');
      colorEl.style.color = colorEl.textContent;
    }
    speedMult = isNaN(key) ? 2 : 1 + parseInt(key) * .15;
    const speedEl = document.getElementById('obj-speed');
    if (speedEl) speedEl.textContent = speedMult.toFixed(2) + 'x';
  };
  window.addEventListener('resize', () => {
    canvas.width = card.clientWidth;
    canvas.height = card.clientHeight;
    cam.aspect = canvas.width / canvas.height;
    cam.updateProjectionMatrix();
    renderer.setSize(canvas.width, canvas.height);
  });
}
