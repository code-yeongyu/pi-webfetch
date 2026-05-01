import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Static } from "typebox";
import { afterEach, describe, expect, it } from "vitest";

import { webfetch } from "../src/webfetch/tool.js";

type RouteHandler = (request: IncomingMessage, response: ServerResponse) => void;

const servers: Array<{ close: () => Promise<void> }> = [];

async function createFixtureServer(handler: RouteHandler): Promise<{ baseUrl: string; close: () => Promise<void> }> {
	const server = createServer(handler);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (typeof address !== "object" || address === null) {
		throw new Error("Expected TCP server address");
	}
	const fixture = {
		baseUrl: `http://127.0.0.1:${address.port}`,
		close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
	};
	servers.push(fixture);
	return fixture;
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
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

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
});
