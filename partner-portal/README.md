# Mutakamel Partner Portal

This workspace is intentionally a minimal, static placeholder. Partner authentication, APIs, navigation, and workflows are not implemented because the Partner Portal remains future scope and has no approved delivery contract.

Do not copy Tenant Portal features into this app. Implementation can begin only after the Partner release slice and its public API, session, authorization, and acceptance contracts are approved.

## Local commands

Use the frontend pnpm workspace as the single package-manager owner:

```bash
pnpm install
pnpm run dev
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
```

The development and production servers are fixed to [http://localhost:5003](http://localhost:5003).
