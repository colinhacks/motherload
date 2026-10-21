#!/usr/bin/env bash
# Run by the maintainer in a terminal before the release that first ships a package: put every
# Motherload package missing from npm on it and point its trusted publisher at
# .github/workflows/release.yml, so that workflow can stage it (DESIGN.md, "Releasing"). From nub's
# scripts/npm-first-publish-runner.sh, which did the same for nub's runner packages.
#
#   bash scripts/npm-first-publish.sh
#
# npm's trusted publishing cannot make a package's first publish: a trusted publisher can be configured
# only on a package that exists (`npm help trust`: "Package must exist"). So each package missing from
# the registry is published once as a 0.0.0 placeholder, which sorts below every release, as
# `motherload@0.0.0` already is; then each package trusts release.yml in colinhacks/motherload, on its
# `npm` environment, for `npm stage publish` alone. The workflow can then fill npm's staged queue and
# nothing else; a version is served only once the maintainer approves it with 2FA (`stager`).
#
# The npm login is made for this run alone: npm's browser login, saved to a private file rather than
# ~/.npmrc, logged out and deleted when the script exits. One authenticator code serves every command
# while npm accepts it; when npm refuses it as expired, the script asks for the next one and carries on.
# Safe to run again: a package that exists is not published again, and a trust already in place is
# checked, not created.
set -euo pipefail

repo=colinhacks/motherload
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

v="$(npm --version)"
[ "$(printf '%s\n11.15.0\n' "$v" | sort -V | head -1)" = "11.15.0" ] || { echo "npm $v cannot configure a stage-only trusted publisher (need >= 11.15)"; exit 1; }

names=("$(nub --node -p "require('$root/package.json').name")")
for manifest in "$root"/packages/*/package.json; do names+=("$(nub --node -p "require('$manifest').name")"); done

work="$(mktemp -d)"
cfg="$work/npmrc"
last="$work/last"
touch "$cfg"
chmod 600 "$cfg"
cleanup() {
  if grep -q '_authToken' "$cfg" 2>/dev/null; then
    npm logout --userconfig "$cfg" > /dev/null 2>&1 && echo "logged out of npm" || echo "npm logout failed; revoke this machine's newest token at https://www.npmjs.com/settings/~/tokens"
  fi
  rm -rf "$work"
}
trap cleanup EXIT

echo "Sign in to npm in the browser (the login lasts for this run only):"
npm login --auth-type=web --userconfig "$cfg"
user="$(npm whoami --userconfig "$cfg")"
echo "signed in as $user"

code=""
# Runs an npm command that needs the account's 2FA with the last code given, its output in $last. When npm
# refuses the code, it asks for the next one and runs the command again; a refused code is never sent twice.
npm2fa() {
  while :; do
    if [ -z "$code" ]; then
      read -rsp "One-time code from the authenticator for $user: " code < /dev/tty
      echo
    fi
    if npm "$@" --userconfig "$cfg" --otp="$code" < /dev/null > "$last" 2>&1; then return 0; fi
    if grep -qiE 'EOTP|one-time pass' "$last"; then
      echo "npm refused that code (expired); enter the next one."
      code=""
      continue
    fi
    return 1
  done
}

# The package's trusted publisher is release.yml in colinhacks/motherload, on its `npm` environment.
trusted() {
  npm2fa trust list "$1" --json || return 1
  grep -q "\"repository\": \"$repo\"" "$last" && grep -q '"file": "release.yml"' "$last" && grep -q '"environment": "npm"' "$last"
}

for name in "${names[@]}"; do
  if [ -n "$(npm view "$name" version 2>/dev/null)" ]; then
    echo "✓ $name exists"
    continue
  fi
  dir="$work/placeholder-${name//\//-}"
  mkdir -p "$dir"
  cat > "$dir/package.json" <<EOF
{
  "name": "$name",
  "version": "0.0.0",
  "description": "A placeholder: the first release of Motherload follows. https://motherload.dev",
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/$repo.git" }
}
EOF
  printf '# %s\n\nA placeholder: the first release of [Motherload](https://motherload.dev) follows.\n' "$name" > "$dir/README.md"
  echo "→ publishing $name@0.0.0, a placeholder"
  npm2fa publish "$dir" --access public || { cat "$last"; echo "publishing $name@0.0.0 failed"; exit 1; }
done

for name in "${names[@]}"; do
  if trusted "$name"; then
    echo "✓ $name trusts $repo release.yml on the npm environment"
    continue
  fi
  echo "→ trusting $repo release.yml, environment npm, stage-only, for $name"
  # Stage-only: --allow-publish would let a stolen push credential publish directly, which is how nub's unauthorized v0.9.4 shipped.
  if ! npm2fa trust github "$name" --file release.yml --repo "$repo" --env npm --allow-stage-publish -y; then
    cat "$last"
    echo "trusting $name failed. npm keeps one trusted publisher per package: if one is already configured, read its id with \`npm trust list $name\`, revoke it with \`npm trust revoke $name --id <id>\`, and run this again."
    exit 1
  fi
  sleep 2
  trusted "$name" || { cat "$last"; echo "$name does not trust $repo release.yml on the npm environment after the command; inspect it with \`npm trust list $name\`"; exit 1; }
  echo "✓ $name trusts $repo release.yml on the npm environment"
  # npm's docs ask for a pause between trust calls, to stay under its rate limit
  sleep 2
done

echo "done: all ${#names[@]} packages exist on npm and trust $repo release.yml"
