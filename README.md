### Prospecting

Google Places–based prospect discovery and list management for Frappe / Business OS.

### API keys (Places / Maps)

| Mode | Where keys live |
|------|-----------------|
| **Standalone** | Prospecting → Settings (`google_places_api_key`, `google_maps_api_key`) |
| **Platform (multi-tenant)** | Operator: Manager → **Integrations** → Google Places / Maps. New sites get keys at provision. Runtime: tenant Settings first, then `bos_google_*` site_config. |

Details: [`DEPLOY.md`](./DEPLOY.md) (this repo) and `docs/INTEGRATIONS.md` in the
`platform_control` / business_os_manager control-plane repo.

Server search uses the **Places** key; the map UI uses the **Maps JavaScript** key
(`get_maps_api_key`). Enable Places API (New) + Maps JavaScript API in Google Cloud.

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app prospecting
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/prospecting
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
