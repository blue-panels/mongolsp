#!/usr/bin/env python3
"""Ask mongolsp for completions, as an editor would.

Without MC_MONGO_URI: what it knows with no database, the methods of db, the stages and the
operators.  With MC_MONGO_URI and MC_MONGO_DB: the collections of the database too, and the
fields of the first collection, and a few lines run by the worker of the server,
dist/languageServerWorker.js, which prints and tells the name of the database.  The database is
only read.
"""

import base64
import json
import os
import struct
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(HERE, "..", "bin", "mongolsp")


class Server:
    def __init__(self):
        self.proc = subprocess.Popen([SERVER], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE)
        self.last = 0
        self.printed = []  # what print () of code the worker ran printed

    def send(self, message):
        body = json.dumps(message).encode()
        self.proc.stdin.write(b"Content-Length: %d\r\n\r\n" % len(body) + body)
        self.proc.stdin.flush()

    def read(self):
        head = b""
        while not head.endswith(b"\r\n\r\n"):
            c = self.proc.stdout.read(1)
            if not c:
                sys.exit("mongolsp ended: " + self.proc.stderr.read().decode()[-800:])
            head += c
        length = [l for l in head.split(b"\r\n") if l.lower().startswith(b"content-length")]
        return json.loads(self.proc.stdout.read(int(length[0].split(b":")[1])))

    def request(self, method, params):
        self.last += 1
        self.send({"jsonrpc": "2.0", "id": self.last, "method": method, "params": params})
        while True:
            m = self.read()
            if m.get("id") == self.last and "method" not in m:
                if "error" in m:
                    sys.exit("%s: %s" % (method, m["error"]["message"]))
                return m.get("result")
            if "method" in m and "id" in m:
                self.send({"jsonrpc": "2.0", "id": m["id"], "result": None})
            elif m.get("method") == "SHOW_CONSOLE_OUTPUT":
                self.printed.extend(str(x) for x in m["params"])
            elif m.get("method") == "SHOW_ERROR_MESSAGE":
                self.printed.append("error: %s" % m["params"])

    def notify(self, method, params):
        self.send({"jsonrpc": "2.0", "method": method, "params": params})

    def complete(self, name, text, line, character):
        uri = "file:///tmp/mongolsp-smoke/" + name
        self.notify("textDocument/didOpen", {"textDocument": {
            "uri": uri, "languageId": "javascript", "version": 1, "text": text}})
        position = {"textDocument": {"uri": uri}, "position": {"line": line, "character": character}}
        # the first time in a collection, the server reads its fields
        self.request("textDocument/completion", position)
        time.sleep(1)
        result = self.request("textDocument/completion", position) or []
        items = result["items"] if isinstance(result, dict) else result
        return [i["label"] for i in items]


def bson(data, at=4, end=None):
    """The document of BSON at @at of @data: enough of it for an answer of the worker"""
    end = end if end is not None else len(data) - 1
    doc = {}
    while at < end:
        kind = data[at]
        name_end = data.index(b"\0", at + 1)
        name = data[at + 1:name_end].decode()
        at = name_end + 1
        if kind == 0x02:  # string
            n = struct.unpack_from("<i", data, at)[0]
            doc[name] = data[at + 4:at + 4 + n - 1].decode()
            at += 4 + n
        elif kind in (0x03, 0x04):  # document, array
            n = struct.unpack_from("<i", data, at)[0]
            sub = bson(data, at + 4, at + n - 1)
            doc[name] = list(sub.values()) if kind == 0x04 else sub
            at += n
        elif kind == 0x01:
            doc[name] = struct.unpack_from("<d", data, at)[0]
            at += 8
        elif kind == 0x10:
            doc[name] = struct.unpack_from("<i", data, at)[0]
            at += 4
        elif kind in (0x12, 0x09, 0x11):
            doc[name] = struct.unpack_from("<q", data, at)[0]
            at += 8
        elif kind == 0x08:
            doc[name] = bool(data[at])
            at += 1
        elif kind in (0x0A, 0x06):
            doc[name] = None
        elif kind == 0x07:
            doc[name] = "ObjectId(%s)" % data[at:at + 12].hex()
            at += 12
        else:
            doc[name] = "<BSON type %#x>" % kind
            break
    return doc


def show(what, labels):
    print("%-28s %3d  %s" % (what, len(labels), " ".join(labels[:10])))


def main():
    uri, db = os.environ.get("MC_MONGO_URI"), os.environ.get("MC_MONGO_DB")
    s = Server()
    s.request("initialize", {"processId": os.getpid(), "rootUri": None, "capabilities": {}})
    s.notify("initialized", {})
    s.request("INITIALIZE_MONGODB_SERVICE", {"extensionPath": os.path.dirname(HERE),
                                              "connectionId": None})
    methods = s.complete("a.js", "db.\n", 0, 3)
    show("db.", methods)
    show("find({ $ })", s.complete("b.js", "db.c.find({ $ })\n", 0, 13))
    show("aggregate([{ $ }])", s.complete("c.js", "db.c.aggregate([{ $ }])\n", 0, 19))
    show("find().", s.complete("d.js", "db.c.find().\n", 0, 12))
    if uri and db:
        # the connection string goes to the server on its stdin, not on a command line
        r = s.request("ACTIVE_CONNECTION_CHANGED", {"connectionId": "smoke",
                                                     "connectionString": uri,
                                                     "connectionOptions": {}})
        print("connected:", r)
        use = 'use("%s");\n' % db
        # what db. offers now and did not before: the collections
        collections = [n for n in s.complete("e.js", use + "db.\n", 1, 3) if n not in methods]
        show("use(db); db. collections", collections)
        coll = collections[0] if collections else None
        if coll:
            text = use + "db.%s.find({  })\n" % coll
            show("find({ }) of " + coll,
                 [l for l in s.complete("f.js", text, 1, len("db.%s.find({ " % coll))
                  if not l.startswith("$")])
        # the worker: a thread of the server that connects and runs the code
        r = s.request("EXECUTE_CODE_FROM_PLAYGROUND", {
            "connectionId": "smoke", "filePath": "/tmp/mongolsp-smoke/run.js",
            "codeToEvaluate": use + 'print("printed by the worker"); db.getName()'})
        print("worker printed:", s.printed)
        print("worker answered:", bson(base64.b64decode(r)) if r else r)
    s.proc.kill()


if __name__ == "__main__":
    main()
