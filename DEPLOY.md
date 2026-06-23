# Deployment Guide

## Overview

This app is deployed as part of a custom Docker image (`ghcr.io/steven-baron/erpnext-crm`).
All apps — including prospecting — are baked into the image at build time.
The image build is triggered automatically by GitHub Actions when `apps.json` changes.

Image build config lives at: `/home/steven/frappe` (separate repo)

---

## Prerequisites

- Production server running on Dokploy with the ERPNext stack
- Access to the `/home/steven/frappe` image-build repo
- `docker login ghcr.io` authenticated on your local machine

---

## Step 1: Push to GitHub (one-time setup)

```bash
cd /home/steven/Projects/frappedev/frappe-bench/apps/prospecting
git remote add origin https://github.com/Steven-baron/prospecting.git
git push -u origin develop
```

---

## Step 2: Add app to the Docker image (one-time)

Edit `/home/steven/frappe/apps.json` and add:

```json
{
  "url": "https://github.com/Steven-baron/prospecting",
  "branch": "develop"
}
```

Commit and push — GitHub Actions builds and pushes the new image automatically:

```bash
git -C /home/steven/frappe add apps.json
git -C /home/steven/frappe commit -m "Add prospecting app"
git -C /home/steven/frappe push
```

> To build locally instead (faster feedback):
> ```bash
> cd /home/steven/frappe
> ./build-custom-image.sh ghcr.io/steven-baron/erpnext-crm 16
> docker push ghcr.io/steven-baron/erpnext-crm:16
> docker push ghcr.io/steven-baron/erpnext-crm:latest
> ```

---

## Step 3: Redeploy on Dokploy

In Dokploy → ERPNext service → **Redeploy** (pulls the new image).

---

## Step 4: Install on the site (one-time, after first deploy)

Exec into the backend container:

```bash
docker exec -it <backend-container-name> bash
```

Then:

```bash
bench --site YOUR_SITE install-app prospecting
bench build --app prospecting
bench --site YOUR_SITE clear-cache
```

> The app is already in the image — no `.pth` files or manual cloning needed.

### Post-install configuration

Open the prospecting app → Settings and enter your API keys:
- **Google Places API key** (server-side, Places API New enabled)
- **Google Maps API key** (client-side, Maps JavaScript API enabled)
- **OpenCode Go API key** (from opencode.ai — for AI owner name extraction)
- **Firecrawl URL + key** (optional — for JS-rendered site email enrichment)

---

## Deploying Updates (Python / API changes)

Push to the `develop` branch — the running container picks up Python changes on the
next request since the app code is in the image and gunicorn reloads workers automatically.

For DocType schema changes, run migrate:

```bash
bench --site YOUR_SITE migrate
```

For frontend (Vue/JS) changes, rebuild assets locally before pushing:

```bash
cd /home/steven/Projects/frappedev/frappe-bench/apps/prospecting/frontend
npm run build
# commit the built files in prospecting/public/prospecting/ and push
```

Then in the backend container:

```bash
bench build --app prospecting
bench --site YOUR_SITE clear-cache
```

---

## Local Development

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
