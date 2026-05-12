import { describe, expect, it, vi } from "vitest";
import webfetchExtension, { isWebfetchEnabled } from "../src/index.js";

const ENABLE_ENV = "PI_WEBFETCH";

describe("webfetch extension toggle", () => {
	it("returns true when PI_WEBFETCH is unset", () => {
		delete process.env[ENABLE_ENV];
		expect(isWebfetchEnabled()).toBe(true);
	});

	it.each(["1", "true", "yes", "on", " TRUE ", "\tYeS\n"])(
		"returns true for truthy PI_WEBFETCH value %s",
		(envValue) => {
			process.env[ENABLE_ENV] = envValue;
			expect(isWebfetchEnabled()).toBe(true);
		},
	);

	it.each(["0", "false", "no", "off", " OFF ", "\nNo\t"])(
		"returns false for falsy PI_WEBFETCH value %s",
		(envValue) => {
			process.env[ENABLE_ENV] = envValue;
			expect(isWebfetchEnabled()).toBe(false);
		},
	);

	it("returns true for unknown PI_WEBFETCH values", () => {
		process.env[ENABLE_ENV] = "definitely";
		expect(isWebfetchEnabled()).toBe(true);
	});

	it("is a no-op when PI_WEBFETCH is disabled", () => {
		process.env[ENABLE_ENV] = "0";
		const registerTool = vi.fn();
		webfetchExtension({ registerTool } as never);
		expect(registerTool).not.toHaveBeenCalled();
	});

	it("registers the webfetch tool when PI_WEBFETCH is unset", () => {
		delete process.env[ENABLE_ENV];
		const registerTool = vi.fn();
		webfetchExtension({ registerTool } as never);
		expect(registerTool).toHaveBeenCalledTimes(1);
	});
});
