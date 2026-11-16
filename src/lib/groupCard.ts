// Draws a 1080x1350 group card on a canvas, entirely on the device: nothing
// is uploaded. Creatures come in as the live <svg> elements from the page.

type CardInput = {
  svgs: SVGSVGElement[];
  title: string;
  subtitle: string;
  excerpt: string;
};

const W = 1080;
const H = 1350;

function svgToImage(svg: SVGSVGElement, size: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[,.;:!?]?\s*\S*$/, "") + "…";
  }
  return lines;
}

export async function renderGroupCard({ svgs, title, subtitle, excerpt }: CardInput): Promise<Blob> {
  await Promise.all([document.fonts.load('80px "Titan One"'), document.fonts.ready]).catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // background
  ctx.fillStyle = "#F7F7F4";
  ctx.fillRect(0, 0, W, H);
  const blob = (x: number, y: number, r: number, c: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(247,247,244,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  blob(900, 120, 520, "rgba(125,212,192,0.35)");
  blob(120, 420, 520, "rgba(240,154,133,0.30)");
  blob(700, 1250, 560, "rgba(212,179,213,0.35)");

  // brand
  ctx.fillStyle = "#2F2925";
  ctx.font = '72px "Titan One", system-ui';
  ctx.textBaseline = "top";
  ctx.fillText("hands", 80, 70);
  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillStyle = "#6F6A63";
  ctx.textAlign = "right";
  ctx.fillText(subtitle, W - 80, 96);
  ctx.textAlign = "left";

  // title
  ctx.fillStyle = "#16120F";
  ctx.font = "700 64px system-ui, sans-serif";
  wrap(ctx, title, W - 160, 2).forEach((l, i) => ctx.fillText(l, 80, 210 + i * 76));

  // creatures: one row, overlapping when crowded
  const n = Math.max(1, svgs.length);
  const size = Math.min(300, Math.max(150, 1700 / n));
  const step = Math.min(size * 0.7, (W - 160 - size) / Math.max(1, n - 1));
  const rowW = size + step * (n - 1);
  const imgs = await Promise.all(svgs.map((s) => svgToImage(s, size)));
  ctx.fillStyle = "rgba(47,41,37,0.08)";
  ctx.beginPath();
  ctx.ellipse(W / 2, 430 + size * 0.93, rowW / 2, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  imgs.forEach((img, i) => ctx.drawImage(img, (W - rowW) / 2 + i * step, 430, size, size));

  // story excerpt card, as tall as its text
  const top = 430 + size + 50;
  ctx.font = "italic 400 36px Georgia, 'Times New Roman', serif";
  const lines = wrap(ctx, `“${excerpt}”`, W - 260, Math.floor((H - top - 230) / 52));
  const boxH = Math.max(160, lines.length * 52 + 84);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.strokeStyle = "#DAD8CE";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, top, W - 160, boxH, 36);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3D3833";
  ctx.font = "italic 400 36px Georgia, 'Times New Roman', serif";
  lines.forEach((l, i) => ctx.fillText(l, 130, top + 42 + i * 52));

  // footer credit
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillStyle = "#8A857D";
  ctx.fillText("Anonymous until both say yes.", 80, H - 120);
  ctx.fillText("hands by jpzk, hi-aryan and team · github.com/jpzk/human-to-human", 80, H - 84);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

// Share sheet on touch devices (Android WebView/iOS), plain download elsewhere.
export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Our hands group" });
      return;
    } catch {
      /* cancelled: fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
