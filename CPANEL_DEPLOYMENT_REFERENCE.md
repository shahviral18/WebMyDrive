# cPanel Deployment Reference — React + PHP + MySQL

> **Purpose:** Universal reference for deploying React SPA + PHP backend + MySQL apps on shared cPanel hosting. Not project-specific — use this as a playbook for any new deployment.

---

## Table of Contents

1. [cPanel Architecture Overview](#1-cpanel-architecture-overview)
2. [Directory Structure](#2-directory-structure)
3. [MySQL Database Setup](#3-mysql-database-setup)
4. [Secure Credential Storage](#4-secure-credential-storage)
5. [PHP Backend Deployment](#5-php-backend-deployment)
6. [React Frontend Deployment](#6-react-frontend-deployment)
7. [Apache .htaccess Configuration](#7-apache-htaccess-configuration)
8. [API Token Deployment (Automated)](#8-api-token-deployment-automated)
9. [SSL / HTTPS](#9-ssl--https)
10. [Cron Jobs](#10-cron-jobs)
11. [Email (mail() function)](#11-email-mail-function)
12. [DNS & Domain Configuration](#12-dns--domain-configuration)
13. [File Permissions](#13-file-permissions)
14. [PHP Version & Configuration](#14-php-version--configuration)
15. [Limitations & Constraints](#15-limitations--constraints)
16. [Troubleshooting](#16-troubleshooting)
17. [Deployment Checklist](#17-deployment-checklist)

---

## 1. cPanel Architecture Overview

cPanel is a web-based hosting control panel for shared Linux hosting. Each account gets:

```
/home/username/                  ← Home directory (private, not web-accessible)
├── public_html/                 ← Document root (web-accessible via domain)
│   ├── index.html               ← Frontend entry point
│   ├── assets/                  ← JS/CSS bundles
│   ├── .htaccess                ← Apache config (routing, security)
│   └── backend/                 ← PHP API files
│       ├── .htaccess            ← Backend-specific rules
│       └── *.php                ← API endpoints
├── secure_config/               ← Credentials (NOT web-accessible)
│   └── db_config.php
├── ssl/                         ← SSL certificates (managed by cPanel)
├── logs/                        ← Access & error logs
├── tmp/                         ← Temporary files
└── etc/                         ← Account config
```

**Key principle:** Anything in `public_html/` is web-accessible. Anything above it is private.

### What cPanel Provides

| Feature | How to Access | Notes |
|---------|--------------|-------|
| MySQL databases | cPanel → MySQL Databases | Create DB, users, assign privileges |
| phpMyAdmin | cPanel → phpMyAdmin | GUI for SQL operations (import/export/query) |
| File Manager | cPanel → File Manager | Upload, edit, manage files via browser |
| SSL/TLS | cPanel → SSL/TLS | Free AutoSSL or install custom certificates |
| Cron Jobs | cPanel → Cron Jobs | Schedule PHP scripts to run periodically |
| Email Accounts | cPanel → Email Accounts | Create email@yourdomain.com |
| Error Logs | cPanel → Error Log | Last 300 lines of Apache error log |
| PHP Selector | cPanel → MultiPHP Manager | Switch PHP versions per domain |
| DNS Zone Editor | cPanel → Zone Editor | Manage A, CNAME, MX, TXT records |
| Backups | cPanel → Backup / JetBackup | Full or partial account backups |
| SSH Access | cPanel → Terminal (if enabled) | Not always available on shared hosting |
| API Tokens | cPanel → Security → API Tokens | For automated deployment via scripts |

---

## 2. Directory Structure

### Recommended Layout

```
/home/username/
│
├── secure_config/              ← DB credentials, API keys, secrets
│   └── db_config.php           ← NOT in public_html = NOT web-accessible
│
├── public_html/                ← Document root
│   ├── .htaccess               ← SPA routing + security headers
│   ├── index.html              ← React app entry point
│   ├── favicon.svg
│   ├── robots.txt
│   ├── assets/
│   │   ├── index-[hash].js     ← Bundled React app
│   │   └── index-[hash].css    ← Bundled styles
│   └── backend/
│       ├── .htaccess           ← Block sensitive files, API routing
│       ├── db_connect.php      ← Loads creds from secure_config
│       ├── login.php           ← Authentication endpoint
│       ├── get_*.php           ← Read endpoints
│       └── save_*.php          ← Write endpoints
```

### What Goes Where

| Content | Location | Why |
|---------|----------|-----|
| DB credentials | `/home/user/secure_config/` | Outside web root — can't be accessed via URL |
| Frontend build | `public_html/` | Must be web-accessible |
| Backend PHP | `public_html/backend/` | Must be web-accessible for API calls |
| SQL schema files | Local only / phpMyAdmin | Import via phpMyAdmin, don't leave on server |
| Node modules, src/ | Local only | Never upload — only upload built output |
| .env files | Local only | Build-time only (Vite inlines them) |

---

## 3. MySQL Database Setup

### Creating Database & User

1. cPanel → **MySQL Databases**
2. **Create New Database**: enter name (cPanel prefixes with username, e.g., `username_dbname`)
3. **Create New User**: enter username + strong password
4. **Add User to Database**: select both → grant **ALL PRIVILEGES** → confirm

### Importing Schema

1. cPanel → **phpMyAdmin**
2. Select database from left sidebar
3. Click **Import** tab
4. Upload `.sql` files one at a time, in order:
   - Base schema (tables, constraints, foreign keys)
   - Migrations (ALTER TABLE, new columns)
   - Seed data (default records)

### MySQL Version Compatibility

cPanel shared hosting often runs **MySQL 5.7** or **MariaDB 10.x**, NOT MySQL 8.x.

**Syntax that may NOT work:**

| Syntax | MySQL 8+ | MySQL 5.7 | Alternative |
|--------|----------|-----------|-------------|
| `CREATE INDEX IF NOT EXISTS` | Yes | No | `ALTER TABLE ADD INDEX` + try/catch |
| `ADD COLUMN IF NOT EXISTS` | No (MariaDB only) | No | `ALTER TABLE ADD COLUMN` + try/catch |
| `JSON` column type | Yes | Partial | Use `TEXT` + `JSON_EXTRACT()` |
| `WITH` (CTE) | Yes | No | Use subqueries |
| Window functions (`ROW_NUMBER`) | Yes | No | Use user variables |
| `DEFAULT (expression)` | Yes | No | Use triggers or app-level defaults |

**Safe pattern for auto-migrations in PHP:**
```php
$migrations = [
    "ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN org_id VARCHAR(100) DEFAULT NULL",
];
foreach ($migrations as $sql) {
    try { $pdo->exec($sql); } catch (Exception $e) { /* column already exists */ }
}
```

---

## 4. Secure Credential Storage

### The Problem

PHP files in `public_html/` are executed by Apache, but if Apache is misconfigured or PHP fails, the raw source could be exposed. Database credentials should never be in web-accessible files.

### The Solution

Store credentials in a file **above** `public_html/`:

**`/home/username/secure_config/db_config.php`:**
```php
<?php
$host     = 'localhost';
$dbname   = 'username_mydb';
$username = 'username_dbuser';
$password = 'strong_password_here';
```

**`public_html/backend/db_connect.php`:**
```php
<?php
// Load credentials from outside web root
$secure_config = '/home/username/secure_config/db_config.php';
$local_config  = __DIR__ . '/secure_config/db_config.php';

if (file_exists($secure_config)) {
    require_once $secure_config;
} elseif (file_exists($local_config)) {
    require_once $local_config;
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Database configuration not found.']);
    exit;
}

$pdo = new PDO(
    "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
    $username, $password,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
);
```

### Git Safety

Add to `.gitignore`:
```
# Never commit real credentials
backend/secure_config/db_config.php
```

Keep a `.example` template tracked:
```
backend/secure_config/db_config.php.example   ← tracked (placeholder values)
backend/secure_config/db_config.php           ← gitignored (real credentials)
```

---

## 5. PHP Backend Deployment

### Upload PHP Files

Upload all `backend/*.php` files to `public_html/backend/` via:
- cPanel **File Manager** (browser upload)
- **SFTP/FTP** client (FileZilla, WinSCP)
- **cPanel API** (automated — see Section 8)

### Do NOT Upload

- `.sql` files (import via phpMyAdmin instead)
- `secure_config/` with real credentials (create manually on server)
- Test/debug scripts
- Node.js files (package.json, node_modules, etc.)

### PHP Error Handling

On shared hosting, `display_errors` is typically OFF. Errors go to the Apache error log.

**To check errors:** cPanel → Error Log

**For debugging (temporarily):**
```php
ini_set('display_errors', 1);
error_reporting(E_ALL);
```

**For production:**
```php
ini_set('display_errors', 0);
error_reporting(E_ALL);
// Errors go to server error log only
```

### CORS Headers

Every PHP endpoint needs CORS headers for frontend-backend communication:
```php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }
```

For production, replace `*` with your actual domain:
```php
header("Access-Control-Allow-Origin: https://yourdomain.com");
```

---

## 6. React Frontend Deployment

### Build Process

```bash
npm run build          # Creates dist/ folder
```

**Output structure:**
```
dist/
├── index.html         ← Entry point (references hashed assets)
├── .htaccess          ← SPA routing (if placed in public/)
├── favicon.svg
├── robots.txt
└── assets/
    ├── index-[hash].js    ← All JS bundled + minified
    └── index-[hash].css   ← All CSS bundled + minified
```

### Upload to cPanel

Upload **contents of `dist/`** (not the dist folder itself) to `public_html/`:

```
dist/index.html      → public_html/index.html
dist/assets/         → public_html/assets/
dist/.htaccess       → public_html/.htaccess
dist/robots.txt      → public_html/robots.txt
```

### Environment Variables

Vite inlines `VITE_*` env vars at **build time**. They're baked into the JS bundle.

**`.env`** (local):
```
VITE_APP_URL=/backend
```

**For different environments**, use `.env.production`:
```
VITE_APP_URL=https://api.yourdomain.com
```

Then build with: `npm run build` (auto-uses `.env.production`)

### Cache Busting

Vite uses content-hash filenames (`index-A1B2C3.js`). When code changes, the hash changes. The old file becomes orphaned on the server — it won't be loaded but takes disk space. Periodically clean up old assets in `public_html/assets/`.

---

## 7. Apache .htaccess Configuration

### Frontend SPA Routing (`public_html/.htaccess`)

React Router uses client-side routing. Apache must serve `index.html` for all non-file routes:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # Serve existing files/directories directly
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d

    # Don't rewrite backend API requests
    RewriteCond %{REQUEST_URI} !^/backend/

    # Everything else → SPA entry point
    RewriteRule . /index.html [L]
</IfModule>

DirectoryIndex index.html
Options -Indexes

# Security headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>
```

### Backend Security (`public_html/backend/.htaccess`)

```apache
# Block access to sensitive file types
<FilesMatch "\.(sql|md|env|ini|log|sh|bak|config)$">
    Order allow,deny
    Deny from all
</FilesMatch>

<IfModule mod_rewrite.c>
    RewriteEngine On

    # Block access to config directories
    RewriteRule ^secure_config/ - [F,L]

    # Optional: RESTful URL rewrites
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^leads/([^/]+)$ api_leads.php?id=$1 [L,QSA]
</IfModule>

Options -Indexes
```

### What .htaccess Can Do

| Capability | Example |
|-----------|---------|
| URL rewriting | Pretty URLs, SPA routing |
| Access control | Block file types, directories, IPs |
| Redirects | 301/302 redirects |
| Custom error pages | `ErrorDocument 404 /index.html` |
| MIME types | `AddType application/json .json` |
| Caching headers | `ExpiresByType image/svg+xml "access plus 1 year"` |
| Compression | `AddOutputFilterByType DEFLATE text/html` |
| Security headers | CSP, HSTS, X-Frame-Options |

### What .htaccess CANNOT Do

| Limitation | Why | Workaround |
|-----------|-----|------------|
| Proxy requests | Needs `mod_proxy` (usually disabled on shared) | Use same-domain backend |
| WebSockets | Apache on shared hosting doesn't support | Use polling or external service |
| Custom modules | Can't load Apache modules | Work with what's installed |
| Full server config | Only overrides, not full httpd.conf | Use cPanel settings |

---

## 8. API Token Deployment (Automated)

### Creating an API Token

cPanel → **Security** → **Manage API Tokens** → Create

Tokens can have expiration dates. Store securely — they grant full cPanel access.

### Authentication Header

```
Authorization: cpanel USERNAME:TOKEN
```

### Upload Files via UAPI

```bash
curl -s -k \
  -H 'Authorization: cpanel USERNAME:TOKEN' \
  -F 'dir=public_html' \
  -F 'file-1=@dist/index.html' \
  -F 'file-2=@dist/robots.txt' \
  -F 'overwrite=1' \
  "https://yourdomain.com:2083/execute/Fileman/upload_files"
```

**Key parameters:**
- `dir` — destination relative to home directory (e.g., `public_html/backend`)
- `file-N` — files to upload (numbered sequentially: `file-1`, `file-2`, etc.)
- `overwrite=1` — replace existing files
- Port **2083** — cPanel SSL port

### Other Useful API Endpoints

```bash
# List files (UAPI)
curl -s -k -H 'Authorization: cpanel USER:TOKEN' \
  "https://domain:2083/execute/Fileman/list_files?dir=public_html"

# Get disk usage (UAPI)
curl -s -k -H 'Authorization: cpanel USER:TOKEN' \
  "https://domain:2083/execute/ResourceUsage/get_usages"

# Delete a file (API2 — not available via UAPI, use older API2 fileop)
curl -s -k -H 'Authorization: cpanel USER:TOKEN' \
  "https://domain:2083/json-api/cpanel?cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&op=unlink&sourcefiles=public_html/path/to/file.js&dir=/"

# Delete multiple files in a loop (bash)
FILES=("old-file-1.js" "old-file-2.css" "old-image.png")
for f in "${FILES[@]}"; do
  curl -s -k -H "Authorization: cpanel USER:TOKEN" \
    "https://domain:2083/json-api/cpanel?cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&op=unlink&sourcefiles=public_html/path/to/${f}&dir=/"
done

# Rename / move a file (API2 fileop)
curl -s -k -H 'Authorization: cpanel USER:TOKEN' \
  "https://domain:2083/json-api/cpanel?cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&op=move&sourcefiles=public_html/old-name.txt&destfiles=public_html/new-name.txt&dir=/"
```

**Note:** UAPI (`/execute/`) is the newer cPanel API but lacks file delete/rename/move.
Use the older API2 (`/json-api/cpanel?cpanel_jsonapi_apiversion=2`) for those operations.
Both use the same `Authorization: cpanel USER:TOKEN` header.

### API Summary

| Operation | API | Endpoint |
|-----------|-----|----------|
| Upload files | UAPI | `Fileman/upload_files` |
| List files | UAPI | `Fileman/list_files` |
| Create directory | — | Upload a file to the path — auto-creates dir |
| Delete files | API2 | `Fileman/fileop` with `op=unlink` |
| Rename/move | API2 | `Fileman/fileop` with `op=move` |
| Disk usage | UAPI | `ResourceUsage/get_usages` |

---

## 9. SSL / HTTPS

### AutoSSL (Free)

Most cPanel hosts include **AutoSSL** (Let's Encrypt or cPanel-issued). It:
- Automatically issues certificates for all domains on the account
- Auto-renews every 60-90 days
- No manual setup needed

### Force HTTPS

Add to `public_html/.htaccess`:
```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### Mixed Content

If your frontend is HTTPS but calls HTTP backend endpoints, browsers will block the requests. Ensure:
- API URLs use `https://` or relative paths (`/backend/`)
- No hardcoded `http://` URLs in frontend code

---

## 10. Cron Jobs

### Setup

cPanel → **Cron Jobs**

### Common Schedule

```
# Every day at 8 AM
0 8 * * * php /home/username/public_html/backend/send_reminders.php

# Every hour
0 * * * * php /home/username/public_html/backend/cleanup.php

# Every 5 minutes
*/5 * * * * php /home/username/public_html/backend/process_queue.php
```

### Important Notes

- Use **full path** to PHP binary: `/usr/local/bin/php` or just `php`
- Use **full path** to script: `/home/username/public_html/backend/script.php`
- Output goes to email by default. Suppress with: `>/dev/null 2>&1`
- Scripts run from home directory, not public_html — use absolute paths or `__DIR__`
- cPanel limits cron frequency (usually minimum 1 minute on shared hosting)

---

## 11. Email (mail() function)

### How It Works

PHP `mail()` uses the server's local mail transport (Exim on cPanel).

```php
$headers = "From: noreply@yourdomain.com\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
mail($to, $subject, $htmlBody, $headers);
```

### Limitations

| Issue | Impact | Mitigation |
|-------|--------|------------|
| Deliverability | Emails may land in spam | Set up SPF, DKIM, DMARC records in DNS |
| Rate limits | Shared hosting limits (e.g., 500/hour) | Use external SMTP for bulk sending |
| No tracking | No open/click tracking | Use Mailgun, SendGrid, or SES |
| Slow | `mail()` blocks script execution | Use a queue + cron for bulk sends |

### Better Alternative: External SMTP

Use PHPMailer or similar library with external SMTP (Gmail, SendGrid, Mailgun):
```php
// PHPMailer example
$mail = new PHPMailer();
$mail->isSMTP();
$mail->Host = 'smtp.sendgrid.net';
$mail->SMTPAuth = true;
$mail->Username = 'apikey';
$mail->Password = 'SG.xxxx';
```

---

## 12. DNS & Domain Configuration

### Required DNS Records

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `@` | A | Server IP | Points domain to server |
| `www` | CNAME | `yourdomain.com` | www subdomain |
| `@` | MX | Mail server | Email delivery |
| `@` | TXT | `v=spf1 +a +mx ...` | SPF (email authentication) |
| `default._domainkey` | TXT | DKIM key | DKIM (email signing) |

### Nameserver vs External DNS

**Option A — Use hosting nameservers:** Point domain nameservers to host (e.g., `ns1.host.com`). cPanel manages all DNS.

**Option B — External DNS (Cloudflare, etc.):** Keep DNS at registrar/Cloudflare. Manually create A record pointing to cPanel server IP. Useful for CDN/proxy.

---

## 13. File Permissions

### Default Permissions on cPanel

| Type | Permission | Octal |
|------|-----------|-------|
| Directories | rwxr-xr-x | 755 |
| PHP files | rw-r--r-- | 644 |
| Config files | rw------- | 600 (recommended for credentials) |

### Common Issues

- **500 Internal Server Error** — File permissions too open (777) or wrong ownership
- **403 Forbidden** — .htaccess denying access, or directory permissions wrong
- **Blank page** — PHP error with display_errors off. Check Error Log.

---

## 14. PHP Version & Configuration

### Checking/Changing PHP Version

cPanel → **MultiPHP Manager** → select domain → choose version

### Recommended: PHP 8.1+

Needed for: `match` expressions, named arguments, fibers, enums, readonly properties.

### php.ini Overrides

Create `.user.ini` in `public_html/` (some hosts use `php.ini`):
```ini
upload_max_filesize = 64M
post_max_size = 64M
max_execution_time = 300
memory_limit = 256M
display_errors = Off
```

### Common PHP Extensions on Shared Hosting

Usually available: `pdo_mysql`, `curl`, `json`, `mbstring`, `openssl`, `zip`, `gd`

Usually NOT available: `redis`, `memcached`, `imagick` (varies by host)

---

## 15. Limitations & Constraints

### Resource Limits

| Resource | Typical Shared Hosting Limit | Impact |
|----------|------------------------------|--------|
| CPU | 1-2 cores, throttled | Long-running scripts get killed |
| RAM | 512MB - 1GB per account | Large data processing fails |
| Disk | 5-50 GB (varies by plan) | Monitor uploads and logs |
| Inodes | 100,000 - 250,000 files | `node_modules` would exhaust this alone |
| MySQL connections | 25-50 simultaneous | Connection pooling needed at scale |
| PHP execution time | 30-300 seconds | Timeout for heavy operations |
| Email | 500/hour typical | Use external SMTP for marketing |
| Bandwidth | "Unlimited" (fair use) | Heavy traffic may get throttled |

### Things You CANNOT Do on Shared cPanel Hosting

| Limitation | Why | Alternative |
|-----------|-----|------------|
| Run Node.js server | No persistent processes | Build frontend locally, deploy static files |
| WebSockets | Apache doesn't support on shared | Use polling, or external service (Pusher, Ably) |
| Install system packages | No root/sudo access | Use PHP extensions that are pre-installed |
| Custom Apache modules | No httpd.conf access | Use .htaccess for what's possible |
| Docker / containers | No container runtime | Use VPS/cloud for containerized apps |
| Background workers | No process manager (PM2, supervisor) | Use cron jobs as pseudo-workers |
| Redis / Memcached | Usually not installed | Use MySQL for caching, or external Redis |
| Server-Sent Events | Connection limits too low | Use polling |
| Large file processing | Memory/CPU limits | Process on client-side or use cloud functions |
| Custom ports | Only 80/443 + cPanel ports | Everything through Apache |
| Raw TCP sockets | Not available | Use HTTP-based alternatives |
| Git deployment hooks | No SSH on many plans | Use cPanel API or manual upload |
| `composer install` on server | Sometimes no SSH | Run locally, upload vendor/ |

### Performance Considerations

| Concern | Recommendation |
|---------|---------------|
| Shared IP | Other sites on same IP may affect reputation. Get dedicated IP for email. |
| "Unlimited" claims | Fair-use policies apply. Heavy usage gets throttled or suspended. |
| No CDN built-in | Use Cloudflare (free tier) for caching and DDoS protection. |
| Database performance | Shared MySQL server. Optimize queries, add proper indexes. |
| No HTTP/2 push | Server push not available. Use preload hints in HTML instead. |
| Cold starts | PHP boots fresh on each request. No connection pooling. |

### Security Constraints

| Risk | Mitigation |
|------|-----------|
| Shared server neighbors | Your site shares a server with hundreds of others. Isolate credentials. |
| No WAF by default | Use Cloudflare or host's ModSecurity if available. |
| FTP (unencrypted) | Always use SFTP or cPanel File Manager (HTTPS). |
| PHP source exposure | If Apache fails, PHP source may be visible. Keep credentials outside public_html. |
| No fail2ban control | Can't customize brute-force protection. Implement rate limiting in PHP. |

---

## 16. Troubleshooting

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Blank page (no error) | PHP fatal error with display_errors off | Check cPanel → Error Log |
| 500 Internal Server Error | .htaccess syntax error, or permission issue | Comment out .htaccess lines to isolate; check file permissions (644/755) |
| 403 Forbidden | .htaccess blocking access, or wrong permissions | Check .htaccess rules; verify directory is 755 |
| 404 on SPA routes (e.g., /dashboard) | Missing .htaccess SPA fallback | Add RewriteRule to serve index.html |
| API returns "Database configuration not found" | Secure config file missing or wrong path | Verify file exists at the path in db_connect.php |
| API returns "Access denied for user" | MySQL user not added to database | cPanel → MySQL Databases → Add User to Database |
| "Too many connections" | MySQL connection limit reached | Add retry logic in db_connect.php; close connections |
| CORS errors in browser | Missing CORS headers in PHP | Add `Access-Control-Allow-Origin` header to all endpoints |
| Old JS still loading after deploy | Browser cache or old asset hash in index.html | Re-upload index.html; hard refresh (Ctrl+Shift+R) |
| CSS/JS not loading (404) | Asset hash changed but index.html not updated | Always upload index.html with every deploy |
| .htaccess not working | `mod_rewrite` not enabled or AllowOverride Off | Contact host; check if `<IfModule>` wrapper is used |

### Debugging Steps

1. **Check Error Log:** cPanel → Error Log (last 300 lines)
2. **Test endpoint directly:** `curl -v https://yourdomain.com/backend/endpoint.php`
3. **Temporarily enable errors:** Add `ini_set('display_errors', 1);` to the PHP file
4. **Check file exists:** cPanel → File Manager → verify file is in correct location
5. **Check permissions:** Files should be 644, directories 755
6. **Test DB connection:** Create a simple `test.php` that connects to MySQL (delete after)

---

## 17. Deployment Checklist

### First-Time Setup

```
[ ] Create MySQL database + user in cPanel
[ ] Add user to database with ALL PRIVILEGES
[ ] Import schema SQL via phpMyAdmin
[ ] Create /home/username/secure_config/db_config.php with real credentials
[ ] Build frontend: npm run build
[ ] Upload dist/ contents to public_html/
[ ] Upload backend/*.php to public_html/backend/
[ ] Upload .htaccess files to both public_html/ and public_html/backend/
[ ] Verify: landing page loads (https://yourdomain.com/)
[ ] Verify: SPA routing works (https://yourdomain.com/any-route)
[ ] Verify: API responds (https://yourdomain.com/backend/endpoint.php)
[ ] Verify: security blocks work (try accessing .sql files, directory listing)
[ ] Set up cron jobs if needed
[ ] Set up email DNS records (SPF, DKIM) if sending email
```

### Subsequent Deploys (Code Updates)

```
[ ] npm run build
[ ] Upload dist/index.html to public_html/
[ ] Upload dist/assets/* to public_html/assets/
[ ] Upload changed backend/*.php files to public_html/backend/
[ ] Hard refresh browser to verify (Ctrl+Shift+R)
[ ] Optionally: clean up old asset files from public_html/assets/
```

### Using cPanel API for Automated Deploys

```bash
# Set variables
HOST="yourdomain.com"
USER="cpanel_username"
TOKEN="your_api_token"
AUTH="Authorization: cpanel ${USER}:${TOKEN}"

# Upload frontend
curl -s -k -H "$AUTH" \
  -F 'dir=public_html' \
  -F 'file-1=@dist/index.html' \
  -F 'file-2=@dist/.htaccess' \
  -F 'file-3=@dist/robots.txt' \
  -F 'overwrite=1' \
  "https://${HOST}:2083/execute/Fileman/upload_files"

# Upload assets
curl -s -k -H "$AUTH" \
  -F 'dir=public_html/assets' \
  -F "file-1=@dist/assets/$(ls dist/assets/*.js)" \
  -F "file-2=@dist/assets/$(ls dist/assets/*.css)" \
  -F 'overwrite=1' \
  "https://${HOST}:2083/execute/Fileman/upload_files"

# Upload backend
curl -s -k -H "$AUTH" \
  -F 'dir=public_html/backend' \
  -F 'file-1=@backend/changed_file.php' \
  -F 'overwrite=1' \
  "https://${HOST}:2083/execute/Fileman/upload_files"
```
