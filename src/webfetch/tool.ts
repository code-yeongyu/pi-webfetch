import { StringEnum } from "@mariozechner/pi-ai";
import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

import { htmlToMarkdown, htmlToText } from "./content.js";
import { clampTimeout, fetchUrl, type WebfetchFormat } from "./fetcher.js";

const Params = Type.Object({
	url: Type.String({ description: "The URL to fetch content from" }),
	format: Type.Optional(
		StringEnum(["markdown", "text", "html"] as const, {
			description: "The format to return the content in. Defaults to markdown.",
		}),
	),
	timeout: Type.Optional(Type.Number({ description: "Optional timeout in seconds. Maximum 120." })),
});

export interface WebfetchDetails {
	url: string;
	finalUrl: string;
	format: WebfetchFormat;
	status: number;
	statusText: string;
	contentType: string;
	bytes: number;
	timeoutSeconds: number;
	converted: boolean;
	truncated: boolean;
}

export const webfetch = defineTool({
	name: "webfetch",
	label: "Web Fetch",
	description:
		"Fetches content from a URL and returns it as markdown, plain text, or HTML. " +
		"Network use is bounded by timeout and response size limits.",
	promptSnippet: "webfetch: retrieve URL content as markdown, text, or html",
	promptGuidelines: [
		"Use webfetch when a specific URL must be retrieved.",
		"Prefer markdown format unless raw HTML or plain text is explicitly needed.",
		"The tool is read-only and does not modify files.",
	],
	parameters: Params,
	async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
		const format = (params.format ?? "markdown") as WebfetchFormat;
		const timeoutSeconds = clampTimeout(params.timeout);
		const fetched = await fetchUrl({ url: params.url, format, timeoutSeconds, signal });
		const raw = new TextDecoder().decode(fetched.body);
		const contentType = fetched.contentType.toLowerCase();
		const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
		let text = raw;
		let converted = false;

		if (isHtml && format === "markdown") {
			text = htmlToMarkdown(raw);
			converted = true;
		} else if (isHtml && format === "text") {
			text = htmlToText(raw);
			converted = true;
		}

		const details: WebfetchDetails = {
			url: params.url,
			finalUrl: fetched.url,
			format,
			status: fetched.status,
			statusText: fetched.statusText,
			contentType: fetched.contentType,
			bytes: fetched.bytes,
			timeoutSeconds,
			converted,
			truncated: fetched.truncated,
		};

		return {
			content: [{ type: "text", text }],
			details,
		};
	},
});
