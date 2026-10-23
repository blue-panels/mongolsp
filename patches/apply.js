#!/usr/bin/env node
// The changes of mongolsp to the server of the extension, put into dist/ by update.sh.
// Each is an exact text of the build and what takes its place: a text found other than once,
// in another release of the extension, stops it, and the change is to be looked at again.
// A change put already is left as it is.
"use strict";

const fs = require("fs");
const path = require("path");

const patches = [
  {
    // db. completes the methods and the collections anywhere, not at the start of a statement
    // alone: "const r = db.", "x = db.", "print(db.)".  The server checks db. on an
    // ExpressionStatement only; the check is put into the visit of every MemberExpression too,
    // for the db. under the cursor, where the server put its mark, TRIGGER_CHARACTER, held by l.
    name: "db-member",
    file: "dist/languageServer.js",
    find:
      '_visitMemberExpression(e){"MemberExpression"===e.node.type&&(' +
      "this._checkHasAggregationCall(e.node),",
    replace:
      '_visitMemberExpression(e){"MemberExpression"===e.node.type&&(' +
      '"Identifier"===e.node.object.type&&"db"===e.node.object.name&&' +
      '"Identifier"===e.node.property.type&&e.node.property.name.includes(l)&&' +
      '"isDbSymbol"in this._state&&(this._state.isDbSymbol=!0),' +
      "this._checkHasAggregationCall(e.node),",
    // the mark the server puts at the cursor is l of the module of the visitor
    needs: 'l="TRIGGER_CHARACTER";t.Visitor=class Visitor',
  },
];

function count(text, part) {
  let n = 0;
  for (let at = text.indexOf(part); at >= 0; at = text.indexOf(part, at + part.length)) n++;
  return n;
}

const root = path.resolve(__dirname, "..");
let failed = false;
for (const p of patches) {
  const file = path.join(root, p.file);
  let text = fs.readFileSync(file, "utf8");
  if (count(text, p.replace) === 1) {
    console.log(`${p.name}: put already`);
    continue;
  }
  const found = count(text, p.find);
  if (found !== 1 || count(text, p.needs) !== 1) {
    console.error(`${p.name}: the text of ${p.file} is found ${found} times, its mark ` +
                  `${count(text, p.needs)} times, not once: look at the change again`);
    failed = true;
    continue;
  }
  text = text.replace(p.find, p.replace);
  fs.writeFileSync(file, text);
  console.log(`${p.name}: put`);
}
process.exit(failed ? 1 : 0);
