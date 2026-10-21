// Telas animadas dos equipamentos, desenhadas em canvas e aplicadas como
// textura emissiva. Cada tela tem estados: normal, alvo ativo e concluída.
import * as THREE from "../../vendor/three/three.module.min.js";

const MONO = "'JetBrains Mono', 'Courier New', monospace";
const SANS = "'Inter', 'Segoe UI', Arial, sans-serif";
const DONE = "#56e6b5";

function rgba(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

function seeded(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const BASES = "ACGT";
const BASE_COLORS = { A: "#5ee08f", C: "#5ab8ff", G: "#ffc25a", T: "#ff6b6b" };

export class ScreenDisplay {
  constructor(kind, { width = 512, height = 320, accent = "#58f4c2", title = "", intensity = 1.5 } = {}) {
    this.kind = kind;
    this.title = title;
    this.accent = accent;
    this.baseAccent = accent;
    this.complete = false;
    this.active = false;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.material = new THREE.MeshStandardMaterial({
      color: 0x020304, roughness: 0.22, metalness: 0, envMapIntensity: 0.7,
      emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: intensity,
    });
    this.baseIntensity = intensity;
    this.lastDraw = -Infinity;
    this.interval = 1000 / (8 + Math.random() * 4);
    this.offset = Math.random() * 10000;
    this.draw(0);
  }

  setComplete(value) {
    if (this.complete === value) return;
    this.complete = value;
    this.lastDraw = -Infinity;
  }

  setActive(value) {
    if (this.active === value) return;
    this.active = value;
    this.lastDraw = -Infinity;
  }

  update(time, reduced) {
    const pulse = this.active && !reduced ? 0.18 * (Math.sin(time * 0.004) + 1) : 0;
    this.material.emissiveIntensity = this.baseIntensity * (1 + pulse);
    const interval = reduced ? this.interval * 3 : this.interval;
    if (time - this.lastDraw < interval) return;
    this.lastDraw = time;
    this.draw(reduced ? 0 : time + this.offset);
    this.texture.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  draw(t) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const accent = this.complete ? DONE : this.accent;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#06141a");
    bg.addColorStop(1, "#030a0d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Grade fina de fundo.
    ctx.strokeStyle = rgba(accent, 0.06);
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }

    const renderer = this[`draw_${this.kind}`];
    if (renderer) renderer.call(this, ctx, W, H, t, accent);

    this.header(ctx, W, accent, t);

    // Moldura de alvo ativo.
    if (this.active && !this.complete) {
      const a = 0.45 + 0.45 * Math.sin(t * 0.006);
      ctx.strokeStyle = rgba(accent, a);
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
    }
    // Linhas de varredura muito sutis.
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }

  header(ctx, W, accent, t) {
    if (!this.title) return;
    ctx.fillStyle = rgba(accent, 0.16);
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 33, W, 2);
    ctx.font = `600 16px ${SANS}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#e8fbf6";
    ctx.fillText(this.title, 14, 18);
    ctx.textAlign = "right";
    ctx.font = `600 14px ${MONO}`;
    if (this.complete) {
      ctx.fillStyle = DONE;
      ctx.fillText("✓ CONCLUÍDO", W - 14, 18);
    } else if (this.active) {
      ctx.fillStyle = Math.sin(t * 0.008) > 0 ? accent : rgba(accent, 0.4);
      ctx.fillText("● AGUARDANDO", W - 14, 18);
    } else {
      ctx.fillStyle = rgba("#9fc9c0", 0.7);
      const s = Math.floor(t / 1000) % 60;
      ctx.fillText(`ONLINE 00:${String(s).padStart(2, "0")}`, W - 14, 18);
    }
    ctx.textAlign = "left";
  }

  // --- Conteúdos -----------------------------------------------------------
  draw_cases(ctx, W, H, t, accent) {
    const cols = 3, pad = 16, cw = (W - pad * (cols + 1)) / cols;
    for (let c = 0; c < cols; c += 1) {
      const x = pad + c * (cw + pad), y = 50;
      ctx.fillStyle = rgba(accent, 0.07);
      ctx.fillRect(x, y, cw, H - y - 16);
      ctx.strokeStyle = rgba(accent, c === 1 ? 0.8 : 0.3);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cw, H - y - 16);
      ctx.fillStyle = "#e8fbf6";
      ctx.font = `700 18px ${MONO}`;
      ctx.fillText(`PACIENTE 0${c + 1}`, x + 12, y + 24);
      ctx.font = `13px ${MONO}`;
      ctx.fillStyle = "#8fb5ad";
      ["FEBRE", "TOSSE", "FADIGA", "LINFÓCITOS"].forEach((label, i) => {
        const yy = y + 54 + i * 30;
        ctx.fillText(label, x + 12, yy);
        const v = 0.35 + seeded(c * 7 + i) * 0.6;
        ctx.fillStyle = rgba(accent, 0.18);
        ctx.fillRect(x + 12, yy + 7, cw - 24, 6);
        ctx.fillStyle = i === 3 ? "#ffb84d" : accent;
        ctx.fillRect(x + 12, yy + 7, (cw - 24) * v, 6);
        ctx.fillStyle = "#8fb5ad";
      });
      // Curva de temperatura.
      ctx.strokeStyle = "#ff8a6b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 24; i += 1) {
        const px = x + 12 + (i / 24) * (cw - 24);
        const py = H - 40 - Math.sin(i * 0.5 + c + t * 0.001) * 10 - i * 0.8;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  draw_analyzer(ctx, W, H, t, accent) {
    ctx.strokeStyle = rgba(accent, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, H - 40); ctx.lineTo(W - 20, H - 40); ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const peaks = [[0.18, 0.5], [0.33, 0.9], [0.47, 0.35], [0.61, 0.75], [0.78, 0.45]];
    for (let i = 0; i <= 200; i += 1) {
      const u = i / 200;
      let v = 0.04 + Math.sin(u * 60 + t * 0.003) * 0.01;
      peaks.forEach(([p, h]) => { v += h * Math.exp(-((u - p) ** 2) / 0.0009); });
      const x = 30 + u * (W - 50), y = H - 40 - v * (H - 110);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const scan = ((t * 0.00012) % 1);
    ctx.fillStyle = rgba(accent, 0.12);
    ctx.fillRect(30 + scan * (W - 50) - 10, 44, 20, H - 84);
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = "#cfe9e3";
    ctx.fillText(this.complete ? "AMOSTRA #001 · ÍNTEGRA · VALIDADA" : "AMOSTRA #001 · AGUARDANDO LEITURA", 30, H - 16);
  }

  draw_pcr(ctx, W, H, t, accent) {
    const cycles = 40;
    const progress = this.complete ? 1 : (t * 0.00004) % 1;
    const px0 = 40, py0 = H - 44, pw = W - 200, ph = H - 100;
    ctx.strokeStyle = rgba(accent, 0.3);
    ctx.strokeRect(px0, py0 - ph, pw, ph);
    ["#ff6b6b", accent, "#5ab8ff", "#ffc25a"].forEach((color, k) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= cycles * progress; i += 1) {
        const v = 1 / (1 + Math.exp(-(i - (18 + k * 4)) * 0.45));
        const x = px0 + (i / cycles) * pw, y = py0 - v * ph * (k === 3 ? 0.08 : 0.9 - k * 0.08);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    ctx.fillStyle = "#e8fbf6";
    ctx.font = `700 34px ${MONO}`;
    ctx.fillText(`${Math.floor(progress * cycles)}`.padStart(2, "0"), W - 140, 92);
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = "#8fb5ad";
    ctx.fillText("CICLO / 40", W - 140, 112);
    const temp = [95, 58, 72][Math.floor(t / 900) % 3];
    ctx.fillStyle = "#ffb84d";
    ctx.font = `700 28px ${MONO}`;
    ctx.fillText(`${temp}.0°C`, W - 150, 168);
    ctx.fillStyle = "#8fb5ad";
    ctx.font = `13px ${MONO}`;
    ctx.fillText("MARCADOR V7", W - 150, 200);
  }

  draw_sequencer(ctx, W, H, t, accent) {
    ctx.font = `700 15px ${MONO}`;
    const rows = 9, cols = 26;
    const shift = Math.floor(t * 0.004);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const b = BASES[Math.floor(seeded(r * 97 + c + shift) * 4)];
        ctx.fillStyle = BASE_COLORS[b];
        ctx.globalAlpha = c > cols - 3 ? 0.4 : 0.92;
        ctx.fillText(b, 18 + c * 18.5, 66 + r * 24);
      }
    }
    ctx.globalAlpha = 1;
    for (let c = 0; c < cols; c += 1) {
      const q = 0.4 + seeded(c * 13 + shift) * 0.6;
      ctx.fillStyle = rgba(accent, 0.55);
      ctx.fillRect(18 + c * 18.5, H - 20 - q * 34, 12, q * 34);
    }
  }

  draw_map(ctx, W, H, t, accent) {
    // Contorno abstrato de uma cidade com bairros e conexões de transmissão.
    ctx.strokeStyle = rgba("#9fd6ce", 0.25);
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 40 + i * 34 + Math.sin(i) * 8);
      ctx.bezierCurveTo(W * 0.3, 40 + i * 30, W * 0.6, 70 + i * 36, W, 50 + i * 32);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba("#5ab8ff", 0.35);
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(W * 0.1, H); ctx.bezierCurveTo(W * 0.35, H * 0.4, W * 0.55, H * 0.7, W * 0.9, 30); ctx.stroke();
    const nodes = [[0.22, 0.4], [0.38, 0.62], [0.55, 0.36], [0.7, 0.58], [0.82, 0.3], [0.3, 0.8]];
    ctx.strokeStyle = rgba(accent, 0.7);
    ctx.lineWidth = 2;
    const links = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5]];
    links.forEach(([a, b], i) => {
      if (!this.complete && i > (t / 1200) % 6) return;
      ctx.beginPath();
      ctx.moveTo(nodes[a][0] * W, nodes[a][1] * H);
      ctx.lineTo(nodes[b][0] * W, nodes[b][1] * H);
      ctx.stroke();
    });
    nodes.forEach(([x, y], i) => {
      const pulse = (Math.sin(t * 0.004 + i) + 1) * 0.5;
      ctx.fillStyle = rgba(i < 2 ? "#ff655f" : "#ffb84d", 0.25 * pulse);
      ctx.beginPath(); ctx.arc(x * W, y * H, 14 + pulse * 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i < 2 ? "#ff655f" : "#ffb84d";
      ctx.beginPath(); ctx.arc(x * W, y * H, 6, 0, Math.PI * 2); ctx.fill();
    });
  }

  draw_response(ctx, W, H, t, accent) {
    const days = ["DIA 1", "DIA 2", "DIA 3"];
    days.forEach((d, i) => {
      const x = 24 + i * ((W - 48) / 3);
      ctx.fillStyle = "#cfe9e3";
      ctx.font = `700 15px ${MONO}`;
      ctx.fillText(d, x, 64);
      ["TESTAGEM", "ISOLAMENTO", "COMUNICAÇÃO"].forEach((label, k) => {
        const v = 0.3 + seeded(i * 5 + k) * 0.65;
        ctx.fillStyle = rgba(accent, 0.15);
        ctx.fillRect(x, 82 + k * 54, (W - 48) / 3 - 20, 14);
        ctx.fillStyle = k === 1 ? "#ffb84d" : accent;
        ctx.fillRect(x, 82 + k * 54, ((W - 48) / 3 - 20) * v, 14);
        ctx.fillStyle = "#8fb5ad";
        ctx.font = `12px ${MONO}`;
        ctx.fillText(label, x, 112 + k * 54);
      });
    });
    ctx.fillStyle = "#ff655f";
    ctx.font = `700 14px ${MONO}`;
    ctx.fillText(`R(t) ${(1.1 + Math.sin(t * 0.0006) * 0.12).toFixed(2)}`, 24, H - 18);
  }

  draw_vaccine(ctx, W, H, t, accent) {
    const cx = W * 0.32, cy = H * 0.58;
    const atoms = 18;
    const pts = [];
    for (let i = 0; i < atoms; i += 1) {
      const a = i * 0.9 + t * 0.0006;
      const r = 40 + (i % 5) * 16;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a * 1.3) * r * 0.62]);
    }
    ctx.strokeStyle = rgba(accent, 0.45);
    ctx.lineWidth = 2;
    for (let i = 1; i < atoms; i += 1) {
      ctx.beginPath(); ctx.moveTo(...pts[i - 1]); ctx.lineTo(...pts[i]); ctx.stroke();
    }
    pts.forEach(([x, y], i) => {
      ctx.fillStyle = i % 4 === 0 ? "#ffb84d" : accent;
      ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 ? 7 : 5, 0, Math.PI * 2); ctx.fill();
    });
    ["ANTÍGENO", "ESTABILIDADE", "SEGURANÇA", "ESCALA"].forEach((label, i) => {
      const y = 70 + i * 52;
      const v = this.complete ? 1 : 0.25 + ((t * 0.00005 + i * 0.2) % 0.7);
      ctx.fillStyle = "#8fb5ad";
      ctx.font = `12px ${MONO}`;
      ctx.fillText(label, W * 0.62, y);
      ctx.fillStyle = rgba(accent, 0.15);
      ctx.fillRect(W * 0.62, y + 8, W * 0.33, 10);
      ctx.fillStyle = accent;
      ctx.fillRect(W * 0.62, y + 8, W * 0.33 * v, 10);
    });
  }

  draw_variant(ctx, W, H, t, accent) {
    const seqA = "ATGGCTAGCTTACGGATCCAGTAC";
    const seqB = "ATGGCTAGCTTGCGGATCCAGTAC";
    ctx.font = `700 19px ${MONO}`;
    [seqA, seqB].forEach((seq, row) => {
      ctx.fillStyle = "#8fb5ad";
      ctx.font = `12px ${MONO}`;
      ctx.fillText(row ? "VARIANTE" : "REFERÊNCIA", 18, 76 + row * 70);
      ctx.font = `700 19px ${MONO}`;
      [...seq].forEach((b, i) => {
        const diff = seqA[i] !== seqB[i];
        if (diff) {
          const blink = 0.4 + 0.4 * Math.sin(t * 0.008);
          ctx.fillStyle = `rgba(255,101,95,${blink})`;
          ctx.fillRect(16 + i * 20, 84 + row * 70, 18, 28);
        }
        ctx.fillStyle = diff ? "#ffffff" : BASE_COLORS[b];
        ctx.fillText(b, 18 + i * 20, 106 + row * 70);
      });
    });
    ctx.fillStyle = accent;
    ctx.font = `600 14px ${MONO}`;
    ctx.fillText("SUBSTITUIÇÃO DETECTADA · POSIÇÃO 12 · A→G", 18, H - 24);
  }

  draw_caio(ctx, W, H, t, accent) {
    // Chamada de vídeo: retrato estilizado do Dr. Caio.
    const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 10, W * 0.5, H * 0.5, W * 0.6);
    g.addColorStop(0, "#1d3d52");
    g.addColorStop(1, "#071219");
    ctx.fillStyle = g;
    ctx.fillRect(0, 34, W, H);
    // Estante desfocada ao fundo.
    for (let i = 0; i < 9; i += 1) {
      ctx.fillStyle = `rgba(${120 + i * 9},${150 + i * 5},${170},0.08)`;
      ctx.fillRect(30 + i * 52, 70, 30, 90 + (i % 3) * 14);
    }
    const sway = Math.sin(t * 0.0012) * 3;
    const cx = W / 2 + sway, cy = H * 0.54;
    // Ombros e jaleco.
    ctx.fillStyle = "#dfe8ec";
    ctx.beginPath();
    ctx.moveTo(cx - 150, H);
    ctx.bezierCurveTo(cx - 140, cy + 60, cx - 70, cy + 40, cx, cy + 40);
    ctx.bezierCurveTo(cx + 70, cy + 40, cx + 140, cy + 60, cx + 150, H);
    ctx.fill();
    ctx.fillStyle = "#2c5970";
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy + 40); ctx.lineTo(cx, cy + 100); ctx.lineTo(cx + 34, cy + 40); ctx.fill();
    // Pescoço e cabeça.
    ctx.fillStyle = "#b07a5a";
    ctx.fillRect(cx - 18, cy + 4, 36, 42);
    ctx.beginPath(); ctx.ellipse(cx, cy - 30, 46, 56, 0, 0, Math.PI * 2); ctx.fill();
    // Cabelo e barba curta.
    ctx.fillStyle = "#2a1d16";
    ctx.beginPath(); ctx.ellipse(cx, cy - 66, 48, 26, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 48, cy - 66, 10, 30);
    ctx.fillRect(cx + 38, cy - 66, 10, 30);
    ctx.fillStyle = "rgba(42,29,22,0.55)";
    ctx.beginPath(); ctx.ellipse(cx, cy + 4, 34, 20, 0, 0, Math.PI); ctx.fill();
    // Óculos.
    ctx.strokeStyle = "#11181c";
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 36, cy - 40, 28, 18);
    ctx.strokeRect(cx + 8, cy - 40, 28, 18);
    ctx.beginPath(); ctx.moveTo(cx - 8, cy - 32); ctx.lineTo(cx + 8, cy - 32); ctx.stroke();
    const blink = (t % 4200) < 140;
    ctx.fillStyle = "#11181c";
    if (!blink) {
      ctx.beginPath(); ctx.arc(cx - 22, cy - 31, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 22, cy - 31, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Faixa inferior da chamada.
    ctx.fillStyle = "rgba(3,10,14,0.78)";
    ctx.fillRect(0, H - 54, W, 54);
    ctx.fillStyle = "#e8fbf6";
    ctx.font = `700 17px ${SANS}`;
    ctx.fillText("DR. CAIO", 18, H - 30);
    ctx.fillStyle = "#8fb5ad";
    ctx.font = `13px ${SANS}`;
    ctx.fillText("Epidemiologista · chamada remota", 18, H - 12);
    ctx.fillStyle = this.active && Math.sin(t * 0.01) > 0 ? "#ff655f" : rgba("#ff655f", 0.4);
    ctx.beginPath(); ctx.arc(W - 30, H - 27, 8, 0, Math.PI * 2); ctx.fill();
  }

  draw_vitals(ctx, W, H, t, accent) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 120; i += 1) {
      const u = i / 120;
      const ph = (u * 3 + t * 0.0008) % 1;
      let v = 0;
      if (ph > 0.42 && ph < 0.46) v = -0.9;
      else if (ph > 0.46 && ph < 0.5) v = 0.5;
      else if (ph > 0.6 && ph < 0.7) v = -0.15 * Math.sin((ph - 0.6) * 31);
      const x = 14 + u * (W - 28), y = H * 0.48 + v * H * 0.3;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#e8fbf6";
    ctx.font = `700 44px ${MONO}`;
    ctx.fillText(`${72 + Math.round(Math.sin(t * 0.0005) * 4)}`, 20, H - 26);
    ctx.font = `14px ${MONO}`;
    ctx.fillStyle = "#8fb5ad";
    ctx.fillText("BPM · SpO₂ 97%", 120, H - 30);
  }

  draw_board(ctx, W, H, t, accent) {
    // Quadro de referência: estrutura de um vírus envelopado e notas.
    const cx = W * 0.3, cy = H * 0.56;
    ctx.strokeStyle = rgba(accent, 0.8);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2 + t * 0.0002;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70);
      ctx.lineTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 96, cy + Math.sin(a) * 96, 5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = rgba("#ffb84d", 0.85);
    ctx.beginPath();
    for (let i = 0; i < 60; i += 1) {
      const a = i * 0.32;
      const x = cx + Math.cos(a) * (20 + i * 0.6), y = cy + Math.sin(a) * (20 + i * 0.6);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#cfe9e3";
    ctx.font = `13px ${MONO}`;
    ["ENVELOPE LIPÍDICO", "PROTEÍNA DE SUPERFÍCIE", "GENOMA (RNA)", "PERÍODO DE INCUBAÇÃO", "VIAS DE TRANSMISSÃO"].forEach((s, i) => {
      ctx.fillStyle = i < 3 ? accent : "#8fb5ad";
      ctx.fillRect(W * 0.6, 66 + i * 44, 8, 8);
      ctx.fillStyle = "#cfe9e3";
      ctx.fillText(s, W * 0.6 + 18, 74 + i * 44);
    });
  }

  draw_final(ctx, W, H, t, accent) {
    ctx.fillStyle = "#e8fbf6";
    ctx.font = `700 20px ${SANS}`;
    ctx.fillText("DECISÃO FINAL", 20, 72);
    ["Comitê de crise", "Hospitais", "Laboratório", "Comunicação"].forEach((s, i) => {
      const on = this.complete || (t / 900 + i) % 5 > 1;
      ctx.fillStyle = on ? accent : rgba(accent, 0.25);
      ctx.beginPath(); ctx.arc(30, 112 + i * 40, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#cfe9e3";
      ctx.font = `15px ${SANS}`;
      ctx.fillText(s, 48, 117 + i * 40);
    });
  }
}
