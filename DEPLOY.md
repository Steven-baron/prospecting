# Deployment Guide

## Prerequisites

- Production server running Frappe v15 with Frappe CRM installed
- GitHub repo for this app (see Step 1)
- SSH access to the production server

---

## Step 1: Push to GitHub (one-time setup)

```bash
cd /home/steven/Projects/frappedev/frappe-bench/apps/prospecting

# Option A — using GitHub CLI
gh repo create prospecting --private --source=. --push

# Option B — manually
git remote add origin https://github.com/YOUR_USERNAME/prospecting.git
git push -u origin develop
```

---

## Step 2: Install on Production (one-time)

SSH into your production server and run:

```bash
cd /home/frappe/frappe-bench

# 1. Download the app
bench get-app https://github.com/YOUR_USERNAME/prospecting --branch develop

# 2. Install on your site
bench --site YOUR_SITE install-app prospecting

# 3. Run DB migrations
bench --site YOUR_SITE migrate

# 4. Build static assets
bench build --app prospecting

# 5. Restart
bench restart
```

### Post-install configuration

1. Open the Frappe desk → search **Prospecting Settings**
2. Enter your **Google Maps API key** (needs Places API enabled)
3. Ensure Frappe CRM is installed — if not: `bench get-app crm && bench --site YOUR_SITE install-app crm`

---

## Deploying Updates

### 1. Make your changes locally

If you changed any Vue/JS files, rebuild the frontend first:

```bash
cd /home/steven/Projects/frappedev/frappe-bench/apps/prospecting/frontend
npm run build
```

### 2. Commit and push

```bash
cd /home/steven/Projects/frappedev/frappe-bench/apps/prospecting
git add -A
git commit -m "your message"
git push origin develop
```

### 3. Pull and deploy on production

**Full update (recommended):**
```bash
bench update --apps prospecting
```
This pulls git, runs migrations, rebuilds assets, and restarts in one command.

**Manual update (faster, more control):**
```bash
cd apps/prospecting && git pull origin develop && cd ../..
bench --site YOUR_SITE migrate
bench build --app prospecting
bench restart
```

---

## Local Development

The app runs inside Docker. The frontend dev loop:

```bash
# Rebuild frontend after Vue/JS changes
cd /home/steven/Projects/frappedev/frappe-bench/apps/prospecting/frontend
npm run build

# Clear Frappe cache after Python/template changes
docker exec frappedev-bench-1 bash -c "bench --site dev.localhost clear-cache"
```

App runs at: `http://localhost:8000/prospecting`  
App launcher: `http://localhost:8000/apps`

---

## App Structure

```
prospecting/
├── frontend/               # Vue 3 SPA (frappe-ui)
│   ├── src/
│   │   ├── pages/          # ProspectsPage, SearchPage
│   │   ├── components/     # AppSidebar, ProspectDetail
│   │   └── composables/    # api.js (CSRF-aware fetch wrapper)
│   └── vite.config.js
├── prospecting/
│   ├── api.py              # Whitelisted API methods
│   ├── doctype/
│   │   ├── prospect/
│   │   ├── prospect_list/
│   │   └── prospecting_settings/
│   ├── public/prospecting/ # Built frontend assets (committed)
│   └── www/
│       ├── prospecting.*   # SPA entry point
│       └── home.*          # App launcher page
└── hooks.py
```

---

## Key API Methods

| Method | Description |
|--------|-------------|
| `prospecting.api.get_lists_with_counts` | Sidebar list data |
| `prospecting.api.search_places` | Google Places grid search |
| `prospecting.api.import_prospects` | Save search results to a list |
| `prospecting.api.push_to_crm` | Create CRM Leads from prospects |
| `prospecting.api.remove_from_list` | Unlink prospects from a list |
| `prospecting.api.enrich_email` | Find email from website |
| `prospecting.api.delete_list` | Delete a prospect list |
