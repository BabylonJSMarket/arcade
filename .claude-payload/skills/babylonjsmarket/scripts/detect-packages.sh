#!/usr/bin/env bash
# detect-packages.sh — report which @babylonjsmarket/* packages are installed
# in the *consumer's* project, so a skill can limit itself to the real API
# surface instead of guessing.
#
# Walks up from the current directory (or $1) to the nearest
# node_modules/@babylonjsmarket and prints each installed package as
# "name@version", one per line, alphabetically. Prints "NONE" if no
# @babylonjsmarket packages are installed. Always exits 0 — absence is data,
# not an error. Read stdout; that is the whole contract.

set -euo pipefail

start_dir="${1:-$PWD}"
dir="$start_dir"

emit_scope() {
  scope="$1"
  found=1
  for pkg_json in "$scope"/*/package.json; do
    [ -e "$pkg_json" ] || continue
    found=0
    if command -v node >/dev/null 2>&1; then
      node -e 'const p=require(process.argv[1]);process.stdout.write(`${p.name}@${p.version}\n`)' "$pkg_json"
    else
      name=$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$pkg_json" | head -1)
      ver=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$pkg_json" | head -1)
      printf '%s@%s\n' "$name" "$ver"
    fi
  done
  return $found
}

while :; do
  scope="$dir/node_modules/@babylonjsmarket"
  if [ -d "$scope" ] && emit_scope "$scope"; then
    exit 0
  fi
  parent="$(dirname "$dir")"
  [ "$parent" = "$dir" ] && break
  dir="$parent"
done

echo "NONE"
exit 0
