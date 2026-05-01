<?php
session_start();
// If they already registered and haven't spun yet, forward them
if (!empty($_SESSION['kg_entry_id'])) {
    header('Location: spin.php');
    exit;
}
$alert = $_GET['alert'] ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kaivalya Guru — Register & Spin!</title>
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>

<div class="kg-header">
  <img src="assets/logo.png" alt="Kaivalya Guru">
  <p class="tagline">Harmonize Space &middot; Heal Life &middot; Design Destiny</p>
</div>

<div class="kg-card">

  <?php if ($alert === 'already'): ?>
  <div class="kg-alert error visible">You have already participated. Each visitor may spin once.</div>
  <?php endif; ?>

  <div class="kg-alert" id="form-alert"></div>

  <form id="reg-form" novalidate>

    <div class="form-group name-row">
      <div style="flex:1">
        <label for="first_name">First Name <span style="color:var(--red)">*</span></label>
        <input type="text" id="first_name" name="first_name" placeholder="Rahul" autocomplete="given-name">
        <div class="field-error" id="err-first_name">Required</div>
      </div>
      <div style="flex:1">
        <label for="last_name">Last Name <span style="color:var(--red)">*</span></label>
        <input type="text" id="last_name" name="last_name" placeholder="Sharma" autocomplete="family-name">
        <div class="field-error" id="err-last_name">Required</div>
      </div>
    </div>

    <div class="form-group">
      <label for="email">Email ID <span style="color:var(--red)">*</span></label>
      <input type="email" id="email" name="email" placeholder="you@example.com" autocomplete="email">
      <div class="field-error" id="err-email">Enter a valid email</div>
    </div>

    <div class="form-group">
      <label for="mobile">Mobile Number <span style="color:var(--red)">*</span></label>
      <input type="tel" id="mobile" name="mobile" placeholder="10-digit mobile number" maxlength="10"
             autocomplete="tel" inputmode="numeric" pattern="[0-9]{10}">
      <div class="field-error" id="err-mobile">Enter a valid 10-digit mobile number</div>
    </div>

    <div class="form-group">
      <label for="dob">Date of Birth <span style="color:var(--red)">*</span></label>
      <input type="date" id="dob" name="dob" autocomplete="bday"
             max="<?= date('Y-m-d') ?>" min="1920-01-01">
      <div class="field-error" id="err-dob">Required</div>
    </div>

    <div class="form-group">
      <label for="feedback">Feedback / Suggestion</label>
      <textarea id="feedback" name="feedback" placeholder="Share your thoughts (optional)…"></textarea>
    </div>

    <button type="submit" class="btn-primary" id="submit-btn">
      Continue to Spin the Wheel &rarr;
    </button>

  </form>
</div>

<script>
const BASE = 'api/';

// ── Duplicate check on blur ──────────────────────────────────────────
async function checkDuplicate(field, value) {
  if (!value) return false;
  const res = await fetch(BASE + 'check-duplicate.php?' + field + '=' + encodeURIComponent(value));
  const data = await res.json();
  return data.exists;
}

document.getElementById('mobile').addEventListener('blur', async function() {
  const val = this.value.trim();
  const err = document.getElementById('err-mobile');
  if (!/^\d{10}$/.test(val)) {
    this.classList.add('invalid'); this.classList.remove('valid');
    err.textContent = 'Enter a valid 10-digit mobile number';
    err.classList.add('visible'); return;
  }
  const exists = await checkDuplicate('mobile', val);
  if (exists) {
    this.classList.add('invalid'); this.classList.remove('valid');
    err.textContent = 'This mobile number has already participated.';
    err.classList.add('visible');
  } else {
    this.classList.remove('invalid'); this.classList.add('valid');
    err.classList.remove('visible');
  }
});

document.getElementById('email').addEventListener('blur', async function() {
  const val = this.value.trim();
  const err = document.getElementById('err-email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    this.classList.add('invalid'); this.classList.remove('valid');
    err.textContent = 'Enter a valid email address';
    err.classList.add('visible'); return;
  }
  const exists = await checkDuplicate('email', val);
  if (exists) {
    this.classList.add('invalid'); this.classList.remove('valid');
    err.textContent = 'This email has already participated.';
    err.classList.add('visible');
  } else {
    this.classList.remove('invalid'); this.classList.add('valid');
    err.classList.remove('visible');
  }
});

// ── Form submit ──────────────────────────────────────────────────────
document.getElementById('reg-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  let valid = true;

  function require(id, errId, msg) {
    const el = document.getElementById(id);
    const err = document.getElementById(errId);
    if (!el.value.trim()) {
      el.classList.add('invalid');
      err.textContent = msg || 'Required';
      err.classList.add('visible');
      valid = false;
    }
  }

  require('first_name', 'err-first_name', 'First name is required');
  require('last_name',  'err-last_name',  'Last name is required');
  require('dob',        'err-dob',        'Date of birth is required');

  const emailEl  = document.getElementById('email');
  const mobileEl = document.getElementById('mobile');
  if (emailEl.classList.contains('invalid'))  valid = false;
  if (mobileEl.classList.contains('invalid')) valid = false;
  if (!emailEl.value.trim()) {
    emailEl.classList.add('invalid');
    document.getElementById('err-email').classList.add('visible');
    valid = false;
  }
  if (!mobileEl.value.trim()) {
    mobileEl.classList.add('invalid');
    document.getElementById('err-mobile').classList.add('visible');
    valid = false;
  }

  if (!valid) return;

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Please wait…';

  const formData = {
    first_name: document.getElementById('first_name').value.trim(),
    last_name:  document.getElementById('last_name').value.trim(),
    email:      emailEl.value.trim(),
    mobile:     mobileEl.value.trim(),
    dob:        document.getElementById('dob').value,
    feedback:   document.getElementById('feedback').value.trim(),
  };

  try {
    const res  = await fetch(BASE + 'register.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();

    if (data.success) {
      window.location.href = 'spin.php?id=' + data.entry_id;
    } else {
      const alert = document.getElementById('form-alert');
      alert.textContent = data.message || 'Something went wrong. Please try again.';
      alert.classList.add('visible', 'error');
      btn.disabled = false;
      btn.textContent = 'Continue to Spin the Wheel →';
    }
  } catch {
    const alert = document.getElementById('form-alert');
    alert.textContent = 'Network error. Please check your connection and try again.';
    alert.classList.add('visible', 'error');
    btn.disabled = false;
    btn.textContent = 'Continue to Spin the Wheel →';
  }
});
</script>
</body>
</html>
