#!/usr/bin/env bash
# Called under the fleet deployer's lock, after a successful static build.
set -euo pipefail
site_root="${1:?usage: publish.sh /var/www/adr.stephens.page}"
revision="$(git rev-parse HEAD)"
test -s dist/index.html
test -s dist/404.html
test -s dist/sitemap.xml
mkdir -p "$site_root/releases" "$site_root/assets"
release="$(mktemp -d "$site_root/releases/$revision.XXXXXX")"
cp -a dist/. "$release/"
chmod 755 "$release"
printf '{"revision":"%s"}\n' "$revision" > "$release/version.json"
# Content-addressed Astro assets are copied before switching, and retained.
cp -a dist/_astro/. "$site_root/assets/"
previous="$(readlink "$site_root/current" || true)"
trap 'rm -f "$site_root/current.next"' EXIT
ln -s "$release" "$site_root/current.next"
mv -Tf "$site_root/current.next" "$site_root/current"
if ! curl --fail --silent --show-error --retry 2 --max-time 15 https://adr.stephens.page/version.json | grep -Fq "$revision"; then
  if [[ -n "$previous" ]]; then
    ln -s "$previous" "$site_root/current.next"
    mv -Tf "$site_root/current.next" "$site_root/current"
    printf 'Health check failed; restored %s\n' "$previous" >&2
  fi
  exit 1
fi
printf 'Published %s at %s\n' "$revision" "$release"
