import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the VoiceLog experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/i);
  assert.match(html, /<title>VoiceLog \| 목소리로 남기는 나의 하루<\/title>/i);
  assert.match(html, /오늘 있었던 일을 들려주세요/);
  assert.match(html, /오디오 파일 업로드/);
  assert.match(html, /음성 없이 직접 작성/);
  assert.match(html, /기본형/);
  assert.match(html, /핵심 요약/);
  assert.doesNotMatch(html, /3줄 요약/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("exposes the Gemini configuration status endpoint", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/api/status"),
    {},
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  const status = await response.json();
  assert.equal(status.model, "gemini-3.6-flash");
  assert.equal(typeof status.configured, "boolean");
});
