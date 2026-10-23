# mongolsp

The language server of [MongoDB for VS Code](https://github.com/mongodb-js/vscode), taken out
of the extension to run on its own, for any editor that speaks LSP. It completes the methods of
`db`, of collections and cursors, the stages of a pipeline and the query operators, and, with a
connection to a database, the names of its collections and the fields of their documents.

This is no product of MongoDB, Inc. and is not supported by it. The server is the one of the
extension as released, not changed; only the scripts around it are new. "MongoDB" is a
trademark of MongoDB, Inc.

## Installing it

It needs Node.js 18 or later (`apt install nodejs`); an editor finds `mongolsp` in PATH.

Debian, Ubuntu: the package of a [release](https://github.com/blue-panels/mongolsp/releases),
the server in `/usr/share/mongolsp`, `mongolsp` in `/usr/bin`:

```
sudo apt install ./mongolsp_1.18.0-1_all.deb
```

Elsewhere, from the archive of a release or a clone of this repository:

```
./install.sh                 ~/.local/share/mongolsp, and ~/.local/bin/mongolsp
sudo ./install.sh /usr/local  for all users
./install.sh --uninstall     takes it away again
```

coole has it in its lsp.json: `coole -Q` completes the queries with it once it is in PATH.

## What is here

```
dist/languageServer.js         the server, built by the extension (webpack), not changed
dist/languageServerWorker.js   the worker the server starts to run code
dist/*.LICENSE.txt             the licenses of what the build bundles
bin/mongolsp                   runs the server on stdin and stdout
install.sh                     installs it under a prefix, ~/.local by default
packaging/build-deb.sh         builds the Debian package
update.sh                      takes the server out of a release of the extension
test/smoke.py                  asks the server for completions, as an editor does
VERSION                        the release of the extension, and the sha256 of its .vsix
```

## Running it

It needs Node.js 18 or later; `bin/mongolsp` turns on the global `crypto` that Node 18 has
not, and the driver needs to connect.

```
bin/mongolsp            the server, on stdin and stdout
```

The documents are JavaScript, `languageId` "javascript", of any name.

## Connecting to a database

After `initialize` the server takes two requests of its own, as the extension sends them:

```
INITIALIZE_MONGODB_SERVICE  { "extensionPath": "<this directory>", "connectionId": null }
ACTIVE_CONNECTION_CHANGED   { "connectionId": "<any name>",
                              "connectionString": "mongodb://...",
                              "connectionOptions": {} }
```

The second answers `{ "successfullyConnected": true, ... }`; the server then lists the
databases. The connection string reaches the server on its stdin: it is on no command line.

The database of the names after `db.` is the one of a line `use("name")` above the cursor;
without one, `db.` completes the methods alone. The fields of a collection are read from one
of its documents, the first time they are asked for, and kept.

## Running code

`EXECUTE_CODE_FROM_PLAYGROUND { "connectionId", "codeToEvaluate", "filePath" }` runs code in
`dist/languageServerWorker.js`, a thread of the server with a connection of its own: what
`print()` prints comes as notifications `SHOW_CONSOLE_OUTPUT`, the value as the answer, a
document of BSON in base64. Without the worker the server ends at the first such request.

## The checks

```
test/smoke.py                                    without a database
MC_MONGO_URI=mongodb://... MC_MONGO_DB=name test/smoke.py
```

`MONGOLSP=/usr/bin/mongolsp test/smoke.py` asks an installed server.

## Another release

```
./update.sh             the latest release on Open VSX
./update.sh 1.18.0      that one
```

A tag of the version of the package, `v1.18.0-1`, makes a release of the workflow Build: the
package and the archive of the sources. A release of the same extension with a change of
mongolsp alone is `v1.18.0-2`.

## License

Apache License 2.0, as the extension: see `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES` and
`dist/*.LICENSE.txt`. The scripts of this repository are under the same license.
