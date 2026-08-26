import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { fetchUrl } from "./fetcher.js";

const servers: Server[] = [];

async function createFixtureServer(): Promise<string> {
	const server = createServer((request, response) => {
		if (request.url === "/start") {
			response.writeHead(302, {
				location: "/final",
				"content-type": "text/plain; charset=utf-8",
			});
			response.end("redirecting");
			return;
		}

		response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
		response.end("ready");
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (typeof address !== "object" || address === null) {
		throw new Error("Expected TCP server address");
	}
	servers.push(server);
	return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
	await Promise.all(
		servers.splice(0).map(
			(server) =>
				new Promise<void>((resolve, reject) => {
					server.close((error) => (error ? reject(error) : resolve()));
				}),
		),
	);
});

describe("fetchUrl", () => {
	it("discards a response body without dump", async () => {
		// given
		const baseUrl = await createFixtureServer();

		// when
		const result = await fetchUrl({
			url: `${baseUrl}/start`,
			format: "text",
			timeoutSeconds: 1,
		});

		// then
		expect(new TextDecoder().decode(result.body)).toBe("ready");
		expect(result.url).toBe(`${baseUrl}/final`);
	});
});
