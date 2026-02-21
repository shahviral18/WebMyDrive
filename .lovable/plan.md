
## WebMyDrive Admin Dashboard — Phase 1 Implementation Plan

A premium super-admin portal with dark-first design, high security feel, and zero-touch automation simulation. Here's what we'll build:

---

### 🎨 Design System Foundation
- Rich semantic HSL tokens in `index.css`: `--primary`, `--danger`, `--surface`, `--muted`, `--border`, glow shadows, gradient backgrounds
- Dark mode as default with light mode toggle support
- Tailwind config extended with custom color aliases, `shadow-glow`, `gradient-primary` utilities
- Framer Motion added for page transitions, staggered lists, modal springs, and hover scales

---

### 🔐 Page 1: `/admin/login`
- Centered card on animated gradient background (slow-moving mesh gradient)
- Fields: Email → Password → 6-digit MFA OTP input
- Shake animation on wrong credentials (mocked)
- Confetti burst + smooth redirect to dashboard on success
- "Secured by WebMyDrive" trust badge at bottom

---

### 🏗️ Protected Layout
- **Collapsible sidebar** with icon-only mini mode: Dashboard, Users, Workspaces, Queues & Sync, Controls, Audit Logs, Alerts, Settings — with active route highlight
- **Top bar**: WebMyDrive logo, breadcrumb, dark/light toggle, avatar + logout dropdown
- **Mobile**: Drawer sidebar triggered by hamburger
- Smooth sidebar collapse/expand animation

---

### 📊 Page 2: `/admin/dashboard`
- **KPI Cards** (4): API Quota Usage (animated SVG ring), Queue Depth, Drift %, System Uptime — with trend indicators
- **Charts**: Queue activity over time (Recharts area chart), Workspace sync health (bar chart) — animated on load
- **Recent Admin Actions Feed**: timestamped list with actor, action type, badge color, staggered fade-in

---

### ⚙️ Page 3: `/admin/controls`
- **Feature Toggles** section: `ENABLE_REGISTRATION`, `ENABLE_PAYMENTS`, `MAINTENANCE_MODE`, `ENABLE_REFERRALS` — custom animated switches with status badge
- **Rate Limit Sliders**: Sleep Interval (ms), Burst Limit (req/min) with live value display
- **Danger Zone** (red-bordered section): Big red buttons — *Pause All Queues*, *Emergency Kill-Switch*, *Revoke All Credentials* — each with a confirmation dialog requiring typed confirmation ("I understand")

---

### 📬 Page 4: `/admin/queues`
- Tabs: High Priority / Standard / Low Priority / Dead Letter Queue
- Each tab shows queue cards with animated depth progress bars
- **Re-queue** and **Flush** action buttons → mock loading → success toast (Sonner)
- Queue stats: depth, processing rate, oldest message age

---

### 🏢 Page 5: `/admin/workspaces`
- Searchable data table: Domain, Plan, Status badge, Last Sync time, Agent version
- **Force Sync** button per row → loading spinner → confetti success
- Status badges: Active (green), Suspended (red), Pending (yellow)

---

### 📋 Page 6: `/admin/audit-logs`
- Searchable, paginated table: Actor, Action, Timestamp, IP Address, Payload preview (expandable)
- Filter bar: date range, action type, actor search
- **Export CSV** button (mocked download)
- Immutable feel: read-only, monospace payload text, subtle row hover

---

### 🧩 Component Variants
- **Button**: `primary` (indigo glow), `danger` (red pulse), `outline`, `ghost`
- **Card**: `surface` (dark glass), `danger` (red border glow), `metric` (KPI style)
- **Badge**: `active`, `suspended`, `pending`, `critical`
- **Toast** (Sonner): success with confetti trigger, error with shake

---

### 📦 Mock Data Layer
- All data is client-side mocked (no backend needed)
- Realistic workspace domains, queue metrics, audit log entries, admin users
- Simulated async operations with setTimeout for realistic loading states

This will deliver a **Linear/Vercel/Supabase-level polished** admin dashboard — dark, premium, and trust-inspiring from the first pixel.
