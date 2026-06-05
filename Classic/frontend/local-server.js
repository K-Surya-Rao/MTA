const http = require("http");
const fs = require("fs");
const path = require("path");

const base = __dirname;
const port = 3000;
const host = "127.0.0.1";

const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";

    const file = path.resolve(base, `.${urlPath}`);
    if (!file.startsWith(base)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.readFile(file, (error, data) => {
        if (error) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }

        res.writeHead(200, {
            "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
        });
        res.end(data);
    });
});

server.listen(port, host, () => {
    console.log(`My Trade Audit is running at http://${host}:${port}`);
});
