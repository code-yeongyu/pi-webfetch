import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Static } from "typebox";
import { afterEach, describe, expect, it } from "vitest";

import { webfetch } from "../src/webfetch/tool.js";

type RouteHandler = (request: IncomingMessage, response: ServerResponse) => void;

const servers: Server[] = [];

async function createFixtureServer(handler: RouteHandler): Promise<{ baseUrl: string; server: Server }> {
	const server = createServer(handler);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (typeof address !== "object" || address === null) {
		throw new Error("Expected TCP server address");
	}
	servers.push(server);
	return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

type WebfetchParams = Static<typeof webfetch.parameters>;

async function executeWebfetch(params: WebfetchParams) {
	return webfetch.execute("tool", params, undefined, undefined, undefined as never);
}

function textContent(result: Awaited<ReturnType<typeof executeWebfetch>>): string {
	const first = result.content[0];
	if (!first || first.type !== "text") {
		throw new Error("Expected text content");
	}
	return first.text;
}

afterEach(async () => {
	await Promise.all(servers.splice(0).map(closeServer));
});

function closeServer(server: Server): Promise<void> {
	return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function waitUntil(assertion: () => void): Promise<void> {
	const deadline = Date.now() + 500;
	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			assertion();
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}
	if (lastError instanceof Error) throw lastError;
}

describe("webfetch", () => {
	it("#given html page #when fetching markdown #then returns converted markdown", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(
				"<html><body><h1>Hello Web</h1><p>Alpha <strong>Beta</strong></p><script>bad()</script></body></html>",
			);
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/page`, format: "markdown" });

		// then
		expect(textContent(result)).toContain("# Hello Web");
		expect(textContent(result)).toContain("Alpha **Beta**");
		expect(textContent(result)).not.toContain("bad()");
		expect(result.details?.format).toBe("markdown");
		expect(result.details?.status).toBe(200);
	});

	it("#given html page #when fetching text #then returns readable text without tags", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/html" });
			response.end("<main><h1>Title</h1><p>One&nbsp;Two</p><style>.x{}</style></main>");
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/text`, format: "text" });

		// then
		expect(textContent(result)).toContain("Title");
		expect(textContent(result)).toContain("One Two");
		expect(textContent(result)).not.toContain("<h1>");
		expect(result.details?.format).toBe("text");
	});

	it("#given html page #when fetching html #then returns raw html", async () => {
		// given
		const html = "<h1>Raw</h1><p>HTML</p>";
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/html" });
			response.end(html);
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/raw`, format: "html" });

		// then
		expect(textContent(result)).toBe(html);
		expect(result.details?.contentType).toContain("text/html");
	});

	it("#given invalid scheme #when fetching #then rejects before network access", async () => {
		// given / when / then
		await expect(executeWebfetch({ url: "file:///tmp/secret", format: "markdown" })).rejects.toThrow(
			"URL must start with http:// or https://",
		);
	});

	it("#given oversized content length #when fetching #then rejects and closes the response", async () => {
		// given
		let connectionClosed = false;
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-length": String(6 * 1024 * 1024), "content-type": "text/plain" });
			response.write("oversized");
			response.on("close", () => {
				connectionClosed = true;
			});
		});

		// when / then
		await expect(executeWebfetch({ url: `${server.baseUrl}/large`, format: "text" })).rejects.toThrow(
			"Response too large (exceeds 5MB limit)",
		);
		await waitUntil(() => expect(connectionClosed).toBe(true));
	});

	it("#given oversized stream #when fetching #then rejects and closes the response", async () => {
		// given
		let connectionClosed = false;
		const chunk = Buffer.alloc(1024 * 1024, "x");
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/plain" });
			response.on("close", () => {
				connectionClosed = true;
			});
			for (let index = 0; index < 6; index += 1) {
				response.write(chunk);
			}
		});

		// when / then
		await expect(executeWebfetch({ url: `${server.baseUrl}/stream`, format: "text" })).rejects.toThrow(
			"Response too large (exceeds 5MB limit)",
		);
		await waitUntil(() => expect(connectionClosed).toBe(true));
	});

	it("#given Cloudflare challenge #when retrying #then closes the challenged response", async () => {
		// given
		let challengeClosed = false;
		let requests = 0;
		const server = await createFixtureServer((_request, response) => {
			requests += 1;
			if (requests === 1) {
				response.writeHead(403, { "cf-mitigated": "challenge", "content-type": "text/html" });
				response.write("<h1>challenge</h1>");
				response.on("close", () => {
					challengeClosed = true;
				});
				return;
			}

			response.writeHead(200, { "content-type": "text/plain" });
			response.end("retried");
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/challenge`, format: "text" });

		// then
		expect(textContent(result)).toBe("retried");
		expect(requests).toBe(2);
		expect(challengeClosed).toBe(true);
	});
});
