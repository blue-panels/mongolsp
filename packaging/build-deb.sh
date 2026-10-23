#!/bin/sh
# Build the Debian package of mongolsp, for all architectures, with dpkg-deb alone:
#   packaging/build-deb.sh [output directory]     ./ by default
# The version is that of the extension in VERSION, "-N" the revision of the package
# (MONGOLSP_REVISION, 1 by default).
set -eu

here=$(cd "$(dirname "$0")/.." && pwd)
out=$(cd "${1:-.}" && pwd)
upstream=$(sed -n 's/^mongodb-vscode \(.*\)$/\1/p' "$here/VERSION")
version=$upstream-${MONGOLSP_REVISION:-1}
[ -n "$upstream" ] || { echo "build-deb.sh: no version in VERSION" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
root=$tmp/mongolsp
share=$root/usr/share/mongolsp
doc=$root/usr/share/doc/mongolsp

mkdir -p "$share/bin" "$share/dist" "$root/usr/bin" "$doc" "$root/DEBIAN"
cp "$here"/dist/languageServer.js "$here"/dist/languageServer.js.LICENSE.txt \
    "$here"/dist/languageServerWorker.js "$here"/dist/languageServerWorker.js.LICENSE.txt \
    "$share/dist/"
install -m 755 "$here/bin/mongolsp" "$share/bin/mongolsp"
cp "$here/VERSION" "$share/"
ln -s ../share/mongolsp/bin/mongolsp "$root/usr/bin/mongolsp"
cp "$here/README.md" "$here/NOTICE" "$doc/"
gzip -9n -c "$here/THIRD_PARTY_NOTICES" > "$doc/THIRD_PARTY_NOTICES.gz"
{
    echo "Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/"
    echo "Upstream-Name: mongolsp"
    echo "Source: https://github.com/blue-panels/mongolsp"
    echo
    echo "Files: *"
    echo "Copyright: MongoDB, Inc. (the server in dist/); the authors of mongolsp (the rest)"
    echo "License: Apache-2.0"
    echo " On Debian systems the full text is in /usr/share/common-licenses/Apache-2.0;"
    echo " the notices of what the server bundles are in THIRD_PARTY_NOTICES.gz and in"
    echo " /usr/share/mongolsp/dist/*.LICENSE.txt."
} > "$doc/copyright"

size=$(du -sk "$root/usr" | cut -f1)
cat > "$root/DEBIAN/control" <<EOF
Package: mongolsp
Version: $version
Architecture: all
Maintainer: Ilia Maslakov <il.smind@gmail.com>
Depends: nodejs (>= 18)
Installed-Size: $size
Section: devel
Priority: optional
Homepage: https://github.com/blue-panels/mongolsp
Description: language server of MongoDB for editors that speak LSP
 The language server of MongoDB for VS Code, run on its own: it completes the
 methods of db, of collections and cursors, the stages of a pipeline and the
 query operators, and, connected to a database, its collections and the
 fields of their documents. Not a product of MongoDB, Inc.
EOF

dpkg-deb --root-owner-group --build "$root" "$out/mongolsp_${version}_all.deb" >/dev/null
echo "$out/mongolsp_${version}_all.deb"
