<?php
require_once __DIR__ . '/db.php';

// ── Credentials ───────────────────────────────────────────────────────────────
define('REDEEM_USER', 'kgstaff');
define('REDEEM_PASS', 'KGStaff@2025');
define('AUTH_TOKEN',  hash('sha256', REDEEM_USER . REDEEM_PASS . 'kg_salt_2025'));

// ── Ensure redeemed_at column exists ─────────────────────────────────────────
try { db()->exec("ALTER TABLE kg_entries ADD COLUMN redeemed_at DATETIME DEFAULT NULL"); }
catch (PDOException $e) {}

// ── Login / Logout ────────────────────────────────────────────────────────────
if (isset($_GET['logout'])) {
    setcookie('kg_auth', '', time() - 3600, '/');
    header('Location: redeem.php'); exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['username'])) {
    if ($_POST['username'] === REDEEM_USER && $_POST['password'] === REDEEM_PASS) {
        setcookie('kg_auth', AUTH_TOKEN, time() + 86400 * 7, '/', '', false, true);
        header('Location: redeem.php'); exit;
    } else {
        $loginError = 'Incorrect username or password.';
    }
}

$authed = ($_COOKIE['kg_auth'] ?? '') === AUTH_TOKEN
       || ($_POST['_token'] ?? '') === AUTH_TOKEN;
if (!$authed) { showLogin($loginError ?? null); exit; }

// ── AJAX handlers ─────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    header('Content-Type: application/json');
    // Accept token via POST field (cookie may not be sent with fetch on some hosts)
    $tokenOk = ($_POST['_token'] ?? '') === AUTH_TOKEN || ($_COOKIE['kg_auth'] ?? '') === AUTH_TOKEN;
    if (!$tokenOk) { echo json_encode(['status'=>'error','msg'=>'Not authenticated']); exit; }
    $action = $_POST['action'];

    // Lookup by coupon code
    if ($action === 'lookup') {
        $coupon = strtoupper(trim($_POST['coupon'] ?? ''));
        if (!$coupon) { echo json_encode(['status' => 'error', 'msg' => 'Enter a coupon code']); exit; }
        $stmt = db()->prepare('SELECT * FROM kg_entries WHERE coupon_code = ? LIMIT 1');
        $stmt->execute([$coupon]);
        $row = $stmt->fetch();
        if (!$row) { echo json_encode(['status' => 'not_found', 'msg' => 'Coupon not found']); exit; }
        if ($row['redeemed_at']) {
            echo json_encode(['status' => 'already_redeemed', 'msg' => 'Already redeemed on ' . date('d M Y, h:i A', strtotime($row['redeemed_at'])), 'entry' => $row]);
            exit;
        }
        echo json_encode(['status' => 'valid', 'entry' => $row]); exit;
    }

    // Mark as redeemed
    if ($action === 'redeem') {
        $coupon = strtoupper(trim($_POST['coupon'] ?? ''));
        if (!$coupon) { echo json_encode(['status' => 'error', 'msg' => 'No coupon']); exit; }
        $stmt = db()->prepare('SELECT id, redeemed_at FROM kg_entries WHERE coupon_code = ? LIMIT 1');
        $stmt->execute([$coupon]);
        $row = $stmt->fetch();
        if (!$row) { echo json_encode(['status' => 'error', 'msg' => 'Coupon not found']); exit; }
        if ($row['redeemed_at']) { echo json_encode(['status' => 'error', 'msg' => 'Already redeemed']); exit; }
        db()->prepare('UPDATE kg_entries SET redeemed_at = NOW() WHERE id = ?')->execute([$row['id']]);
        echo json_encode(['status' => 'success', 'msg' => 'Redeemed successfully!']); exit;
    }

    // Retrieve by mobile
    if ($action === 'retrieve') {
        $mobile = preg_replace('/\D/', '', trim($_POST['mobile'] ?? ''));
        if (strlen($mobile) < 10) { echo json_encode(['status' => 'error', 'msg' => 'Enter a valid 10-digit mobile number']); exit; }
        $stmt = db()->prepare('SELECT * FROM kg_entries WHERE mobile = ? LIMIT 1');
        $stmt->execute([$mobile]);
        $row = $stmt->fetch();
        if (!$row) { echo json_encode(['status' => 'not_found', 'msg' => 'No entry found for this mobile number']); exit; }
        if (!$row['has_spun']) { echo json_encode(['status' => 'not_spun', 'msg' => 'This person has registered but not yet spun the wheel', 'entry' => $row]); exit; }
        echo json_encode(['status' => 'found', 'entry' => $row]); exit;
    }

    // Reports data
    if ($action === 'reports') {
        $filter = $_POST['filter'] ?? 'all';
        $sql = 'SELECT id, first_name, last_name, mobile, email, prize, coupon_code, has_spun, created_at, redeemed_at FROM kg_entries';
        if ($filter === 'redeemed')  $sql .= ' WHERE redeemed_at IS NOT NULL';
        if ($filter === 'pending')   $sql .= ' WHERE has_spun = 1 AND redeemed_at IS NULL';
        $sql .= ' ORDER BY created_at DESC';
        $rows = db()->query($sql)->fetchAll();
        $counts = db()->query('SELECT
            COUNT(*) as total,
            SUM(has_spun) as spun,
            SUM(redeemed_at IS NOT NULL) as redeemed,
            SUM(has_spun = 1 AND redeemed_at IS NULL) as pending
          FROM kg_entries')->fetch();
        echo json_encode(['status' => 'ok', 'rows' => $rows, 'total' => count($rows), 'counts' => $counts]); exit;
    }

    // Staff spin on behalf
    if ($action === 'staff_spin') {
        $entry_id = intval($_POST['entry_id'] ?? 0);
        if (!$entry_id) { echo json_encode(['success'=>false,'message'=>'Invalid entry']); exit; }

        $slices = [
            "Access Bars Healing 15% Off", "Sound Healing 15% Off",
            "Vaastu Consultancy 50% Off",  "Access Bars Healing 25% Off",
            "Numerology 25% Off",          "Vaastu Consultancy 25% Off",
            "Tarot Card Reading 25% Off",  "Access Body Process 15% Off",
            "Access Bars Healing 50% Off", "Sound Healing 25% Off",
            "Access Body Process 25% Off", "Tarot Card Reading 50% Off",
            "Numerology 15% Off",          "Tarot Card Reading 15% Off",
            "Vaastu Consultancy 25% Off",  "Numerology 50% Off",
        ];
        $prize = $slices[array_rand($slices)];

        $stmt = db()->prepare('SELECT * FROM kg_entries WHERE id = ? LIMIT 1');
        $stmt->execute([$entry_id]);
        $entry = $stmt->fetch();
        if (!$entry) { echo json_encode(['success'=>false,'message'=>'Entry not found']); exit; }
        if ($entry['has_spun']) { echo json_encode(['success'=>false,'message'=>'Already spun']); exit; }

        $coupon = 'KG-' . strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 8));
        db()->prepare('UPDATE kg_entries SET prize=?, coupon_code=?, has_spun=1 WHERE id=?')
            ->execute([$prize, $coupon, $entry_id]);

        // Send email
        require_once __DIR__ . '/config.php';
        require_once __DIR__ . '/lib/PHPMailer/Exception.php';
        require_once __DIR__ . '/lib/PHPMailer/PHPMailer.php';
        require_once __DIR__ . '/lib/PHPMailer/SMTP.php';
        $emailSent = false;
        try {
            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();
            $mail->Host = SMTP_HOST; $mail->SMTPAuth = true;
            $mail->Username = SMTP_USER; $mail->Password = SMTP_PASS;
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = SMTP_PORT;
            $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
            $mail->addReplyTo(SMTP_REPLY_TO, SMTP_FROM_NAME);
            $mail->addAddress($entry['email'], $entry['first_name'] . ' ' . $entry['last_name']);
            $mail->addCC('umesh@kaivalyaguru.com', 'Kaivalya Guru');
            $qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=1565C0&data=' . urlencode($coupon);
            $n = htmlspecialchars($entry['first_name']);
            $p = htmlspecialchars($prize); $c = htmlspecialchars($coupon);
            $mail->isHTML(true);
            $mail->Subject = 'Congratulations from Kaivalya Guru! Your Exclusive Offer Awaits 🎉';
            $mail->Body = "<div style='font-family:Arial,sans-serif;text-align:center;padding:32px'>
              <img src='https://webmydrive.com/kaivalyaguru/assets/logo.png' width='120'><br><br>
              <h2 style='color:#2E7D32'>🎉 Congratulations, {$n}!</h2>
              <p>You have won: <strong>{$p}</strong></p>
              <div style='background:linear-gradient(135deg,#1565C0,#1976d2);border-radius:10px;padding:20px;color:#fff;margin:20px auto;max-width:300px'>
                <div style='font-size:.75rem;letter-spacing:2px;text-transform:uppercase;opacity:.85'>Your Coupon Code</div>
                <div style='font-size:2rem;font-weight:900;letter-spacing:4px;margin-top:6px'>{$c}</div>
              </div>
              <img src='{$qrUrl}' width='160' height='160' style='border:4px solid #e8edf5;border-radius:8px'><br>
              <p style='color:#666;font-size:.85rem;margin-top:16px'>Present this coupon at our office to redeem your offer.<br>Valid for one-time use only.</p>
              <p style='color:#888;font-size:.8rem'>Kaivalya Guru &mdash; umesh@kaivalyaguru.com</p>
            </div>";
            $mail->AltBody = "Congratulations {$entry['first_name']}! You won: {$prize}\nCoupon: {$coupon}";
            $mail->send(); $emailSent = true;
        } catch (\Exception $e) { error_log('KG staff-spin email: ' . $e->getMessage()); }

        echo json_encode(['success'=>true, 'prize'=>$prize, 'coupon'=>$coupon, 'email_sent'=>$emailSent]);
        exit;
    }

    echo json_encode(['status' => 'error', 'msg' => 'Unknown action']); exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kaivalya Guru — Staff Portal</title>
  <link rel="stylesheet" href="assets/style.css">
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <style>
    /* ── Layout ── */
    .portal-wrap { width:100%; max-width:520px; }

    /* ── Dashboard buttons ── */
    .dash-btns { display:flex; flex-direction:column; gap:14px; margin-top:8px; }
    .dash-btn { display:flex; align-items:center; gap:14px; padding:18px 20px;
      background:#fff; border:2px solid #e0e8f5; border-radius:14px;
      box-shadow:0 2px 10px rgba(21,101,192,.07); cursor:pointer;
      text-align:left; width:100%; transition:.18s; }
    .dash-btn:hover { border-color:var(--blue); box-shadow:0 4px 16px rgba(21,101,192,.14); }
    .dash-btn .icon { font-size:1.8rem; width:44px; text-align:center; }
    .dash-btn .label { font-size:1.05rem; font-weight:700; color:#1a2340; }
    .dash-btn .sub   { font-size:.8rem; color:#888; margin-top:2px; }

    /* ── Section cards ── */
    .section-card { background:#fff; border-radius:14px; box-shadow:0 8px 32px rgba(21,101,192,.1); padding:24px 20px; }
    .section-title { display:flex; align-items:center; gap:10px; margin-bottom:20px; }
    .section-title h2 { font-size:1.2rem; color:var(--blue); margin:0; }
    .back-btn { background:none; border:none; font-size:1.1rem; cursor:pointer; padding:4px 8px; color:#888; }

    /* ── Redeem tabs ── */
    .tab-btns { display:flex; gap:8px; margin-bottom:18px; }
    .tab-btn { flex:1; padding:9px; border:2px solid var(--blue); border-radius:8px;
      background:#fff; color:var(--blue); font-weight:700; cursor:pointer; font-size:.88rem; transition:.18s; }
    .tab-btn.active { background:var(--blue); color:#fff; }
    .tab-pane { display:none; } .tab-pane.active { display:block; }
    #reader { width:100%; border-radius:10px; overflow:hidden; margin-bottom:12px; }

    .result-box { border-radius:10px; padding:18px; margin-top:14px; display:none; }
    .result-box.valid  { background:#f0fdf4; border:2px solid var(--green); }
    .result-box.invalid{ background:#fef2f2; border:2px solid var(--red); }
    .result-box.used   { background:#fffbeb; border:2px solid #f59e0b; }
    .result-name  { font-size:1.15rem; font-weight:700; margin-bottom:4px; }
    .result-prize { color:var(--blue); font-weight:600; margin-bottom:10px; }
    .result-meta  { font-size:.82rem; color:#666; }
    .btn-redeem { width:100%; padding:12px; background:var(--green); color:#fff; border:none;
      border-radius:8px; font-size:1rem; font-weight:700; cursor:pointer; margin-top:14px; }
    .btn-redeem:disabled { background:#90a4ae; cursor:not-allowed; }
    .input-row { display:flex; gap:8px; }
    .input-row input { flex:1; padding:11px 14px; border:1.5px solid #d0d7e3; border-radius:8px;
      font-size:.95rem; outline:none; }
    .input-row input:focus { border-color:var(--blue); }
    .input-row button { padding:11px 20px; background:var(--blue); color:#fff; border:none;
      border-radius:8px; font-weight:700; cursor:pointer; white-space:nowrap; }

    /* ── Reports ── */
    .filter-btns { display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap; }
    .filter-btn { padding:7px 14px; border:1.5px solid #d0d7e3; border-radius:20px;
      background:#fff; font-size:.82rem; font-weight:600; cursor:pointer; color:#555; transition:.18s; }
    .filter-btn.active { background:var(--blue); color:#fff; border-color:var(--blue); }
    .report-count { font-size:.82rem; color:#888; margin-bottom:12px; }
    .entry-card { background:#f8faff; border:1.5px solid #e0e8f5; border-radius:10px;
      padding:14px 16px; margin-bottom:10px; }
    .entry-card.redeemed { border-color:#bbf7d0; background:#f0fdf4; }
    .entry-card.pending  { border-color:#fde68a; background:#fffbeb; }
    .entry-name  { font-weight:700; font-size:1rem; margin-bottom:4px; }
    .entry-prize { color:var(--blue); font-size:.88rem; font-weight:600; margin-bottom:6px; }
    .entry-detail{ font-size:.78rem; color:#666; line-height:1.7; }
    .badge { display:inline-block; padding:2px 10px; border-radius:12px; font-size:.72rem;
      font-weight:700; margin-left:6px; }
    .badge.green { background:#dcfce7; color:#166534; }
    .badge.yellow{ background:#fef9c3; color:#92400e; }
    .badge.gray  { background:#f1f5f9; color:#64748b; }
    #report-list { max-height:60vh; overflow-y:auto; padding-right:2px; }

    /* ── Retrieve ── */
    .retrieve-result { margin-top:16px; }
    .coupon-display { background:linear-gradient(135deg,var(--blue),#1976d2); border-radius:10px;
      padding:18px; color:#fff; text-align:center; margin:14px 0; }
    .coupon-display .coup-label { font-size:.75rem; letter-spacing:2px; opacity:.85; text-transform:uppercase; }
    .coupon-display .coup-code  { font-size:1.8rem; font-weight:900; letter-spacing:4px; margin-top:4px; }
    #retrieve-qr { margin:10px auto 0; display:flex; justify-content:center; }

    /* ── Misc ── */
    .logout-row { text-align:right; margin-top:10px; }
    .logout-row a { font-size:.8rem; color:#aaa; }
  </style>
</head>
<body>

<div class="kg-header">
  <img src="assets/logo.png" alt="Kaivalya Guru">
  <p class="tagline">Harmonize Space &middot; Heal Life &middot; Design Destiny</p>
</div>

<div class="portal-wrap">

  <!-- ── Dashboard ── -->
  <div id="view-dash">
    <div class="section-card">
      <p style="color:#555;margin-bottom:16px;font-size:.92rem">Welcome, Staff. What would you like to do?</p>
      <div class="dash-btns">
        <button class="dash-btn" onclick="showView('redeem')">
          <span class="icon">🔍</span>
          <div><div class="label">Redeem Now</div><div class="sub">Scan QR or enter coupon code</div></div>
        </button>
        <button class="dash-btn" onclick="showView('reports'); loadReports('all')">
          <span class="icon">📊</span>
          <div><div class="label">Reports</div><div class="sub">View all entries, redeemed &amp; pending</div></div>
        </button>
        <button class="dash-btn" onclick="showView('retrieve')">
          <span class="icon">🔎</span>
          <div><div class="label">Retrieve Coupon</div><div class="sub">Look up by mobile number</div></div>
        </button>
      </div>
    </div>
    <div class="logout-row"><a href="?logout=1">Staff logout</a></div>
  </div>

  <!-- ── Redeem ── -->
  <div id="view-redeem" style="display:none">
    <div class="section-card">
      <div class="section-title">
        <button class="back-btn" onclick="showView('dash')">← Back</button>
        <h2>🔍 Redeem Coupon</h2>
      </div>

      <div class="tab-btns">
        <button class="tab-btn active" onclick="switchTab('scan')">📷 Scan QR</button>
        <button class="tab-btn" onclick="switchTab('manual')">⌨️ Enter Code</button>
      </div>

      <div class="tab-pane active" id="tab-scan">
        <div id="reader"></div>
        <p style="font-size:.8rem;color:#888;text-align:center">Point camera at the customer's QR code</p>
      </div>

      <div class="tab-pane" id="tab-manual">
        <div class="input-row">
          <input type="text" id="manual-input" placeholder="e.g. KG-73M4EDN8" maxlength="12"
                 oninput="this.value=this.value.toUpperCase()"
                 onkeydown="if(event.key==='Enter') lookupCoupon(this.value.trim())">
          <button onclick="lookupCoupon(document.getElementById('manual-input').value.trim())">Search</button>
        </div>
      </div>

      <div class="result-box" id="result-box"></div>
    </div>
  </div>

  <!-- ── Reports ── -->
  <div id="view-reports" style="display:none">
    <div class="section-card">
      <div class="section-title">
        <button class="back-btn" onclick="showView('dash')">← Back</button>
        <h2>📊 Reports</h2>
      </div>

      <!-- Stats cards -->
      <div id="stats-cards" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px"></div>

      <!-- Filter + Export row -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <div class="filter-btns" style="flex:1;margin-bottom:0">
          <button class="filter-btn active" id="fbtn-all"      onclick="loadReports('all')">All</button>
          <button class="filter-btn"        id="fbtn-redeemed" onclick="loadReports('redeemed')">✅ Redeemed</button>
          <button class="filter-btn"        id="fbtn-pending"  onclick="loadReports('pending')">⏳ Pending</button>
        </div>
        <button onclick="exportCSV()"
          style="padding:7px 14px;background:#1565C0;color:#fff;border:none;border-radius:8px;
                 font-size:.82rem;font-weight:700;cursor:pointer;white-space:nowrap">⬇ CSV</button>
      </div>

      <!-- Search -->
      <input type="search" id="report-search" placeholder="🔍 Search name, mobile, email, coupon…"
        oninput="filterCards()"
        style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d0d7e3;
               border-radius:8px;font-size:.88rem;margin-bottom:10px;outline:none">

      <div class="report-count" id="report-count"></div>
      <div id="report-list"><p style="color:#aaa;text-align:center;padding:20px">Loading…</p></div>
    </div>
  </div>

  <!-- ── Retrieve Coupon ── -->
  <div id="view-retrieve" style="display:none">
    <div class="section-card">
      <div class="section-title">
        <button class="back-btn" onclick="showView('dash')">← Back</button>
        <h2>🔎 Retrieve Coupon</h2>
      </div>

      <div class="input-row">
        <input type="tel" id="mobile-input" placeholder="Enter 10-digit mobile number" maxlength="10"
               onkeydown="if(event.key==='Enter') retrieveCoupon()">
        <button onclick="retrieveCoupon()">Search</button>
      </div>

      <div class="retrieve-result" id="retrieve-result"></div>
    </div>
  </div>

</div><!-- /.portal-wrap -->

<script>
const AUTH_TOKEN = <?= json_encode(AUTH_TOKEN) ?>;

// ── View switching ────────────────────────────────────────────────────────────
function showView(v) {
  ['dash','redeem','reports','retrieve'].forEach(id => {
    document.getElementById('view-' + id).style.display = (id === v) ? 'block' : 'none';
  });
  if (v !== 'redeem' && scanner) { scanner.stop().catch(()=>{}); scanner = null; }
  if (v === 'redeem') { setTimeout(() => switchTab('scan'), 100); }
}

// ── QR Scanner ────────────────────────────────────────────────────────────────
let scanner = null;
let activeCoupon = null;

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b,i) =>
    b.classList.toggle('active', (i===0&&tab==='scan')||(i===1&&tab==='manual')));
  document.getElementById('tab-scan').classList.toggle('active', tab === 'scan');
  document.getElementById('tab-manual').classList.toggle('active', tab === 'manual');

  if (tab === 'scan' && !scanner) {
    scanner = new Html5Qrcode('reader');
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (code) => { scanner.stop().catch(()=>{}); scanner = null; lookupCoupon(code); }
    ).catch(() => {
      document.getElementById('reader').innerHTML =
        '<p style="color:var(--red);padding:16px;text-align:center">Camera access denied. Use manual entry.</p>';
    });
  } else if (tab === 'manual' && scanner) {
    scanner.stop().catch(()=>{}); scanner = null;
  }
}

// ── Coupon Lookup / Redeem ────────────────────────────────────────────────────
async function postAction(payload) {
  const fd = new FormData();
  fd.append('_token', AUTH_TOKEN);
  Object.entries(payload).forEach(([k,v]) => fd.append(k, v));
  const res = await fetch('redeem.php', { method:'POST', body:fd });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e) {
    // Server returned HTML (session expired or PHP error)
    if (text.includes('Staff Login')) return { status:'error', msg:'Session expired. Please <a href="redeem.php">log in again</a>.' };
    return { status:'error', msg:'Server error. Please try again.' };
  }
}

async function lookupCoupon(coupon) {
  if (!coupon) return;
  activeCoupon = coupon;
  const box = document.getElementById('result-box');
  box.className = 'result-box valid';
  box.style.display = 'block';
  box.innerHTML = '<p style="color:#888;text-align:center;padding:8px">Looking up…</p>';

  const data = await postAction({ action:'lookup', coupon });

  if (data.status === 'valid') {
    const e = data.entry;
    box.className = 'result-box valid';
    box.innerHTML = `
      <div class="result-name">${e.first_name} ${e.last_name}</div>
      <div class="result-prize">🎁 ${e.prize}</div>
      <div class="result-meta">📱 ${e.mobile} &nbsp;|&nbsp; 📧 ${e.email}<br>Registered: ${e.created_at}</div>
      <button class="btn-redeem" id="btn-redeem" onclick="redeemCoupon()">✅ Mark as Redeemed</button>`;
  } else if (data.status === 'already_redeemed') {
    const e = data.entry;
    box.className = 'result-box used';
    box.innerHTML = `<div class="result-name">⚠️ Already Redeemed</div>
      <div class="result-prize">${e.prize}</div>
      <div class="result-meta">${data.msg}</div>`;
  } else {
    box.className = 'result-box invalid';
    box.innerHTML = `<div class="result-name">❌ ${data.msg}</div>`;
  }
}

async function redeemCoupon() {
  const btn = document.getElementById('btn-redeem');
  if (btn) btn.disabled = true;
  const data = await postAction({ action:'redeem', coupon:activeCoupon });
  const box  = document.getElementById('result-box');
  if (data.status === 'success') {
    box.className = 'result-box valid';
    box.innerHTML = `<div class="result-name" style="color:var(--green)">✅ Redeemed Successfully!</div>
      <div class="result-meta">Coupon: ${activeCoupon}</div>`;
  } else {
    if (btn) btn.disabled = false;
    box.innerHTML += `<p style="color:var(--red);font-size:.85rem;margin-top:8px">${data.msg}</p>`;
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────
let reportData = [];

async function loadReports(filter) {
  ['all','redeemed','pending'].forEach(f =>
    document.getElementById('fbtn-' + f).classList.toggle('active', f === filter));
  document.getElementById('report-search').value = '';
  document.getElementById('report-count').textContent = 'Loading…';
  document.getElementById('report-list').innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">Loading…</p>';

  const data = await postAction({ action:'reports', filter });

  if (data.counts) {
    const c = data.counts;
    document.getElementById('stats-cards').innerHTML = [
      ['📋', 'Registered', c.total,    '#1565C0'],
      ['🎡', 'Spun',       c.spun,     '#7B1FA2'],
      ['✅', 'Redeemed',   c.redeemed, '#2E7D32'],
      ['⏳', 'Pending',    c.pending,  '#E65100'],
    ].map(([icon, label, val, color]) => `
      <div style="background:#f8faff;border:1.5px solid #e0e8f5;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:1.3rem">${icon}</div>
        <div style="font-size:1.6rem;font-weight:900;color:${color};line-height:1.2">${val ?? 0}</div>
        <div style="font-size:.72rem;color:#888;margin-top:2px">${label}</div>
      </div>`).join('');
  }

  reportData = data.rows || [];
  renderCards(reportData);
}

function renderCards(rows) {
  document.getElementById('report-count').textContent = `${rows.length} record${rows.length !== 1 ? 's' : ''}`;
  if (rows.length === 0) {
    document.getElementById('report-list').innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">No records found.</p>';
    return;
  }
  document.getElementById('report-list').innerHTML = rows.map(e => {
    const isRedeemed = !!e.redeemed_at;
    const hasSpun    = !!parseInt(e.has_spun);
    const cardClass  = isRedeemed ? 'redeemed' : (hasSpun ? 'pending' : '');
    const badge      = isRedeemed
      ? '<span class="badge green">✅ Redeemed</span>'
      : (hasSpun ? '<span class="badge yellow">⏳ Pending</span>' : '<span class="badge gray">📋 Not Spun</span>');
    const prizeLine   = hasSpun ? `<div class="entry-prize">🎁 ${e.prize || '—'}</div>` : '';
    const couponLine  = e.coupon_code ? `Coupon: <strong>${e.coupon_code}</strong><br>` : '';
    const redeemedLine= isRedeemed ? `<br>Redeemed: ${e.redeemed_at}` : '';
    return `<div class="entry-card ${cardClass}">
      <div class="entry-name">${e.first_name} ${e.last_name} ${badge}</div>
      ${prizeLine}
      <div class="entry-detail">
        📱 ${e.mobile} &nbsp;|&nbsp; 📧 ${e.email}<br>
        ${couponLine}Registered: ${e.created_at}${redeemedLine}
      </div>
    </div>`;
  }).join('');
}

function filterCards() {
  const q = document.getElementById('report-search').value.toLowerCase().trim();
  renderCards(!q ? reportData : reportData.filter(e =>
    [e.first_name, e.last_name, e.mobile, e.email, e.coupon_code, e.prize]
      .some(v => (v || '').toLowerCase().includes(q))
  ));
}

function exportCSV() {
  if (!reportData.length) return;
  const headers = ['Name','Mobile','Email','Prize','Coupon','Registered','Redeemed At','Status'];
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = reportData.map(e => [
    `${e.first_name} ${e.last_name}`, e.mobile, e.email,
    e.prize || '', e.coupon_code || '', e.created_at, e.redeemed_at || '',
    e.redeemed_at ? 'Redeemed' : (parseInt(e.has_spun) ? 'Pending' : 'Not Spun')
  ].map(esc).join(','));
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `kg-entries-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ── Retrieve Coupon by Mobile ─────────────────────────────────────────────────
async function retrieveCoupon() {
  const mobile = document.getElementById('mobile-input').value.trim().replace(/\D/g,'');
  const div    = document.getElementById('retrieve-result');
  div.innerHTML = '<p style="color:#888;text-align:center;padding:12px">Searching…</p>';

  const data = await postAction({ action:'retrieve', mobile });

  if (data.status === 'error' || data.status === 'not_found') {
    div.innerHTML = `<div class="result-box invalid" style="display:block"><div class="result-name">❌ ${data.msg}</div></div>`;
    return;
  }
  if (data.status === 'not_spun') {
    const e = data.entry;
    div.innerHTML = `<div class="result-box used" style="display:block">
      <div class="result-name">⏳ Not yet spun</div>
      <div class="result-prize">${e.first_name} ${e.last_name}</div>
      <div class="result-meta">📱 ${e.mobile} &nbsp;|&nbsp; 📧 ${e.email}<br>Registered: ${e.created_at}</div>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <a href="spin.php?id=${e.id}" target="_blank"
           style="flex:1;padding:11px;background:#1565C0;color:#fff;border:none;border-radius:8px;
                  font-weight:700;text-align:center;text-decoration:none;font-size:.92rem">
          🎡 Let Them Spin
        </a>
        <button onclick="staffSpin(${e.id}, '${e.first_name} ${e.last_name}')"
           style="flex:1;padding:11px;background:#2E7D32;color:#fff;border:none;border-radius:8px;
                  font-weight:700;cursor:pointer;font-size:.92rem">
          🎲 Spin on Their Behalf
        </button>
      </div>
    </div>`;
    return;
  }

  const e = data.entry;
  const isRedeemed = !!e.redeemed_at;
  div.innerHTML = `
    <div class="result-box valid" style="display:block">
      <div class="result-name">${e.first_name} ${e.last_name}</div>
      <div class="result-prize">🎁 ${e.prize}</div>
      <div class="result-meta">📱 ${e.mobile} &nbsp;|&nbsp; 📧 ${e.email}<br>
        Status: ${isRedeemed ? '✅ Redeemed on ' + e.redeemed_at : '⏳ Not yet redeemed'}
      </div>
    </div>
    <div class="coupon-display">
      <div class="coup-label">Coupon Code</div>
      <div class="coup-code">${e.coupon_code}</div>
    </div>
    <div id="retrieve-qr"></div>`;

  // Generate QR
  new QRCode(document.getElementById('retrieve-qr'), {
    text: e.coupon_code, width: 160, height: 160,
    colorDark: '#1565C0', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

async function staffSpin(entryId, name) {
  if (!confirm(`Spin on behalf of ${name}?\n\nA random prize will be assigned and emailed to them. This cannot be undone.`)) return;
  const div = document.getElementById('retrieve-result');
  div.innerHTML = '<p style="color:#888;text-align:center;padding:12px">Spinning…</p>';

  const data = await postAction({ action:'staff_spin', entry_id: entryId });

  if (data.success) {
    div.innerHTML = `
      <div class="result-box valid" style="display:block">
        <div class="result-name" style="color:var(--green)">🎉 Spun Successfully!</div>
        <div class="result-prize">🎁 ${data.prize}</div>
        <div class="result-meta">${data.email_sent ? '📧 Email sent to customer.' : '⚠️ Prize saved but email failed.'}</div>
      </div>
      <div class="coupon-display">
        <div class="coup-label">Coupon Code</div>
        <div class="coup-code">${data.coupon}</div>
      </div>
      <div id="retrieve-qr"></div>`;
    new QRCode(document.getElementById('retrieve-qr'), {
      text: data.coupon, width: 160, height: 160,
      colorDark: '#1565C0', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    div.innerHTML = `<div class="result-box invalid" style="display:block">
      <div class="result-name">❌ ${data.message || data.msg || 'Something went wrong'}</div>
    </div>`;
  }
}
</script>

</body>
</html>
<?php

function showLogin(?string $error): void { ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kaivalya Guru — Staff Login</title>
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="kg-header">
  <img src="assets/logo.png" alt="Kaivalya Guru">
  <p class="tagline">Harmonize Space &middot; Heal Life &middot; Design Destiny</p>
</div>
<div class="kg-card">
  <h2 style="color:var(--blue);margin-bottom:20px;font-size:1.3rem">🔐 Staff Login</h2>
  <?php if ($error): ?>
    <div class="kg-alert error visible"><?= htmlspecialchars($error) ?></div>
  <?php endif; ?>
  <form method="POST">
    <div class="form-group">
      <label>Username</label>
      <input type="text" name="username" placeholder="Enter username" autofocus autocomplete="username">
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" name="password" placeholder="Enter password" autocomplete="current-password">
    </div>
    <button type="submit" class="btn-primary" style="margin-top:8px">Login</button>
  </form>
</div>
</body>
</html>
<?php }
