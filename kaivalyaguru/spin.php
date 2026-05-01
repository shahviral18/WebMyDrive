<?php
session_start();
require_once __DIR__ . '/db.php';

$entry_id = intval($_GET['id'] ?? $_SESSION['kg_entry_id'] ?? 0);

if (!$entry_id) {
    header('Location: index.php');
    exit;
}

$stmt = db()->prepare('SELECT * FROM kg_entries WHERE id = ? LIMIT 1');
$stmt->execute([$entry_id]);
$entry = $stmt->fetch();

if (!$entry) {
    header('Location: index.php');
    exit;
}

if ($entry['has_spun']) {
    header('Location: index.php?alert=already');
    exit;
}

$first_name = htmlspecialchars($entry['first_name']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kaivalya Guru — Spin the Wheel!</title>
  <link rel="stylesheet" href="assets/style.css">
  <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js"></script>
</head>
<body>

<div class="kg-header">
  <img src="assets/logo.png" alt="Kaivalya Guru">
  <p class="tagline">Harmonize Space &middot; Heal Life &middot; Design Destiny</p>
</div>

<div class="spin-wrapper">
  <h2>Welcome, <?= $first_name ?>! 🎉</h2>
  <p class="sub">Tap the button to spin and claim your exclusive offer!</p>

  <div class="wheel-container" id="wheel-container">
    <div class="wheel-arrow"></div>
    <canvas id="wheel-canvas" width="340" height="340"></canvas>
  </div>

  <button class="btn-spin" id="spin-btn">SPIN!</button>
</div>

<!-- Result Modal -->
<div class="kg-modal-overlay" id="modal-overlay">
  <div class="kg-modal">
    <div class="confetti-emoji">🎉</div>
    <h2>Congratulations!</h2>
    <p class="prize-name">You have won:<br><strong id="modal-prize"></strong></p>
    <div class="coupon-box">
      <div class="coupon-label">Your Coupon Code</div>
      <div class="coupon-code" id="modal-coupon"></div>
    </div>
    <div id="modal-qr" style="margin:0 auto 14px;width:120px;height:120px;"></div>
    <p class="email-note">Details & QR code have been sent to your email.<br>Show this QR code at our office to redeem.</p>
    <button class="btn-close" id="btn-ok">OK, Got it!</button>
  </div>
</div>

<!-- Spin sound generated via Web Audio API — no external file needed -->

<script>
// ── Spin sound via Web Audio API ─────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let tickInterval = null;

function startSpinSound(durationMs) {
  if (!AudioCtx) return;
  audioCtx = new AudioCtx();

  // Ticking / ratchet effect — frequency speeds up then slows down
  let tickRate = 80;   // ms between ticks (fast start)
  const minRate = 40;

  function tick() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.05);
  }

  tick();
  tickInterval = setInterval(tick, tickRate);

  // Gradually slow the ticks to match wheel ease-out
  const slowStart = durationMs * 0.55;
  setTimeout(() => {
    clearInterval(tickInterval);
    tickRate = minRate;
    let elapsed = 0;
    function slowTick() {
      tick();
      elapsed += tickRate;
      tickRate = Math.min(tickRate * 1.08, 400);
      if (elapsed < durationMs * 0.45) {
        tickInterval = setTimeout(slowTick, tickRate);
      }
    }
    slowTick();
  }, slowStart);
}

function stopSpinSound() {
  clearInterval(tickInterval);
  clearTimeout(tickInterval);
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
}

// ── Wheel data ────────────────────────────────────────────────────────────────
// ⚠️  Replace these 16 entries with the actual service names once provided
const SLICES = [
  "Access Bars Healing 15% Off",
  "Sound Healing 15% Off",
  "Vaastu Consultancy 50% Off",
  "Access Bars Healing 25% Off",
  "Numerology 25% Off",
  "Vaastu Consultancy 25% Off",
  "Tarot Card Reading 25% Off",
  "Access Body Process 15% Off",
  "Access Bars Healing 50% Off",
  "Sound Healing 25% Off",
  "Access Body Process 25% Off",
  "Tarot Card Reading 50% Off",
  "Numerology 15% Off",
  "Tarot Card Reading 15% Off",
  "Vaastu Consultancy 25% Off",
  "Numerology 50% Off",
];

// Brand colors cycling through 4
const COLORS = ['#1565C0', '#C62828', '#2E7D32', '#F9A825'];
// Lighter shades for alternating text legibility
const TEXT_COLOR = '#ffffff';

const NUM = SLICES.length;       // 16
const ARC = (2 * Math.PI) / NUM; // 22.5°

// ── Canvas setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('wheel-canvas');
const ctx    = canvas.getContext('2d');
let CX, CY, R;

function resizeCanvas() {
  const size = Math.min(window.innerWidth - 48, 340);
  canvas.width  = size;
  canvas.height = size;
  CX = size / 2;
  CY = size / 2;
  R  = CX - 6;
  // Update container size to match
  const container = document.getElementById('wheel-container');
  container.style.width  = size + 'px';
  container.style.height = size + 'px';
}

resizeCanvas();

let currentAngle = 0;
let isSpinning   = false;

function drawWheel(rotation) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < NUM; i++) {
    const start = rotation + i * ARC;
    const end   = start + ARC;

    // Slice
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, start, end);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(start + ARC / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = TEXT_COLOR;
    const fontSize = Math.max(9, Math.floor(R / 16));
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur  = 3;

    const label = SLICES[i];
    // Wrap long labels
    const maxW = R - 20;
    if (ctx.measureText(label).width > maxW) {
      const words = label.split(' ');
      const mid   = Math.ceil(words.length / 2);
      const l1    = words.slice(0, mid).join(' ');
      const l2    = words.slice(mid).join(' ');
      ctx.fillText(l1, R - 10, -5);
      ctx.fillText(l2, R - 10,  9);
    } else {
      ctx.fillText(label, R - 10, 4);
    }
    ctx.restore();
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(CX, CY, 22, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center logo letter
  ctx.fillStyle = '#1565C0';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KG', CX, CY);
}

drawWheel(0);

// ── Spin logic ────────────────────────────────────────────────────────────────
function easeOut(t) {
  return 1 - Math.pow(1 - t, 4);  // quartic ease-out
}

function spin() {
  if (isSpinning) return;
  isSpinning = true;

  const btn = document.getElementById('spin-btn');
  btn.disabled = true;

  // Pick a random winning slice (0-15)
  const winningSlice = Math.floor(Math.random() * NUM);

  // Total rotation: 5-8 full spins + land in the middle of winning slice
  const targetOffset = -Math.PI / 2 - (winningSlice * ARC + ARC / 2);
  const extraSpins   = (5 + Math.floor(Math.random() * 4)) * 2 * Math.PI;
  const totalAngle   = extraSpins + ((targetOffset - currentAngle) % (2 * Math.PI));

  const duration   = 5000 + Math.random() * 1500;  // 5–6.5 s
  const startTime  = performance.now();
  const startAngle = currentAngle;

  // Sound is optional — wheel must spin even if audio fails
  try { startSpinSound(duration); } catch(e) {}

  function frame(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = easeOut(progress);

    currentAngle = startAngle + totalAngle * eased;
    drawWheel(currentAngle);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      try { stopSpinSound(); } catch(e) {}
      isSpinning = false;
      showResult(winningSlice);
    }
  }

  requestAnimationFrame(frame);
}

async function showResult(sliceIndex) {
  const prize = SLICES[sliceIndex];

  // Highlight the winning slice with a gold glow
  drawWheel(currentAngle);
  highlightSlice(sliceIndex);

  // Save to server
  let coupon = '—';
  try {
    const res  = await fetch('api/save-spin.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: <?= $entry_id ?>, prize }),
    });
    const data = await res.json();
    if (data.success && data.coupon) coupon = data.coupon;
  } catch(e) {}

  document.getElementById('modal-prize').textContent  = prize;
  document.getElementById('modal-coupon').textContent = coupon;

  // Generate QR code
  const qrEl = document.getElementById('modal-qr');
  qrEl.innerHTML = '';
  new QRCode(qrEl, {
    text: coupon,
    width: 120, height: 120,
    colorDark: '#1565C0', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });

  // OK button → redirect to thank-you page
  document.getElementById('btn-ok').onclick = () => {
    window.location.href = 'thankyou.php?prize=' + encodeURIComponent(prize) + '&coupon=' + encodeURIComponent(coupon);
  };

  setTimeout(() => {
    document.getElementById('modal-overlay').classList.add('open');
    // Confetti burst
    const colors = ['#1565C0','#C62828','#2E7D32','#F9A825'];
    const end = Date.now() + 2500;
    (function burst() {
      confetti({ particleCount: 6, angle: 60,  spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(burst);
    })();
  }, 600);
}

function highlightSlice(index) {
  const start = currentAngle + index * ARC;
  const end   = start + ARC;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CX, CY);
  ctx.arc(CX, CY, R, start, end);
  ctx.closePath();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth   = 5;
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur  = 18;
  ctx.stroke();
  ctx.restore();
}

document.getElementById('spin-btn').addEventListener('click', spin);

// Redraw on window resize (e.g. orientation change)
window.addEventListener('resize', () => { resizeCanvas(); drawWheel(currentAngle); });
</script>
</body>
</html>
