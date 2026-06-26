import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Static } from "typebox";
import { afterEach, describe, expect, it } from "vitest";

import { MAX_RESPONSE_SIZE_BYTES } from "../src/webfetch/fetcher.js";
import { webfetch } from "../src/webfetch/tool.js";

type RouteHandler = (request: IncomingMessage, response: ServerResponse) => void;
type CapturedHeaders = IncomingMessage["headers"];

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

function headerValue(headers: CapturedHeaders, name: string): string {
	const value = headers[name.toLowerCase()];
	if (Array.isArray(value)) return value.join(", ");
	return value ?? "";
}

afterEach(async () => {
	await Promise.all(servers.splice(0).map(closeServer));
});

function closeServer(server: Server): Promise<void> {
	return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function tistoryFixtureHtml(): string {
	return `<!doctype html>
		<html>
			<head>
				<title>관리자 메뉴가 제목을 이기면 안 됨</title>
				<meta name="description" content="티스토리 블로그 홍보 문구">
			</head>
			<body class="tt-body-page">
				<header>
					<a href="/manage">관리자</a>
					<a href="/category">분류 전체보기</a>
				</header>
				<section class="sidebar">
					<h2>최근 글</h2>
					<p>관련 없는 사이드바 설명이 길게 들어가서 리더가 이 영역을 본문으로 착각하면 안 됩니다.</p>
				</section>
				<div id="content">
					<h1 class="tit_post">티스토리 본문을 읽어야 합니다</h1>
					<div class="entry-content contents_style">
						<div class="article_view tt_article_useless_p_margin">
							<p data-ke-size="size16">첫 번째 본문 문장은 짧은 티스토리 글에서도 반드시 남아야 합니다.</p>
							<p data-ke-size="size16">두 번째 본문 문장은 카테고리나 관련 글보다 우선되어야 합니다.</p>
							<figure data-ke-type="image">
								<figcaption>본문 이미지 설명도 보존됩니다.</figcaption>
							</figure>
						</div>
						<div class="another_category">
							<h4>다른 글 보기</h4>
							<ul>
								<li>관련 글 제목 하나</li>
								<li>관련 글 제목 둘</li>
							</ul>
						</div>
					</div>
				</div>
				<footer>구독하기 푸터와 방명록 링크</footer>
				<script>window.tistoryTracker = true;</script>
			</body>
		</html>`;
}

function titlePriorityFixtureHtml(): string {
	return `<!doctype html>
		<html>
			<head>
				<title>관리자 메뉴가 제목을 이기면 안 됨</title>
				<meta name="description" content="티스토리 블로그 홍보 문구">
			</head>
			<body class="tt-body-page">
				<header>
					<h1>블로그 이름</h1>
					<a href="/manage">관리자</a>
					<a href="/category">분류 전체보기</a>
				</header>
				<section class="sidebar">
					<h2>최근 글</h2>
					<p>관련 없는 사이드바 설명이 길게 들어가서 리더가 이 영역을 본문으로 착각하면 안 됩니다.</p>
				</section>
				<div id="content">
					<h1 class="tit_post">티스토리 본문을 읽어야 합니다</h1>
					<div class="entry-content contents_style">
						<div class="article_view tt_article_useless_p_margin">
							<p data-ke-size="size16">첫 번째 본문 문장은 짧은 티스토리 글에서도 반드시 남아야 합니다.</p>
							<p data-ke-size="size16">두 번째 본문 문장은 카테고리나 관련 글보다 우선되어야 합니다.</p>
						</div>
					</div>
				</div>
				<footer>구독하기 푸터와 방명록 링크</footer>
			</body>
		</html>`;
}

function newlineFixtureHtml(): string {
	return `<!doctype html>
		<html>
			<body>
				<div class="article_view">
					<h1>줄바꿈 보존</h1>
					<p><span>첫 줄</span><br><span>둘째 줄</span></p>
					<p><span>새 문단</span> <strong>강조</strong></p>
					<ul>
						<li><span>첫 항목</span></li>
						<li><span>둘째 항목</span></li>
					</ul>
					<table>
						<tr><td>왼쪽 칸</td><td>오른쪽 칸</td></tr>
					</table>
				</div>
			</body>
		</html>`;
}

function literalEntityFixtureHtml(): string {
	return `<!doctype html>
		<html>
			<body>
				<article>
					<h1>Literal Entity Fixture</h1>
					<p>Rendered tag example: &amp;lt;custom-element&amp;gt;</p>
					<p>Escaped ampersand example: AT&amp;amp;T docs</p>
				</article>
			</body>
		</html>`;
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
	it("#given url fetch #when execution starts #then emits progress details for the TUI", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/plain" });
			response.end("ready");
		});
		const updates: Array<{ content: Array<{ type: string; text?: string }>; details?: unknown }> = [];

		// when
		const result = await webfetch.execute(
			"tool",
			{ url: `${server.baseUrl}/ready`, format: "text", timeout: 7 },
			undefined,
			(update) => updates.push(update),
			undefined as never,
		);

		// then
		expect(textContent(result)).toBe("ready");
		expect(updates[0]).toMatchObject({
			content: [{ type: "text", text: `Fetching ${server.baseUrl}/ready as text (timeout 7s)` }],
			details: {
				phase: "fetching",
				url: `${server.baseUrl}/ready`,
				format: "text",
				timeoutSeconds: 7,
			},
		});
	});

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

	it("#given article page with chrome #when fetching markdown #then returns reader-style main content", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(`<!doctype html>
				<html>
					<head>
						<title>Browser chrome should not win</title>
						<meta name="description" content="Promo summary">
						<style>.ad { color: red; }</style>
					</head>
					<body>
						<header><a href="/subscribe">Subscribe now</a></header>
						<nav><a href="/topics">Topics</a><a href="/login">Login</a></nav>
						<main>
							<article>
								<h1>Readable Article Title</h1>
								<p>Alpha opening paragraph with enough words to look like article content, not navigation.</p>
								<p>Beta paragraph explains the important result and should stay in the fetched content.</p>
							</article>
						</main>
						<aside>Sponsored sidebar offer</aside>
						<footer>Privacy policy and cookie settings</footer>
						<script>window.tracker = true;</script>
					</body>
				</html>`);
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/article`, format: "markdown" });
		const text = textContent(result);

		// then
		expect(text).toContain("# Readable Article Title");
		expect(text).toContain("Alpha opening paragraph");
		expect(text).toContain("Beta paragraph explains");
		expect(text).not.toContain("Browser chrome should not win");
		expect(text).not.toContain("Subscribe now");
		expect(text).not.toContain("Topics");
		expect(text).not.toContain("Sponsored sidebar offer");
		expect(text).not.toContain("Privacy policy");
		expect(text).not.toContain("window.tracker");
	});

	it("#given a web page #when fetching markdown #then sends browser navigation headers", async () => {
		// given
		let capturedHeaders: CapturedHeaders | undefined;
		const server = await createFixtureServer((request, response) => {
			capturedHeaders = request.headers;
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(tistoryFixtureHtml());
		});

		// when
		await executeWebfetch({ url: `${server.baseUrl}/headers`, format: "markdown" });

		// then
		expect(capturedHeaders).toBeDefined();
		if (!capturedHeaders) throw new Error("Expected captured request headers");
		expect(headerValue(capturedHeaders, "user-agent")).toContain("Mozilla/5.0");
		expect(headerValue(capturedHeaders, "accept")).toContain("text/markdown");
		expect(headerValue(capturedHeaders, "accept-language")).toBe("en-US,en;q=0.9");
		expect(headerValue(capturedHeaders, "sec-fetch-mode")).toBe("navigate");
		expect(headerValue(capturedHeaders, "sec-fetch-dest")).toBe("document");
		expect(headerValue(capturedHeaders, "sec-ch-ua-platform")).toBe('"Windows"');
	});

	it("#given Tistory article wrappers #when fetching markdown #then prefers the article body over category chrome", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(tistoryFixtureHtml());
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/tistory`, format: "markdown" });
		const text = textContent(result);

		// then
		expect(text).toContain("# 티스토리 본문을 읽어야 합니다");
		expect(text).toContain("첫 번째 본문 문장은");
		expect(text).toContain("두 번째 본문 문장은");
		expect(text).toContain("본문 이미지 설명도 보존됩니다");
		expect(text).not.toContain("관리자 메뉴가 제목을 이기면 안 됨");
		expect(text).not.toContain("분류 전체보기");
		expect(text).not.toContain("최근 글");
		expect(text).not.toContain("관련 글 제목");
		expect(text).not.toContain("구독하기 푸터");
		expect(text).not.toContain("tistoryTracker");
	});

	it("#given Tistory title chrome #when fetching markdown #then prefers the article title over site chrome", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(titlePriorityFixtureHtml());
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/tistory-title`, format: "markdown" });
		const text = textContent(result);

		// then
		expect(text).toContain("# 티스토리 본문을 읽어야 합니다");
		expect(text).toContain("첫 번째 본문 문장은");
		expect(text).toContain("두 번째 본문 문장은");
		expect(text).not.toContain("블로그 이름");
		expect(text).not.toContain("관련 없는 사이드바 설명");
	});

	it("#given Tistory title chrome #when fetching text #then prefers the article title over site chrome", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(titlePriorityFixtureHtml());
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/tistory-title-text`, format: "text" });
		const text = textContent(result);

		// then
		expect(text.startsWith("티스토리 본문을 읽어야 합니다")).toBe(true);
		expect(text).toContain("첫 번째 본문 문장은");
		expect(text).toContain("두 번째 본문 문장은");
		expect(text).not.toContain("블로그 이름");
		expect(text).not.toContain("관련 없는 사이드바 설명");
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

	it("#given article page with chrome #when fetching text #then returns reader-style main content", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(`<!doctype html>
				<html>
					<head>
						<title>Text chrome title</title>
						<meta name="description" content="Text promo summary">
					</head>
					<body>
						<header>Text subscribe banner</header>
						<nav><a href="/latest">Latest text link</a></nav>
						<main>
							<article>
								<h1>Readable Text Article</h1>
								<p>Gamma text paragraph with enough words to be selected as article content.</p>
								<p>Delta text paragraph should stay after reader cleanup.</p>
							</article>
						</main>
						<aside>Text sponsored sidebar</aside>
						<footer>Text footer legal links</footer>
						<script>window.textTracker = true;</script>
					</body>
				</html>`);
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/text-article`, format: "text" });
		const text = textContent(result);

		// then
		expect(text).toContain("Readable Text Article");
		expect(text).toContain("Gamma text paragraph");
		expect(text).toContain("Delta text paragraph");
		expect(text).not.toContain("Text chrome title");
		expect(text).not.toContain("Text subscribe banner");
		expect(text).not.toContain("Latest text link");
		expect(text).not.toContain("Text sponsored sidebar");
		expect(text).not.toContain("Text footer legal links");
		expect(text).not.toContain("textTracker");
		expect(result.details?.format).toBe("text");
	});

	it("#given Tistory text with inline spans and blocks #when fetching text #then preserves readable line breaks", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(newlineFixtureHtml());
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/newline`, format: "text" });
		const text = textContent(result);

		// then
		expect(text).toContain("줄바꿈 보존\n\n첫 줄\n둘째 줄\n\n새 문단 강조");
		expect(text).toContain("첫 항목\n\n둘째 항목");
		expect(text).toContain("왼쪽 칸\n오른쪽 칸");
		expect(text).not.toContain("\n\n\n");
		expect(text).not.toContain("첫 줄둘째 줄");
	});

	it("#given literal HTML entity examples #when fetching markdown and text #then preserves one decoded layer only", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(literalEntityFixtureHtml());
		});

		// when
		const markdown = textContent(
			await executeWebfetch({ url: `${server.baseUrl}/literal-entity`, format: "markdown" }),
		);
		const text = textContent(await executeWebfetch({ url: `${server.baseUrl}/literal-entity`, format: "text" }));

		// then
		expect(markdown).toContain("&lt;custom-element&gt;");
		expect(markdown).toContain("AT&amp;T docs");
		expect(markdown).not.toContain("<custom-element>");
		expect(markdown).not.toContain("AT&T docs");
		expect(text).toContain("&lt;custom-element&gt;");
		expect(text).toContain("AT&amp;T docs");
		expect(text).not.toContain("<custom-element>");
		expect(text).not.toContain("AT&T docs");
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

	it("#given response at byte limit #when fetching #then marks result as truncated", async () => {
		// given
		const body = Buffer.alloc(MAX_RESPONSE_SIZE_BYTES, "x");
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(200, { "content-length": String(body.length), "content-type": "text/plain" });
			response.end(body);
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/limit`, format: "text" });

		// then
		expect(result.details?.bytes).toBe(MAX_RESPONSE_SIZE_BYTES);
		expect(result.details?.truncated).toBe(true);
	});

	it("#given Cloudflare challenge response #when fetching #then does not retry with a bot identity", async () => {
		// given
		const attempts: CapturedHeaders[] = [];
		const server = await createFixtureServer((request, response) => {
			attempts.push(request.headers);
			if (attempts.length === 1) {
				response.writeHead(403, {
					"cf-mitigated": "challenge",
					"content-type": "text/html; charset=utf-8",
				});
				response.end("<html><body>challenge</body></html>");
				return;
			}

			response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
			response.end("retried");
		});

		// when
		await executeWebfetch({ url: `${server.baseUrl}/challenge`, format: "text" });

		// then
		expect(attempts).toHaveLength(1);
		const challengeHeaders = attempts[0];
		if (!challengeHeaders) throw new Error("Expected challenge request headers");
		expect(headerValue(challengeHeaders, "user-agent")).toContain("Mozilla/5.0");
		expect(headerValue(challengeHeaders, "user-agent")).not.toContain("pi-webfetch");
		expect(headerValue(challengeHeaders, "sec-fetch-mode")).toBe("navigate");
		expect(headerValue(challengeHeaders, "sec-fetch-dest")).toBe("document");
		expect(headerValue(challengeHeaders, "sec-ch-ua-platform")).toBe('"Windows"');
	});

	it("#given too many redirects #when fetching #then returns the final redirect response body", async () => {
		// given
		const server = await createFixtureServer((_request, response) => {
			response.writeHead(302, {
				location: "/loop",
				"content-type": "text/plain; charset=utf-8",
			});
			response.end("redirect limit reached");
		});

		// when
		const result = await executeWebfetch({ url: `${server.baseUrl}/loop`, format: "text" });
		const text = textContent(result);

		// then
		expect(text).toContain("redirect limit reached");
	});
});
