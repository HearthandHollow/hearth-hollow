# Forge OTA auto-deploy

`forge-autodeploy.sh` keeps the self-hosted production site on forge in sync
with `main` automatically: a root cron job polls GitHub every 5 minutes (the
repo is public, so no auth is needed), and when `main` has a new commit it
downloads the tarball, overlays the forge-only files (`app/Dockerfile`,
`app/.dockerignore`, `app/.env.production`), rebuilds `hearthhollow-app:latest`,
restarts only the `app` compose service, health-checks `localhost:3005`, and
**rolls back to the previous image if the app doesn't come back healthy**.

With this installed, merging a PR to `main` IS the deploy — the live site
updates within ~5 minutes plus build time. (Vercel continues to auto-deploy
its shadow copy independently.)

## Install (once, as root on forge)

```sh
cp deploy/forge-autodeploy.sh /opt/stacks/hearthhollow/autodeploy.sh
chmod +x /opt/stacks/hearthhollow/autodeploy.sh
( crontab -l 2>/dev/null; echo '*/5 * * * * /opt/stacks/hearthhollow/autodeploy.sh' ) | crontab -
```

## Operational notes

- Log: `/var/log/hearthhollow-autodeploy.log` (build output included).
- State: `/opt/stacks/hearthhollow/.last-deployed-sha`. Seed it with the
  currently-deployed commit sha at install time to avoid an immediate
  redundant rebuild, or leave it absent to force one initial deploy.
- Lock: `flock` on `.autodeploy.lock` — overlapping cron fires are no-ops.
- Backups: the last two source dirs are kept as `app.old.<ts>`; a failed
  deploy leaves its source at `app.failed.<ts>` for inspection.
- The script never touches the database, the `db`/`cloudflared` services, or
  the env files.
- If the repo is ever made private, polling 404s (logged); switch to a token
  or manual tarballs.
- DB migrations are the one thing this does NOT handle: if a merge changes
  `prisma/schema.prisma`, run `docker exec hearthhollow-app npx prisma db push`
  after the deploy lands (the forge image build intentionally skips db push).
