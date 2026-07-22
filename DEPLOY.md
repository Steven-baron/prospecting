# Deployment Guide

## Overview

The Docker image is built by the **frappe-platform** repo (`/home/steven/frappe-platform`),
which clones this app from GitHub and layers it on top of the base ERPNext image.

Pushing to `develop` here fires a `repository_dispatch` to frappe-platform
(`.github/workflows/build.yml`), which rebuilds `ghcr.io/steven-baron/erpnext-crm:16`
in ~1-2 min. Requires the `PLATFORM_TOKEN` secret (PAT with `repo` scope on
frappe-platform) in this repo's Actions secrets.

**Build time:** ~1-2 minutes (the heavy base image is built separately, rarely)

---

## Prerequisites

- Production server running on Dokploy with the ERPNext stack
- `PLATFORM_TOKEN` secret set in this repo (Settings → Secrets → Actions)
- The frappe-platform repo set up with `build-apps.yml` (see its README)

---

## Step 1: Push to GitHub (one-time setup)

```bash
cd /home/steven/Projects/frappedev/frappe-bench/apps/prospecting
git remote add origin https://github.com/Steven-baron/prospecting.git
git push -u origin develop
```

---

## Step 2: Push to develop

Pushing to `develop` automatically:
1. Fires `repository_dispatch` → frappe-platform `build-apps.yml`
2. frappe-platform clones this app, builds the layer, pushes `:16` to GHCR

GitHub Actions handles this — no manual image build needed.

> To build the image manually, do it from the frappe-platform repo:
> ```bash
> cd /home/steven/frappe-platform
> ./build-local.sh --fast        # reuses base, rebuilds apps layer
> docker push ghcr.io/steven-baron/erpnext-crm:16
> ```

---

## Step 3: Redeploy on Dokploy

In Dokploy → ERPNext service → **Redeploy** (pulls the new image).

> To force-recreate from VPS (if Dokploy doesn't pull the new image):
> ```bash
> docker compose -f /etc/dokploy/compose/digitallunas-erpnext-kpogqs/code/docker-compose.yml \
>   up -d --force-recreate --no-deps backend
> ```

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

#### Standalone / single-site

Open the prospecting app → Settings and enter your API keys:

- **Google Places API key** (server-side, Places API New enabled)
- **Google Maps API key** (client-side, Maps JavaScript API enabled)
- **OpenCode Go API key** (from opencode.ai — for AI owner name extraction)
- **Firecrawl URL + key** (optional — for JS-rendered site email enrichment)

#### Platform mode (Business OS multi-tenant)

The **control plane** can own Places/Maps keys for the whole fleet:

1. Operator opens **Manager → Integrations → Google Places / Maps** and saves keys  
   (control-plane doc: `platform_control` repo → `docs/INTEGRATIONS.md`).
2. **New tenants** receive those keys automatically at provision:
   - `site_config`: `bos_google_places_api_key`, `bos_google_maps_api_key`
   - **Prospecting Settings** password fields (via `prospecting.api.apply_platform_api_keys`)
3. At runtime, Prospecting resolves keys in this order:
   1. Tenant **Prospecting Settings** (local override or provisioned copy)
   2. Tenant `site_config` `bos_google_*` (platform inject fallback)

Tenant Settings can still set **per-site overrides**. Empty password fields on
save do **not** wipe existing keys (write-only). Saving platform keys does **not**
auto-update existing tenants — re-inject or set Settings per site.

OpenCode / Firecrawl remain **per-tenant** in Prospecting Settings (not on
Platform Integrations yet).

---

## Deploying Updates

### Frontend (Vue/JS) changes

Build locally before pushing — the built files are committed to git and baked into the image:

```bash
cd /home/steven/Projects/frappedev/frappe-bench/apps/prospecting/frontend
npm run build
git add ../prospecting/public/prospecting/
git commit -m "build: update frontend assets"
git push origin develop
```

GitHub Actions then builds the thin layer image (~1 min). After Dokploy redeploys, run in the backend container:

```bash
bench --site digitallunas-erpnext-0978d0-54-39-99-84.sslip.io clear-cache
```

### Python / API changes

Push to `develop`. Dokploy redeploys with the new image. No extra steps needed.

### DocType schema changes

After redeploy, run in the backend container:

```bash
bench --site digitallunas-erpnext-0978d0-54-39-99-84.sslip.io migrate
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
