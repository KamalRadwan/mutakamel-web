# Mutakamel Admin Portal

Next.js control-plane frontend for Mutakamel platform administrators.

## Development

The fixed application port is `5001`:

```powershell
npm run dev
```

In development, same-origin `/api/*` calls are rewritten to `DEV_API_TARGET`
(the API Gateway, default `http://localhost:9000`). Production does not add this
rewrite; configure `NEXT_PUBLIC_API_URL` or the deployment ingress to reach the
gateway.

## Documentation

Start with:

- [Admin Portal documentation](docs/README.md)
- [Frontend integration guide](docs/frontend-integration-guide.md)
- [Dashboard API contract](docs/api/dashboard.md)

The integration guide identifies live versus mocked screens, backend ownership,
canonical gateway paths, validation rules, enums, RBAC, and known frontend
integration gaps.

Browser requests use:

```text
Core admin:   /api/admin/core/v1/<route>
Worker admin: /api/admin/worker/v1/<route>
```

Do not call unversioned controller-relative `/admin/*` paths from frontend
code.

## Scripts

```powershell
npm run dev
npm run lint
npm run build
npm run start
```

`start` also binds to the fixed port `5001`.
