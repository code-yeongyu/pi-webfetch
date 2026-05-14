import type { Theme, ToolRenderResultOptions } from "@mariozechner/pi-coding-agent";
import { Text, truncateToWidth } from "@mariozechner/pi-tui";

import type { WebfetchProgressDetails, WebfetchRenderDetails } from "./tool.js";

const URL_BUDGET = 92;
const PREVIEW_LINES = 4;
const PREVIEW_WIDTH = 120;

interface WebfetchArgs {
	url: string;
	format?: string;
	timeout?: number;
}

interface ResultLike<TDetails> {
	content: ReadonlyArray<{ type: string; text?: string }>;
	details?: TDetails;
}

export function renderWebfetchCall(args: WebfetchArgs, theme: Theme): Text {
	const head = theme.fg("toolTitle", theme.bold("webfetch "));
	const url = theme.fg("accent", shorten(args.url, URL_BUDGET));
	const format = theme.fg("muted", ` [${args.format ?? "markdown"}]`);
	const timeout = args.timeout === undefined ? "" : theme.fg("dim", ` ${args.timeout}s`);
	return new Text(head + url + format + timeout, 0, 0);
}

export function renderWebfetchResult(
	result: ResultLike<WebfetchRenderDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
): Text {
	if (options.isPartial) {
		const details = result.details;
		if (isWebfetchProgressDetails(details)) {
			return new Text(
				theme.fg(
					"warning",
					`Fetching ${shorten(details.url, URL_BUDGET)} as ${details.format} (${details.timeoutSeconds}s)`,
				),
				0,
				0,
			);
		}
		return new Text(theme.fg("warning", "Fetching..."), 0, 0);
	}

	const details = result.details;
	const text = result.content.find((block) => block.type === "text")?.text ?? "";
	if (!details || isWebfetchProgressDetails(details)) {
		return new Text(theme.fg("muted", truncateToWidth(text, PREVIEW_WIDTH)), 0, 0);
	}

	const statusKey = details.status >= 200 && details.status < 300 ? "success" : "warning";
	const status = theme.fg(statusKey, `${details.status} ${details.statusText || "OK"}`);
	const format = theme.fg("accent", details.format);
	const size = theme.fg("muted", formatBytes(details.bytes));
	const converted = details.converted ? theme.fg("dim", " converted") : "";
	const header = `${status} ${theme.fg("muted", "•")} ${format} ${theme.fg("muted", "•")} ${size}${converted}`;

	if (!options.expanded) {
		const preview = previewText(text, theme);
		return new Text([header, ...preview].join("\n"), 0, 0);
	}

	const lines = [
		header,
		theme.fg("dim", `URL: ${shorten(details.finalUrl, URL_BUDGET)}`),
		theme.fg("dim", `Content-Type: ${details.contentType || "unknown"}`),
		"",
		...text
			.split("\n")
			.slice(0, 24)
			.map((line) => theme.fg("toolOutput", truncateToWidth(line, PREVIEW_WIDTH))),
	];
	return new Text(lines.join("\n"), 0, 0);
}

function isWebfetchProgressDetails(details: WebfetchRenderDetails | undefined): details is WebfetchProgressDetails {
	return details !== undefined && "phase" in details && details.phase === "fetching";
}

function previewText(text: string, theme: Theme): string[] {
	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.slice(0, PREVIEW_LINES);
	if (lines.length === 0) return [theme.fg("dim", "  empty response")];
	return lines.map((line) => theme.fg("toolOutput", `  ${truncateToWidth(line, PREVIEW_WIDTH)}`));
}

function shorten(value: string, max: number): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max - 1)}…`;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
