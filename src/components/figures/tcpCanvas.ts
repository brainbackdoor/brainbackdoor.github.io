import { progressAt, tcpLabels, TCP_TIME, type FigureLanguage, type TcpScenario } from './tcp';
import { FIGURE_COLORS as F } from './lessonCanvas';

export interface FigureColors {
  bg: string; plot: string; grid: string; line: string; blue: string; green: string;
  orange: string; red: string; text: string; muted: string;
  blueText: string; greenText: string; orangeText: string; redText: string;
}
export function readFigureColors(element: HTMLElement): FigureColors {
  const css = getComputedStyle(element);
  const token = (name: string, fallback: string) => css.getPropertyValue(`--color-figure-${name}`).trim() || fallback;
  return {
    bg: token('bg', F.bg), plot: token('plot', F.plot), grid: token('grid', F.grid), line: token('line', F.line),
    blue: token('blue', F.blue), green: token('green', F.green), orange: token('orange', F.orange), red: token('red', F.red),
    text: token('text', F.text), muted: token('muted', F.muted), blueText: token('blue-text', F.blueText),
    greenText: token('green-text', F.greenText), orangeText: token('orange-text', F.orangeText), redText: token('red-text', F.redText),
  };
}

type Point = [number, number];
export const TCP_HEIGHT = 306;
export const tcpY = (time: number, height = TCP_HEIGHT) => 42 + (time / 5400) * (height - 62);

export function drawTcp(ctx: CanvasRenderingContext2D, width: number, dpr: number, elapsed: number, scenario: TcpScenario, lang: FigureLanguage, colors: FigureColors, font: string, height = TCP_HEIGHT) {
  const labels = tcpLabels[lang];
  const y = (time: number) => tcpY(time, height);
  const left = 34;
  const right = width - 34;
  const center = (left + right) / 2;
  const loss = scenario === 'loss';
  const progress = (start: number, end: number) => progressAt(elapsed, start, end);
  function text(label: string, x: number, y: number, color = colors.muted, size = 11, align: CanvasTextAlign = 'center') {
    ctx.fillStyle = color;
    ctx.font = `400 ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.fillText(label, x, y);
  }
  function stroke(from: Point, to: Point, color: string, lineWidth = 1, dash: number[] = []) {
    ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.moveTo(...from); ctx.lineTo(...to); ctx.stroke(); ctx.setLineDash([]);
  }
  function packet(start: number, end: number, fromX: number, toX: number, label: string, color: string, labelColor: string, lost = false) {
    if (elapsed < start) return;
    const p = progress(start, end);
    const from: Point = [fromX, y(start)];
    const to: Point = [toX, y(end)];
    const head: Point = [fromX + (toX - fromX) * p, from[1] + (to[1] - from[1]) * p];
    stroke(from, head, color, 2, lost ? [4, 3] : []);
    if (p >= 1 && !lost) {
      const angle = Math.atan2(to[1] - from[1], toX - fromX);
      stroke([toX - 6 * Math.cos(angle - .5), to[1] - 6 * Math.sin(angle - .5)], to, color, 2);
      stroke([toX - 6 * Math.cos(angle + .5), to[1] - 6 * Math.sin(angle + .5)], to, color, 2);
    }
    if (p < 1) {
      ctx.beginPath(); ctx.arc(...head, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = colors.bg; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.save(); ctx.globalAlpha = progress(start, start + 240);
    text(label, (fromX + toX) / 2, (from[1] + to[1]) / 2 - 9, labelColor);
    ctx.restore();
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.plot; ctx.fillRect(8, 31, width - 16, height - 43);
  for (let time = 0; time <= 5400; time += 900) stroke([left - 7, y(time)], [right + 7, y(time)], colors.grid);
  stroke([left, 37], [left, height - 15], colors.line, 1, [3, 4]);
  stroke([right, 37], [right, height - 15], colors.line, 1, [3, 4]);
  text(labels.sender, left, 19, colors.text, 11);
  text(labels.receiver, right, 19, colors.text, 11);
  text(labels.time, width - 2, height - 1, colors.muted, 10, 'right');
  if (elapsed >= TCP_TIME.send) {
    const cursor = y(Math.min(elapsed, loss ? TCP_TIME.recovered : TCP_TIME.confirmed));
    stroke([left - 5, cursor], [right + 5, cursor], colors.muted, 1, [2, 4]);
  }
  if (!loss) {
    packet(TCP_TIME.send, TCP_TIME.received, left, right, `SEQ 1000 · ${labels.bytes}`, colors.blue, colors.blueText);
    packet(TCP_TIME.ack, TCP_TIME.confirmed, right, left, 'ACK 1100', colors.green, colors.greenText);
    if (elapsed >= TCP_TIME.confirmed) {
      ctx.save(); ctx.globalAlpha = progress(TCP_TIME.confirmed + 120, TCP_TIME.confirmed + 470);
      text(labels.complete, center, y(TCP_TIME.confirmed) + 29, colors.greenText, 12); ctx.restore();
    }
    return;
  }
  packet(TCP_TIME.send, TCP_TIME.lost, left, center, 'SEQ 1000', colors.blue, colors.blueText, true);
  if (elapsed >= TCP_TIME.lost) {
    ctx.save(); ctx.globalAlpha = progress(TCP_TIME.lost, TCP_TIME.lost + 180);
    stroke([center - 4, y(TCP_TIME.lost) - 4], [center + 4, y(TCP_TIME.lost) + 4], colors.red, 2);
    stroke([center + 4, y(TCP_TIME.lost) - 4], [center - 4, y(TCP_TIME.lost) + 4], colors.red, 2);
    text(labels.lost, center + 13, y(TCP_TIME.lost) + 3, colors.redText, 11, 'left'); ctx.restore();
  }
  if (elapsed >= TCP_TIME.send) {
    const timerX = left - 15;
    stroke([timerX, y(TCP_TIME.send)], [timerX, y(TCP_TIME.timeout)], colors.grid, 3);
    stroke([timerX, y(TCP_TIME.send)], [timerX, y(Math.min(elapsed, TCP_TIME.timeout))], colors.orange, 3);
    if (elapsed >= TCP_TIME.lost && elapsed < TCP_TIME.timeout) {
      text(`${labels.wait} · ${Math.floor(progress(TCP_TIME.send, TCP_TIME.timeout) * 100)}%`, left + 13, y(2300), colors.orangeText, 11, 'left');
    } else if (elapsed >= TCP_TIME.timeout) {
      text(labels.timeout, left + 13, y(2300), colors.orangeText, 11, 'left');
      stroke([timerX - 3, y(TCP_TIME.timeout)], [timerX + 3, y(TCP_TIME.timeout)], colors.orange, 1.5);
      stroke([timerX, y(TCP_TIME.timeout) + 6], [timerX, Math.max(y(TCP_TIME.timeout) + 6, y(Math.min(elapsed, TCP_TIME.recovered)))], elapsed >= TCP_TIME.recovered ? colors.line : colors.orange, 2);
    }
  }
  packet(TCP_TIME.timeout, TCP_TIME.retried, left, right, `SEQ 1000 · ${labels.retry}`, colors.blue, colors.blueText);
  packet(TCP_TIME.retryAck, TCP_TIME.recovered, right, left, 'ACK 1100', colors.green, colors.greenText);
  if (elapsed >= TCP_TIME.recovered) {
    ctx.save(); ctx.globalAlpha = progress(TCP_TIME.recovered + 120, TCP_TIME.recovered + 470);
    text(labels.complete, center, height - 14, colors.greenText, 12); ctx.restore();
  }
}
