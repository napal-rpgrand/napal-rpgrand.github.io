# 🚀 Deployment Guide

## What's in `.gitignore` (NOT pushed to GitHub)

| File | Reason |
|---|---|
| `.env` | Contains all passwords & Discord webhook URL |
| `database.sqlite` | Contains real user submission data |

---

## First-Time Server Setup

### 1. Clone from GitHub
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
npm install
```

### 2. Create your `.env` file (not included in repo)
Create a file called `.env` in the project root:
```
ADMIN_PANEL_SECRET=your_secret_slug_here
DEVELOPER_PASSWORD=YourStrongPassword123
ADMIN1_PASSWORD=Admin1StrongPassword
ADMIN2_PASSWORD=Admin2StrongPassword
ADMIN3_PASSWORD=Admin3StrongPassword
ADMIN_PASSWORD=AdminPassword
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
PORT=3000
```

> **Tip:** Change all passwords from the defaults before deploying!

### 3. Manually upload `admin.html`
Since `admin.html` is not in the repo, you need to copy it manually:

**Option A — SCP (Linux/Mac server):**
```bash
scp admin.html user@your-server.com:/path/to/project/admin.html
```

**Option B — FTP/SFTP:** Upload `admin.html` directly to your server using FileZilla or similar.

**Option C — Local-only:** If running locally, `admin.html` is already in your folder, just start the server.

### 4. Start the server
```bash
node server.js
```

The console will print the secret admin panel URL:
```
🔒 Admin Panel: http://localhost:3000/panel-YOUR_SECRET
```

---

## Changing the Admin URL

1. Edit `.env` and change `ADMIN_PANEL_SECRET=new_secret`
2. Restart the server: `node server.js`
3. New URL: `http://yoursite.com/panel-new_secret`

---

## Changing Admin Passwords

**Recommended:** Update via the admin panel Members tab (Developer login → 👥 Members → Edit).

**Alternative:** Update `.env` and delete `database.sqlite` to re-seed from scratch (⚠️ this deletes all submissions too).

---

## Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `ADMIN_PANEL_SECRET` | Secret URL slug for admin panel | `xk9p2m7r` |
| `DEVELOPER_PASSWORD` | Developer account password | *(required)* |
| `ADMIN1_PASSWORD` | admin1 account password | *(required)* |
| `ADMIN2_PASSWORD` | admin2 account password | *(required)* |
| `ADMIN3_PASSWORD` | admin3 account password | *(required)* |
| `ADMIN_PASSWORD` | admin account password | *(required)* |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications | *(optional)* |
