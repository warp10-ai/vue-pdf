import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { TextContent } from "pdfjs-dist/types/src/display/text_layer";
import type { HighlightMatcher, Match } from "../types";
import {
  placeGlyphs,
  screenScale,
  snapToGlyphs,
  type GlyphLayer,
} from "./glyphs";

export interface DrawnHighlight {
  element: HTMLElement;
  text: string;
  key: string | number;
  keyword: string;
  box: DOMRect;
}

function createHighlightElement(
  id: string,
  styleProps: Partial<CSSStyleDeclaration>,
  content: string,
  match: Match,
  customHighlightClass: string,
): HTMLElement {
  const highlight = document.createElement("mark");
  highlight.id = id;
  highlight.className = `pdf-highlight ${customHighlightClass}`;

  Object.assign(highlight.style, styleProps);

  highlight.dataset.text = content;
  highlight.dataset.key = String(match.key);
  highlight.dataset.highlightId = String(match.key);
  highlight.dataset.keyword = match.keyword;
  return highlight;
}

function highlightMatches(
  matches: Match[],
  textContent: TextContent,
  textDivs: HTMLElement[],
  customHighlightClass: string,
  glyphLayer: GlyphLayer,
): DrawnHighlight[] {
  const drawn: DrawnHighlight[] = [];
  const { layer } = glyphLayer;
  const scale = screenScale(layer);
  const layerRect = layer.getBoundingClientRect();
  const placed = placeGlyphs(glyphLayer);

  function appendHighlightDiv(
    match: Match,
    idx: number,
    startOffset = -1,
    endOffset = -1,
  ) {
    const textItem = textContent.items[idx] as TextItem;
    const currentDiv = textDivs[idx];
    if (!currentDiv) return;

    // Determine content for data-text attribute
    let content = "";
    if (startOffset >= 0 && endOffset >= 0) {
      content = textItem.str.substring(startOffset, endOffset);
    } else if (startOffset < 0 && endOffset < 0) {
      content = textItem.str;
    } else if (startOffset >= 0) {
      content = textItem.str.substring(startOffset);
    } else if (endOffset >= 0) {
      content = textItem.str.substring(0, endOffset);
    }

    const highlightId = `highlight-${idx}-${startOffset}-${endOffset}`;
    // Create a range for the text
    const range = document.createRange();
    const textNode = currentDiv.firstChild;
    if (!textNode) return;

    // Set the range to the text we want to highlight
    range.setStart(textNode, startOffset >= 0 ? startOffset : 0);
    range.setEnd(
      textNode,
      endOffset >= 0 ? endOffset : textNode.textContent?.length || 0,
    );

    // Get the bounding rectangles of the range
    const rects = range.getClientRects();
    if (rects.length === 0) return;

    // Create highlight for each rectangle (in case text wraps)
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];

      // Calculate position relative to the text layer
      const y = (rect.top - layerRect.top) / scale;
      const left = (rect.left - layerRect.left) / scale;
      let snapped: ReturnType<typeof snapToGlyphs> = null;
      if (placed && rects.length === 1) {
        snapped = snapToGlyphs(placed, layer, content, {
          left,
          top: y,
          width: rect.width / scale,
          height: rect.height / scale,
        });
      }
      if (snapped && !snapped.visible) continue;
      const x = snapped?.left ?? left;
      const textWidth = snapped?.width ?? rect.width / scale;
      const height = rect.height / scale;

      const styleProps = {
        position: "absolute",
        top: `${y}px`,
        left: `${x}px`,
        width: `${textWidth}px`,
        height: `${height}px`,
        pointerEvents: "none",
        zIndex: "1",
        whiteSpace: "nowrap",
      };

      const highlightElement = createHighlightElement(
        `${highlightId}-${i}`,
        styleProps,
        content,
        match,
        customHighlightClass,
      );

      layer.appendChild(highlightElement);
      drawn.push({
        element: highlightElement,
        text: content,
        key: match.key,
        keyword: match.keyword,
        box: new DOMRect(x, y, textWidth, height),
      });
    }
  }

  function highlightLine(
    match: Match,
    start: Match["start"],
    end: Match["end"],
  ) {
    const itemLength = (idx: number) => {
      const item = textContent.items[idx] as TextItem | undefined;
      return item?.str.length ?? 0;
    };
    while (start.idx < end.idx && start.offset >= itemLength(start.idx)) {
      start = { idx: start.idx + 1, offset: 0 };
    }
    while (end.idx > start.idx && end.offset === 0) {
      end = { idx: end.idx - 1, offset: itemLength(end.idx - 1) };
    }
    if (start.idx === end.idx) {
      if (end.offset > start.offset) {
        appendHighlightDiv(match, start.idx, start.offset, end.offset);
      }
      return;
    }
    handleMultiDivHighlight({ ...match, start, end });
  }

  function handleMultiDivHighlight(match: Match) {
    const startDiv = textDivs[match.start.idx];
    const endDiv = textDivs[match.end.idx];
    const startItem = textContent.items[match.start.idx] as TextItem;
    const endItem = textContent.items[match.end.idx] as TextItem;

    if (!startDiv || !endDiv || !startItem || !endItem) return;

    const highlightId = `highlight-${match.start.idx}-${match.start.offset}-${match.end.idx}-${match.end.offset}`;
    const startText = startDiv.firstChild;
    const endText = endDiv.firstChild;
    if (!startText || !endText) return;
    const range = document.createRange();
    range.setStart(startText, match.start.offset);
    range.setEnd(endText, match.end.offset);
    const rect = range.getBoundingClientRect();
    const left = (rect.left - layerRect.left) / scale;
    const right = (rect.right - layerRect.left) / scale;
    const top = (rect.top - layerRect.top) / scale;
    const height = rect.height / scale;

    const highlightText = textContent.items
      .slice(match.start.idx, match.end.idx + 1)
      .map((item, index) => {
        if (!("str" in item)) return "";
        let text = item.str;
        if (index === 0) text = text.substring(match.start.offset);
        if (index === match.end.idx - match.start.idx) {
          text = text.substring(0, match.end.offset);
        }
        return text;
      })
      .join("");

    let snapped: ReturnType<typeof snapToGlyphs> = null;
    if (placed) {
      snapped = snapToGlyphs(placed, layer, highlightText, {
        left,
        top,
        width: right - left,
        height,
      });
    }
    if (snapped && !snapped.visible) return;
    const x = snapped?.left ?? left;
    const width = snapped?.width ?? right - left;
    const box = new DOMRect(x, top, width, height);

    const styleProps = {
      position: "absolute",
      top: `${box.top}px`,
      left: `${box.left}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      pointerEvents: "none",
      zIndex: "1",
      whiteSpace: "nowrap",
    };

    const highlight = createHighlightElement(
      highlightId,
      styleProps,
      highlightText,
      match,
      customHighlightClass,
    );

    layer.appendChild(highlight);
    drawn.push({
      element: highlight,
      text: highlightText,
      key: match.key,
      keyword: match.keyword,
      box,
    });
  }

  for (const match of matches) {
    if (match.start.idx === match.end.idx) {
      // Single div case
      appendHighlightDiv(
        match,
        match.start.idx,
        match.start.offset,
        match.end.offset,
      );
    } else if (match.isMultiDivByLineBreak) {
      let lineStart = match.start;
      for (let idx = match.start.idx; idx <= match.end.idx; idx++) {
        const textItem = textContent.items[idx] as TextItem;
        const isLastItem = idx === match.end.idx;
        if (!isLastItem && !textItem?.hasEOL) continue;

        highlightLine(
          match,
          lineStart,
          isLastItem ? match.end : { idx, offset: textItem.str.length },
        );
        lineStart = { idx: idx + 1, offset: 0 };
      }
    } else if (match.isMultiDivSameLine) {
      // Multiple divs in same line without line breaks
      handleMultiDivHighlight(match);
    }
  }
  return drawn;
}

function matchesFromMatcher(
  matcher: HighlightMatcher,
  textContent: TextContent,
): Match[] {
  const items = textContent.items as TextItem[];
  const positions: Array<{ idx: number; offset: number } | null> = [];
  let text = "";

  items.forEach((item, idx) => {
    const str = item.str ?? "";
    for (let offset = 0; offset < str.length; offset++) {
      text += str[offset];
      positions.push({ idx, offset });
    }
    if (item.hasEOL && !text.endsWith("-")) {
      text += " ";
      positions.push(null);
    }
  });

  const hasLineBreak = (startIdx: number, endIdx: number) => {
    return items.slice(startIdx, endIdx).some((item) => item.hasEOL);
  };

  const ranges = [...matcher(text)];
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  let covered = 0;

  const matches: Match[] = [];
  for (const range of ranges) {
    if (range.start < covered) continue;
    let { start, end } = range;
    // Line-break spaces have no character on the page to anchor a highlight to
    while (start < end && !positions[start]) start++;
    while (end > start && !positions[end - 1]) end--;
    const first = positions[start];
    const last = positions[end - 1];
    if (!first || !last || end <= start) continue;
    covered = range.end;

    const isMultiDiv = first.idx !== last.idx;
    const crossesLine = isMultiDiv && hasLineBreak(first.idx, last.idx);
    matches.push({
      start: { idx: first.idx, offset: first.offset },
      end: { idx: last.idx, offset: last.offset + 1 },
      str: text.slice(start, end),
      index: start,
      key: range.key,
      keyword: range.keyword,
      isMultiDivByLineBreak: crossesLine,
      isMultiDivSameLine: isMultiDiv && !crossesLine,
    });
  }
  return matches;
}

export { highlightMatches, matchesFromMatcher };
