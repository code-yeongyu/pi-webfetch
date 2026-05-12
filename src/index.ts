import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { renderWebfetchCall, renderWebfetchResult } from "./webfetch/renderers.js";
import { type WebfetchDetails, webfetch } from "./webfetch/tool.js";

interface ResultLike<TDetails> {
	content: ReadonlyArray<{ type: string; text?: string }>;
	details?: TDetails;
}

const ENABLE_ENV = "PI_WEBFETCH";

function parseEnableEnv(envVar: string): boolean {
	const envValue = process.env[envVar];
	if (!envValue) {
		return true;
	}

	const normalized = envValue.trim().toLowerCase();
	if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
		return false;
	}

	if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
		return true;
	}

	// Unknown values fall back to default-on behavior.
	return true;
}

export function isWebfetchEnabled(): boolean {
	return parseEnableEnv(ENABLE_ENV);
}

/**
 * pi-webfetch — URL retrieval for the pi coding agent.
 *
 * Registers one LLM-callable tool:
 *   - webfetch — fetch URL content as markdown, text, or html.
 */
export default function (pi: ExtensionAPI): void {
	// When PI_WEBFETCH disables the extension, keep factory callable but skip all registration side effects.
	if (!isWebfetchEnabled()) {
		return;
	}

	pi.registerTool({
		...webfetch,
		renderCall: (args, theme) => renderWebfetchCall(args as never, theme),
		renderResult: (result, options, theme) =>
			renderWebfetchResult(result as ResultLike<WebfetchDetails>, options, theme),
	});
}
