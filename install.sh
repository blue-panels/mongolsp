#!/bin/sh
# Install mongolsp under a prefix, ~/.local by default:
#   ./install.sh                  ~/.local/share/mongolsp, and ~/.local/bin/mongolsp
#   ./install.sh /usr/local       for all users (as root)
#   ./install.sh --uninstall [prefix]
# It needs Node.js 18 or later.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
uninstall=no
if [ "${1:-}" = "--uninstall" ]; then
    uninstall=yes
    shift
fi
prefix=${1:-$HOME/.local}
share=$prefix/share/mongolsp
bin=$prefix/bin/mongolsp

if [ "$uninstall" = yes ]; then
    # only what install.sh put there
    if [ -L "$bin" ] && [ "$(readlink "$bin")" = "$share/bin/mongolsp" ]; then
        rm -f "$bin"
    fi
    rm -rf "$share"
    echo "mongolsp: removed from $prefix"
    exit 0
fi

command -v node >/dev/null 2>&1 || { echo "mongolsp: node is not found; Node.js 18 or later is needed" >&2; exit 1; }
major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge 18 ] || { echo "mongolsp: Node.js $major is too old; 18 or later is needed" >&2; exit 1; }

rm -rf "$share"
mkdir -p "$share/bin" "$share/dist" "$prefix/bin"
cp "$here"/dist/languageServer.js "$here"/dist/languageServer.js.LICENSE.txt \
    "$here"/dist/languageServerWorker.js "$here"/dist/languageServerWorker.js.LICENSE.txt \
    "$share/dist/"
cp "$here/bin/mongolsp" "$share/bin/"
cp "$here/LICENSE" "$here/NOTICE" "$here/THIRD_PARTY_NOTICES" "$here/VERSION" "$share/"
ln -sf "$share/bin/mongolsp" "$bin"
echo "mongolsp: installed in $share, run as $bin"
case ":$PATH:" in
    *":$prefix/bin:"*) ;;
    *) echo "mongolsp: $prefix/bin is not in PATH; an editor finds mongolsp there only when it is" ;;
esac
