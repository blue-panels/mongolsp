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
  {
    // A string that names a collection in a pipeline completes the collections, as one of
    // db.getCollection("") does: from of $lookup and $graphLookup, coll of $unionWith and $out,
    // into of $merge, and $unionWith, $merge, $out given a string.  The server took such a string
    // for a value of a field, $name or $$name, and offered no collection.  The mark of the
    // cursor in the string, l, makes it the place; the parent of the object is the stage.
    name: "collection-strings",
    file: "dist/languageServer.js",
    find:
      '_visitObjectExpression(e){"ObjectExpression"===e.node.type&&(' +
      "this._checkIsObjectKey(e.node),this._checkIsIdentifierObjectValue(e.node)," +
      "this._checkIsTextObjectValue(e.node))}",
    replace:
      '_visitObjectExpression(e){"ObjectExpression"===e.node.type&&(' +
      "this._checkIsObjectKey(e.node),this._checkIsIdentifierObjectValue(e.node)," +
      "this._checkIsCollectionString(e)||this._checkIsTextObjectValue(e.node))}" +
      "_checkIsCollectionString(e){" +
      'const k=t=>"Identifier"===t.type?t.name:"StringLiteral"===t.type?t.value:null,' +
      's=t=>"StringLiteral"===t.type&&t.value.includes(l)||"TemplateLiteral"===t.type&&' +
      "1===t.quasis.length&&t.quasis[0].value.raw.includes(l)," +
      'p=e.parent&&"ObjectProperty"===e.parent.type?k(e.parent.key):null,' +
      'f=e.node.properties.some(t=>{if("ObjectProperty"!==t.type||!s(t.value))return!1;' +
      "const n=k(t.key);" +
      'return"$unionWith"===n||"$merge"===n||"$out"===n||' +
      '"from"===n&&("$lookup"===p||"$graphLookup"===p)||' +
      '"coll"===n&&("$unionWith"===p||"$out"===p)||"into"===n&&"$merge"===p});' +
      'return f&&"isCollectionName"in this._state&&' +
      "(this._state.isCollectionName=!0,this._state.isCollectionString=!0),f}",
    needs: 'l="TRIGGER_CHARACTER";t.Visitor=class Visitor',
  },
  {
    // the collections of such a string go in as they are, the string around them kept: the
    // server writes a name that is no identifier as ['name'], for db. alone
    name: "collection-strings-items",
    file: "dist/languageServer.js",
    find:
      "_provideCollectionNameCompletionItems(e,t,n){if(e.isCollectionName&&e.databaseName)" +
      'return this._connection.console.log("VISITOR found collection name completions"),',
    replace:
      "_provideCollectionNameCompletionItems(e,t,n){" +
      "if(e.isCollectionString&&e.databaseName)" +
      'return this._connection.console.log("VISITOR found collection name completions"),' +
      "(this._collections[e.databaseName]||[]).map(c=>" +
      "({label:c,kind:u.CompletionItemKind.Folder,preselect:!0}));" +
      "if(e.isCollectionName&&e.databaseName)" +
      'return this._connection.console.log("VISITOR found collection name completions"),',
    // the module of the completion items of the server is u
    needs: "kind:u.CompletionItemKind.Folder,preselect:!0}:{label:e,kind:u.CompletionItemKind.Folder",
  },
  {
    // The fields of $lookup and $graphLookup complete the fields of their collection, without
    // the $ of a field path: localField those of the collection of the pipeline; foreignField,
    // connectFromField and connectToField those of the collection of from.  The server offered
    // the $fields of the collection of the pipeline there.  Made on the visit of
    // collection-strings, before it.
    name: "lookup-fields",
    file: "dist/languageServer.js",
    find: "this._checkIsCollectionString(e)||this._checkIsTextObjectValue(e.node))}",
    replace:
      "this._checkIsCollectionString(e)||this._checkIsLookupField(e)||" +
      "this._checkIsTextObjectValue(e.node))}" +
      "_checkIsLookupField(e){" +
      'const k=t=>"Identifier"===t.type?t.name:"StringLiteral"===t.type?t.value:null,' +
      's=t=>"StringLiteral"===t.type&&t.value.includes(l)||"TemplateLiteral"===t.type&&' +
      "1===t.quasis.length&&t.quasis[0].value.raw.includes(l)," +
      'p=e.parent&&"ObjectProperty"===e.parent.type?k(e.parent.key):null;' +
      'if("$lookup"!==p&&"$graphLookup"!==p)return!1;' +
      'const r=e.node.properties.find(t=>"ObjectProperty"===t.type&&s(t.value));' +
      "if(!r)return!1;const n=k(r.key);" +
      'if("localField"!==n&&"foreignField"!==n&&"connectFromField"!==n&&"connectToField"!==n)' +
      "return!1;" +
      'const f=e.node.properties.find(t=>"ObjectProperty"===t.type&&"from"===k(t.key)&&' +
      '"StringLiteral"===t.value.type);' +
      'this._state.isFieldString=!0;this._state.fieldCollection="localField"===n?null:' +
      "f?f.value.value:void 0;return!0}",
    needs: "_checkIsCollectionString(e){",
  },
  {
    // the fields of the collection of such a string are read as those of the pipeline are, and
    // go in as they are, in the string
    name: "lookup-fields-items",
    file: "dist/languageServer.js",
    find:
      "await this._getCompletionValuesAndUpdateCache(n.databaseName,n.collectionName);",
    replace:
      "await this._getCompletionValuesAndUpdateCache(n.databaseName,n.collectionName);" +
      "if(n.isFieldString&&n.databaseName){" +
      "const c=null===n.fieldCollection?n.collectionName:n.fieldCollection;" +
      "c&&c!==n.collectionName&&await this._getCompletionValuesAndUpdateCache(n.databaseName,c);" +
      'this._connection.console.log("VISITOR found lookup field completions");' +
      "return(c&&this._fields[`${n.databaseName}.${c}`]||[]).map(f=>" +
      "({label:f,kind:u.CompletionItemKind.Field,preselect:!0}))}",
    needs: "kind:u.CompletionItemKind.Folder,preselect:!0}:{label:e,kind:u.CompletionItemKind.Folder",
  },
  {
    // Code typed and not finished completes too: a file that does not parse is parsed again
    // as its text up to the mark of the cursor, l, with the string it is in and the brackets
    // open there closed.  The server parsed the whole file and completed nothing in it, so a
    // string or a pipeline not closed yet, from: "co, had no completion at all.  The text
    // after the cursor is left out: the completion is of what is before it.
    name: "complete-unfinished",
    file: "dist/languageServer.js",
    find:
      'parseAST({textFromEditor:e,selection:t}){let n;this._selection=t;' +
      'try{n=a.parse(e,{sourceType:"module"})}catch(e){}',
    replace:
      'parseAST({textFromEditor:e,selection:t}){let n;this._selection=t;' +
      'try{n=a.parse(e,{sourceType:"module"})}catch(r){const m=e.indexOf(l);' +
      "if(m>=0){const x=e.slice(0,m+l.length);let q=null,c=0;const s=[];" +
      "for(let i=0;i<x.length;i++){const h=x[i];" +
      'if(1===c){"\\n"===h&&(c=0);continue}' +
      'if(2===c){"*"===h&&"/"===x[i+1]&&(c=0,i++);continue}' +
      'if(q){"\\\\"===h?i++:h===q?q=null:"\\n"===h&&"`"!==q&&(q=null);continue}' +
      'if("/"===h&&"/"===x[i+1]){c=1,i++;continue}' +
      'if("/"===h&&"*"===x[i+1]){c=2,i++;continue}' +
      'if(\'"\'===h||"\'"===h||"`"===h){q=h;continue}' +
      '"("===h?s.push(")"):"["===h?s.push("]"):"{"===h?s.push("}"):' +
      '(")"===h||"]"===h||"}"===h)&&s.pop()}' +
      'try{n=a.parse(x+(q||"")+s.reverse().join(""),{sourceType:"module"})}catch(o){}}}',
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
