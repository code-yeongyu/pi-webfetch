import { Readable, type ReadableOptions } from "node:stream";
import { describe, expect, it } from "vitest";

import { discardBody } from "../src/webfetch/fetcher.js";

type MinimalBody = {
	destroy(error?: Error): void;
	dump?(options?: { limit: number; signal?: AbortSignal }): Promise<void>;
};

function streamWithoutDump(chunks: string[], options?: ReadableOptions): Readable & MinimalBody {
	const stream = new Readable(options ?? {});
	for (const chunk of chunks) {
		stream.push(chunk);
	}
	stream.push(null);
	return stream as Readable & MinimalBody;
}

describe("discardBody", () => {
	it("#given body without dump #when discarding #then resolves and drains the stream", async () => {
		// given
		const body = streamWithoutDump(["hello ", "world"]);

		// when
		await expect(discardBody(body)).resolves.toBeUndefined();

		// then
		expect(body.readableEnded).toBe(true);
	});

	it("#given body without dump that errors mid-stream #when discarding #then resolves without surfacing the error", async () => {
		// given
		const body = streamWithoutDump(["partial"]);
		const failure = new Error("stream exploded");
		queueMicrotask(() => body.destroy(failure));

		// when
		await expect(discardBody(body)).resolves.toBeUndefined();

		// then
		expect(body.destroyed).toBe(true);
	});

	it("#given dump-capable body #when discarding #then uses dump instead of manual drain", async () => {
		// given
		let dumped = false;
		const body = streamWithoutDump(["ignored"]);
		body.dump = async () => {
			dumped = true;
		};

		// when
		await discardBody(body);

		// then
		expect(dumped).toBe(true);
	});

	it("#given already destroyed body #when discarding #then resolves", async () => {
		// given
		const body = streamWithoutDump(["unused"]);
		body.destroy();

		// when / then
		await expect(discardBody(body)).resolves.toBeUndefined();
		expect(body.destroyed).toBe(true);
	});

	it("#given abort during drain #when discarding #then resolves without hanging", async () => {
		// given
		const body = new Readable({
			read() {
				// Keep the iterator pending until abort.
			},
		}) as Readable & MinimalBody;
		const controller = new AbortController();
		queueMicrotask(() => controller.abort());

		// when / then
		await expect(discardBody(body, controller.signal)).resolves.toBeUndefined();
		expect(body.destroyed).toBe(true);
	});
});
