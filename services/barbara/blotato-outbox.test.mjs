import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { leerOutbox, publicarOutbox } from "./blotato-outbox.mjs";

function crearOutbox() {
  const dir = mkdtempSync(join(tmpdir(), "barbara-outbox-"));
  writeFileSync(join(dir, "slide-01.png"), Buffer.from([0, 1, 2, 3]));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({
    version: 1,
    platform: "instagram",
    caption: "Caption aprobada",
    files: ["slide-01.png"],
  }));
  return dir;
}

test("publica exactamente los archivos declarados en el outbox", async (t) => {
  const dir = crearOutbox();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let payload;
  const cliente = {
    subirMedia: async (url) => {
      assert.match(url, /^data:image\/png;base64,/);
      return { url: "https://database.blotato.com/slide.png" };
    },
    crearPublicacion: async (body) => { payload = body; return { postSubmissionId: "post-1" }; },
  };

  assert.deepEqual(await publicarOutbox(cliente, { directorio: dir, accountId: "ig-1" }), { postSubmissionId: "post-1" });
  assert.equal(payload.post.accountId, "ig-1");
  assert.equal(payload.post.content.platform, "instagram");
  assert.deepEqual(payload.post.content.mediaUrls, ["https://database.blotato.com/slide.png"]);
});

test("rechaza rutas que escapen del outbox", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "barbara-outbox-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "contenido"));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ version: 1, files: ["../secreto.txt"] }));
  const manifest = leerOutbox(dir);
  assert.deepEqual(manifest.files, ["../secreto.txt"]);
  await assert.rejects(
    publicarOutbox({ subirMedia: async () => ({}) }, { directorio: dir, accountId: "1" }),
    /fuera del outbox/,
  );
});
