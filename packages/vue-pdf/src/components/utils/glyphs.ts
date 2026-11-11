import { OPS, Util } from "pdfjs-dist";
import type { PageViewport, PDFPageProxy } from "pdfjs-dist";

type Matrix = [number, number, number, number, number, number];
type Box = [number, number, number, number];

interface Glyph {
  unicode: string;
  width: number;
  isSpace: boolean;
}

interface FontInfo {
  fontMatrix?: number[];
  vertical?: boolean;
}

export interface PageGlyph {
  text: string;
  start: [number, number];
  end: [number, number];
  visible: boolean;
}

export interface GlyphLayer {
  glyphs: PageGlyph[];
  layer: HTMLElement;
  viewport: PageViewport;
}

interface TextState {
  ctm: Matrix;
  textMatrix: Matrix;
  x: number;
  y: number;
  lineX: number;
  lineY: number;
  leading: number;
  charSpacing: number;
  wordSpacing: number;
  textHScale: number;
  textRise: number;
  fontSize: number;
  fontDirection: number;
  font?: FontInfo;
  clip?: Box;
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const FONT_IDENTITY_MATRIX = [0.001, 0, 0, 0.001, 0, 0];

export const getGlyphs = (page: PDFPageProxy): Promise<PageGlyph[]> => {
  return extractGlyphs(page).catch(() => []);
};

export function screenScale(element: HTMLElement): number {
  if (!element.offsetWidth) return 1;
  return element.getBoundingClientRect().width / element.offsetWidth;
}

interface PlacedGlyph {
  text: string;
  left: number;
  right: number;
  baseline: number;
  visible: boolean;
}

export interface PlacedGlyphs {
  glyphs: PlacedGlyph[];
  layer: HTMLElement;
  scale: number;
}

export function placeGlyphs(glyphLayer: GlyphLayer): PlacedGlyphs | null {
  const { glyphs, layer, viewport } = glyphLayer;
  const layerWidth = layer.getBoundingClientRect().width;
  if (viewport.rotation % 360 !== 0 || !viewport.width || !layerWidth) {
    return null;
  }
  const scale = screenScale(layer);
  const ratio = layerWidth / scale / viewport.width;

  const placed: PlacedGlyph[] = [];
  for (const glyph of glyphs) {
    const text = normalizeText(glyph.text);
    if (!text) continue;
    const [startX, baseline] = viewport.convertToViewportPoint(...glyph.start);
    const [endX] = viewport.convertToViewportPoint(...glyph.end);
    placed.push({
      text,
      left: Math.min(startX, endX) * ratio,
      right: Math.max(startX, endX) * ratio,
      baseline: baseline * ratio,
      visible: glyph.visible,
    });
  }
  placed.sort((a, b) => a.baseline - b.baseline);
  return { glyphs: placed, layer, scale };
}

export function snapToGlyphs(
  placed: PlacedGlyphs,
  container: HTMLElement,
  text: string,
  box: { left: number; top: number; width: number; height: number },
): { left: number; width: number; visible: boolean } | null {
  const target = normalizeText(text);
  if (!target) return null;

  const layerRect = placed.layer.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offsetX = (layerRect.left - containerRect.left) / placed.scale;
  const offsetY = (layerRect.top - containerRect.top) / placed.scale;

  const lineTop = box.top - offsetY - 1;
  const lineBottom = box.top + box.height - offsetY + 1;
  const { glyphs } = placed;
  let low = 0;
  let high = glyphs.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (glyphs[middle].baseline < lineTop) low = middle + 1;
    else high = middle;
  }
  let end = low;
  while (end < glyphs.length && glyphs[end].baseline <= lineBottom) end++;
  const line = glyphs.slice(low, end).map((glyph) => ({
    ...glyph,
    left: glyph.left + offsetX,
    right: glyph.right + offsetX,
  }));
  line.sort((a, b) => a.left - b.left);

  let lineText = "";
  const glyphAt: number[] = [];
  for (const [index, glyph] of line.entries()) {
    lineText += glyph.text;
    for (let i = 0; i < glyph.text.length; i++) glyphAt.push(index);
  }

  let best: { left: number; right: number; visible: boolean } | null = null;
  let found = lineText.indexOf(target);
  while (found !== -1) {
    const first = glyphAt[found];
    const last = glyphAt[found + target.length - 1];
    const left = line[first].left;
    if (!best || Math.abs(left - box.left) < Math.abs(best.left - box.left)) {
      const matchedGlyphs = line.slice(first, last + 1);
      const visible = matchedGlyphs.some((glyph) => glyph.visible);
      best = { left, right: line[last].right, visible };
    }
    found = lineText.indexOf(target, found + 1);
  }

  // measured on the 19 sample PDFs - real corrections reach 1.4 line heights; wrong
  // same-word matches start at 10. 3 sits between with room on both sides
  if (!best || Math.abs(best.left - box.left) > box.height * 3) return null;
  return {
    left: best.left,
    width: best.right - best.left,
    visible: best.visible,
  };
}

function transformBox(box: number[], matrix: Matrix): Box {
  const corners = [
    Util.applyTransform([box[0], box[1]], matrix),
    Util.applyTransform([box[2], box[1]], matrix),
    Util.applyTransform([box[0], box[3]], matrix),
    Util.applyTransform([box[2], box[3]], matrix),
  ];
  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function normalizeText(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

async function extractGlyphs(page: PDFPageProxy): Promise<PageGlyph[]> {
  const { fnArray, argsArray } = await page.getOperatorList();

  const ids = new Set<string>();
  fnArray.forEach((fn, i) => {
    if (fn === OPS.setFont) ids.add(argsArray[i][0]);
    if (fn !== OPS.setGState) return;
    for (const [key, value] of argsArray[i][0]) {
      if (key === "Font") ids.add(value[0]);
    }
  });
  const fonts = new Map<string, FontInfo>();
  const loadFont = (name: string) =>
    new Promise<void>((resolve) => {
      page.commonObjs.get(name, (font: FontInfo) => {
        fonts.set(name, font);
        resolve();
      });
    });
  await Promise.all([...ids].map(loadFont));

  const glyphs: PageGlyph[] = [];
  const stack: TextState[] = [];
  let state: TextState = {
    ctm: IDENTITY,
    textMatrix: IDENTITY,
    x: 0,
    y: 0,
    lineX: 0,
    lineY: 0,
    leading: 0,
    charSpacing: 0,
    wordSpacing: 0,
    textHScale: 1,
    textRise: 0,
    fontSize: 0,
    fontDirection: 1,
  };

  const setFont = (name: string, size: number) => {
    state.font = fonts.get(name);
    state.fontDirection = size < 0 ? -1 : 1;
    state.fontSize = Math.abs(size);
  };
  const moveText = (x: number, y: number) => {
    state.x = state.lineX += x;
    state.y = state.lineY += y;
  };
  const addClip = (box: Box | null) => {
    if (!box) return;
    const clip = state.clip ?? box;
    state.clip = [
      Math.max(clip[0], box[0]),
      Math.max(clip[1], box[1]),
      Math.min(clip[2], box[2]),
      Math.min(clip[3], box[3]),
    ];
  };
  let pathBox: Box | null = null;

  fnArray.forEach((fn, i) => {
    const args = argsArray[i];
    switch (fn) {
      case OPS.save:
      case OPS.paintFormXObjectBegin:
        stack.push(state);
        state = { ...state };
        if (fn === OPS.paintFormXObjectBegin && args?.[0]) {
          state.ctm = Util.transform(state.ctm, args[0]) as Matrix;
        }
        if (fn === OPS.paintFormXObjectBegin && args?.[1]) {
          addClip(transformBox(args[1], state.ctm));
        }
        break;
      case OPS.constructPath:
        pathBox = args?.[2] ? transformBox(args[2], state.ctm) : null;
        break;
      case OPS.clip:
      case OPS.eoClip:
        addClip(pathBox);
        break;
      case OPS.restore:
      case OPS.paintFormXObjectEnd:
        state = stack.pop() ?? state;
        break;
      case OPS.transform:
        state.ctm = Util.transform(state.ctm, args) as Matrix;
        break;
      case OPS.beginText:
        state.textMatrix = IDENTITY;
        state.x = state.lineX = 0;
        state.y = state.lineY = 0;
        break;
      case OPS.setTextMatrix:
        state.textMatrix = args as Matrix;
        state.x = state.lineX = 0;
        state.y = state.lineY = 0;
        break;
      case OPS.moveText:
        moveText(args[0], args[1]);
        break;
      case OPS.setLeadingMoveText:
        state.leading = args[1];
        moveText(args[0], args[1]);
        break;
      case OPS.setLeading:
        state.leading = -args[0];
        break;
      case OPS.nextLine:
        moveText(0, state.leading);
        break;
      case OPS.setCharSpacing:
        state.charSpacing = args[0];
        break;
      case OPS.setWordSpacing:
        state.wordSpacing = args[0];
        break;
      case OPS.setHScale:
        state.textHScale = args[0] / 100;
        break;
      case OPS.setTextRise:
        state.textRise = args[0];
        break;
      case OPS.setFont:
        setFont(args[0], args[1]);
        break;
      case OPS.setGState:
        for (const [key, value] of args[0]) {
          if (key === "Font") setFont(value[0], value[1]);
        }
        break;
      case OPS.showText:
        showText(args[0] as Array<Glyph | number>);
        break;
    }
  });

  // mirrors the horizontal-text branch of pdf.js - CanvasGraphics.showText
  function showText(items: Array<Glyph | number>) {
    const font = state.font;
    if (!font || font.vertical) return;
    const fontMatrix = font.fontMatrix ?? FONT_IDENTITY_MATRIX;
    const widthAdvanceScale = state.fontSize * fontMatrix[0];
    const textHScale = state.textHScale * state.fontDirection;
    const toPage = (x: number, rise = 0): [number, number] => {
      const point = Util.applyTransform(
        [state.x + x * textHScale, state.y + state.textRise + rise],
        state.textMatrix,
      );
      return Util.applyTransform(point, state.ctm) as [number, number];
    };
    const clip = state.clip;

    const { charSpacing, wordSpacing } = state;
    let x = 0;
    for (const item of items) {
      if (typeof item === "number") {
        x -= (item * state.fontSize) / 1000;
        continue;
      }
      const spacing = charSpacing + (item.isSpace ? wordSpacing : 0);
      const advance = item.width * widthAdvanceScale;
      const [midX, midY] = toPage(x + advance / 2, state.fontSize / 3);
      const insideX = !clip || (midX >= clip[0] && midX <= clip[2]);
      const insideY = !clip || (midY >= clip[1] && midY <= clip[3]);
      glyphs.push({
        text: item.unicode,
        start: toPage(x),
        end: toPage(x + advance),
        visible: insideX && insideY,
      });
      x += advance + spacing * state.fontDirection;
    }
    state.x += x * textHScale;
  }

  return glyphs;
}
