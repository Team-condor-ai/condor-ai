// Cliente IMAP y SMTP mínimo sobre Deno.connectTls.
// Por qué propio: imapflow/nodemailer (node:net) se cuelgan en el runtime de Supabase Edge,
// mientras que Deno.connectTls conecta a mail.tecnoboxchile.cl en <1 s (probado el 26-sept-2026).
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s)));
const concatenar = (a: Uint8Array, b: Uint8Array) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; };
const conLimite = <T>(p: Promise<T>, ms: number, que: string) =>
  Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error(`${que}: sin respuesta en ${ms / 1000} s`)), ms))]);

class Linea {
  // Pedazos en una lista (unir en cada lectura era cuadrático y agotaba la CPU con adjuntos grandes).
  trozos: Uint8Array[] = []; total = 0;
  constructor(public conn: Deno.TlsConn) {}
  async llenar() {
    const t = new Uint8Array(65536);
    const n = await conLimite(this.conn.read(t), 30000, "servidor de correo");
    if (n === null) throw new Error("el servidor cerró la conexión");
    this.trozos.push(t.slice(0, n)); this.total += n;
  }
  cola(bytes = 8192) {                      // solo el final: ahí aparece la línea que cierra la respuesta
    let falta = bytes; const partes: Uint8Array[] = [];
    for (let i = this.trozos.length - 1; i >= 0 && falta > 0; i--) { const t = this.trozos[i]; partes.unshift(t.subarray(Math.max(0, t.length - falta))); falta -= t.length; }
    return dec.decode(partes.length === 1 ? partes[0] : partes.reduce(concatenar, new Uint8Array(0)));
  }
  unir() { const r = new Uint8Array(this.total); let o = 0; for (const t of this.trozos) { r.set(t, o); o += t.length; } this.trozos = []; this.total = 0; return r; }
  async hasta(prueba: (colaTexto: string) => boolean): Promise<Uint8Array> {
    for (;;) { if (this.total && prueba(this.cola())) return this.unir(); await this.llenar(); }
  }
  escribir(x: string | Uint8Array) { return this.conn.write(typeof x === "string" ? enc.encode(x) : x); }
}

export class Imap {
  private l!: Linea; private n = 0;
  async abrir(host: string, user: string, pass: string) {
    this.l = new Linea(await conLimite(Deno.connectTls({ hostname: host, port: 993 }), 15000, "conexión IMAP"));
    await this.l.hasta((t) => t.includes("\r\n"));
    const r = await this.cmd(`AUTHENTICATE PLAIN ${b64(`\0${user}\0${pass}`)}`);
    if (!r.ok) throw new Error("IMAP rechazó el usuario o la clave");
  }
  async cmd(linea: string): Promise<{ ok: boolean; datos: Uint8Array; texto: string }> {
    const tag = `A${++this.n}`;
    await this.l.escribir(`${tag} ${linea}\r\n`);
    const datos = await this.l.hasta((t) => new RegExp(`(^|\\r\\n)${tag} (OK|NO|BAD)[^\\r\\n]*\\r\\n$`).test(t));
    const texto = dec.decode(datos);
    return { ok: new RegExp(`(^|\\r\\n)${tag} OK`).test(texto), datos, texto };
  }
  async uidsDesde(desde: number): Promise<number[]> {
    await this.cmd("EXAMINE INBOX");                              // solo lectura: no cambia \Seen en el servidor
    const r = await this.cmd(`UID SEARCH UID ${desde}:*`);
    const linea = r.texto.split("\r\n").find((x) => x.startsWith("* SEARCH")) || "";
    return linea.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean).map(Number).filter((u) => u >= desde);
  }
  // Mensaje completo (bytes) de un UID. BODY.PEEK: no lo marca como leído.
  async mensaje(uid: number): Promise<Uint8Array | null> {
    const r = await this.cmd(`UID FETCH ${uid} (BODY.PEEK[]<0.300000>)`);
    const t = r.texto; const m = t.match(/BODY\[\](?:<0>)? \{(\d+)\}\r\n/);
    if (!m || m.index === undefined) return null;
    const inicioTexto = m.index + m[0].length;
    const inicioBytes = enc.encode(t.slice(0, inicioTexto)).length;   // el literal se cuenta en BYTES
    return r.datos.subarray(inicioBytes, inicioBytes + Number(m[1]));
  }
  async carpetaEnviados(): Promise<string> {
    const r = await this.cmd('LIST "" "*"');
    const l = r.texto.split("\r\n").find((x) => /\\Sent\b/.test(x));
    const nombre = l?.match(/"([^"]+)"\s*$/)?.[1] || l?.split(" ").pop();
    return nombre || "INBOX.Sent";
  }
  async anexar(carpeta: string, crudo: Uint8Array) {
    const tag = `A${++this.n}`;
    await this.l.escribir(`${tag} APPEND "${carpeta}" (\\Seen) {${crudo.length}}\r\n`);
    await this.l.hasta((t) => /(^|\r\n)\+/.test(t));
    await this.l.escribir(crudo); await this.l.escribir("\r\n");
    await this.l.hasta((t) => new RegExp(`${tag} (OK|NO|BAD)[^\\r\\n]*\\r\\n$`).test(t));
  }
  async cerrar() { try { await this.cmd("LOGOUT"); } catch { /* da igual */ } try { this.l.conn.close(); } catch { /* ya cerrada */ } }
}

// SMTP 465 (TLS directo), AUTH PLAIN. `crudo` es el mensaje MIME completo.
export async function enviarSmtp(host: string, user: string, pass: string, de: string, para: string, crudo: string) {
  const l = new Linea(await conLimite(Deno.connectTls({ hostname: host, port: 465 }), 15000, "conexión SMTP"));
  const resp = async (esperado: string) => {
    const r = dec.decode(await l.hasta((t) => /(^|\r\n)\d{3} [^\r\n]*\r\n$/.test(t)));
    const cod = r.trim().split("\r\n").pop()!.slice(0, 3);
    if (!cod.startsWith(esperado)) throw new Error(`SMTP respondió ${r.trim().split("\r\n").pop()}`);
  };
  await resp("220");
  await l.escribir("EHLO tecnoboxchile.cl\r\n"); await resp("250");
  await l.escribir(`AUTH PLAIN ${b64(`\0${user}\0${pass}`)}\r\n`); await resp("235");
  await l.escribir(`MAIL FROM:<${de}>\r\n`); await resp("250");
  await l.escribir(`RCPT TO:<${para}>\r\n`); await resp("25");
  await l.escribir("DATA\r\n"); await resp("354");
  const cuerpo = crudo.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
  await l.escribir(cuerpo + "\r\n.\r\n"); await resp("250");
  await l.escribir("QUIT\r\n");
  try { l.conn.close(); } catch { /* ya cerrada */ }
}

// Arma un correo de texto simple (UTF-8, quoted-printable no hace falta: base64 del cuerpo).
export function armarMime(o: { de: string; para: string; asunto: string; texto: string; enRespuestaA?: string; host: string }) {
  const id = `<${crypto.randomUUID()}@${o.host}>`;
  const asunto = `=?UTF-8?B?${b64(o.asunto)}?=`;
  const cuerpo = b64(o.texto).replace(/.{1,76}/g, "$&\r\n");
  const cab = [
    `From: ${o.de}`, `To: ${o.para}`, `Subject: ${asunto}`, `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: ${id}`, ...(o.enRespuestaA ? [`In-Reply-To: ${o.enRespuestaA}`, `References: ${o.enRespuestaA}`] : []),
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64",
  ];
  return { id, crudo: cab.join("\r\n") + "\r\n\r\n" + cuerpo };
}
