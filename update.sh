#!/bin/sh
# Take the language server out of a release of MongoDB for VS Code, from Open VSX:
#   ./update.sh            the latest release
#   ./update.sh 1.18.0     that one
# Only the server, its worker and the notices are kept; the rest of the extension is not.
# patches/apply.js then puts the changes of mongolsp into the server, and stops when one does not
# fit the release any more.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
api=https://open-vsx.org/api/mongodb/mongodb-vscode
version=${1:-$(curl -fsSL "$api/latest" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' | head -n 1)}
[ -n "$version" ] || { echo "update.sh: no version from $api/latest" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$api/$version/file/mongodb.mongodb-vscode-$version.vsix" -o "$tmp/ext.vsix"
unzip -q "$tmp/ext.vsix" 'extension/dist/languageServer*' 'extension/LICENSE.txt' \
    'extension/THIRD_PARTY_NOTICES' -d "$tmp"

mkdir -p "$here/dist"
cp "$tmp"/extension/dist/languageServer.js "$tmp"/extension/dist/languageServer.js.LICENSE.txt \
    "$tmp"/extension/dist/languageServerWorker.js \
    "$tmp"/extension/dist/languageServerWorker.js.LICENSE.txt "$here/dist/"
node "$here/patches/apply.js"
cp "$tmp/extension/LICENSE.txt" "$here/LICENSE"
cp "$tmp/extension/THIRD_PARTY_NOTICES" "$here/THIRD_PARTY_NOTICES"
{
    echo "mongodb-vscode $version"
    sha256sum "$tmp/ext.vsix" | sed "s|$tmp/ext.vsix|mongodb.mongodb-vscode-$version.vsix|"
} > "$here/VERSION"
echo "mongolsp: the server of mongodb-vscode $version"
