import http from "node:http";

const port = Number(process.env.STRIPE_MOCK_PORT ?? 4010);

const server = http.createServer((request, response) => {
  const url = request.url ?? "";
  if (request.method === "POST" && url.startsWith("/v1/checkout/sessions")) {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const params = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
      const id = `cs_mock_${Date.now()}`;
      const success = params.get("success_url") ?? "http://127.0.0.1:3000/portal";
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id, url: success, status: "open" }));
    });
    return;
  }
  if (request.method === "GET" && url.startsWith("/v1/checkout/sessions/")) {
    const id = decodeURIComponent(url.split("/").pop() ?? "");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ id, status: "open", url: "http://127.0.0.1:3000/portal" }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end("{}");
});

server.listen(port, "127.0.0.1");
