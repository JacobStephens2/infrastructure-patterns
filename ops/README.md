# Website operations

The public collection is at <https://adr.stephens.page/>. Astro generates a
static site from the existing repository content. No application server or
database runs in production.

## Content and local development

Use Node 22.22.0 or newer, then:

```sh
npm ci
npm run dev
```

Keep writing records in `adr/`. Add each record to a topic table in the root
README with its one-line trade-off. The site reads the title and full text from
the record, and the topic, summary, and Start here selection from the README.
An uncategorized record fails the build. Companion pages read the existing
case study, threat model, checklist, and observability README directly.

```sh
npm run check
npm run build
npx playwright install chromium
npm test
```

The browser tests exercise the built site: every record, local links and
anchors, full-text search combined with topics, reloadable filter URLs,
JavaScript-free reading, phone layout, and search under the production content
security policy. Tests serve `dist/` with Python 3. Asset inlining is disabled
in `astro.config.mjs` so scripts work with Apache's same-origin policy.

## Deployment

`.github/workflows/deploy.yml` checks, builds, and tests pull requests and every
push to `main`. After successful checks on `main`, it sends the triggering SHA
over SSH using the repository's `DEPLOY_KEY` secret. The SSH host identity is
pinned. The key is restricted to
`/usr/local/bin/site-deploy infrastructure-patterns` and cannot open a shell.

The existing fleet deployer serializes deployment, requires a clean checkout
on `main`, and fast-forwards to the requested commit on `origin/main`. The
registry entry is in `site-deploy.toml`; the installed registry lives outside
the checkout at `/etc/site-deploy/sites.toml`.

- Checkout: `/var/www/adr.stephens.page/checkout`
- Static releases: `/var/www/adr.stephens.page/releases/<sha>.<suffix>/`
- Document root: `/var/www/adr.stephens.page/current` (an atomic symlink)
- Retained hashed CSS/JS: `/var/www/adr.stephens.page/assets/`
- Public serving revision: <https://adr.stephens.page/version.json>
- Deployment log: `/var/log/site-deploy/infrastructure-patterns.log`

The server installs locked dependencies, typechecks, and builds before
`scripts/publish.sh` copies the complete output into a new release. It switches
`current` atomically, verifies the served revision over HTTPS, and restores the
previous symlink if that check fails. Content-addressed assets remain available
across releases so open tabs can still load them. Old release directories are
retained for attended recovery; review disk usage before pruning them.

The fleet deployer treats an already-checked-out commit as deployed and skips
builds for changes confined to `.github/`. After a failed build, rerunning the
workflow at the same SHA does not retry those after-commands. Recover explicitly:

```sh
ssh jacob@stephens.page
cd /var/www/adr.stephens.page/checkout
flock /var/lib/site-deploy/global.lock \
  flock /var/lib/site-deploy/infrastructure-patterns.lock \
  bash -c '
    set -euo pipefail
    test -z "$(git status --porcelain)"
    npm ci --no-audit --no-fund
    npm run check
    npm run build
    bash scripts/publish.sh /var/www/adr.stephens.page
  '
```

These commands rebuild the checkout's current revision. For a failed
publication, the previous static release stays live until a later publication
succeeds. Verify `version.json` as well as the deploy log.

## Host provisioning

1. Create the site directory owned by `jacob`, and clone this repository into
   its `checkout/` subdirectory on `main`.
2. Append `site-deploy.toml` to `/home/jacob/site-deploy/sites.toml`, then install
   that registry at `/etc/site-deploy/sites.toml` as root. Do not replace sibling
   sites' entries.
3. Run the fleet's `provision.sh infrastructure-patterns` as `jacob`. It adds
   the restricted key and uploads `DEPLOY_KEY` to this GitHub repository.
4. Install and enable `apache/adr.stephens.page.conf`. Verify Apache's config
   before a graceful reload.
5. Issue the TLS certificate with Certbot's webroot flow at `/var/www/html`,
   then install and enable `apache/adr.stephens.page-ssl.conf`. Existing Certbot
   renewal handles this certificate too.
6. After verifying the new site, install `apache/legacy-decisions.conf` in
   `/etc/apache2/stephens.page.d/` and reload Apache. The main site's existing
   include loads this file. Old record URLs keep their slugs on the new host;
   withdrawn records use the site's explanatory 404 page.

Apache serves only static output. The checkout and repository metadata are
outside its document root. The configurations and fleet registry require an
attended installation; merging website changes does not update host authority.
