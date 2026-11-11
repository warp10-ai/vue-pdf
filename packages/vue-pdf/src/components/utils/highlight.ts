import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { TextContent } from "pdfjs-dist/types/src/display/text_layer";
import type { HighlightMatcher, Match } from "../types";
import { snapToGlyphs, type GlyphLayer } from "./glyphs";

// Cache management
// ----------------
const measurementsCache = new Map<string, DOMRect>();

interface DOMHelpers {
  getMeasurements(div: HTMLElement, text: string): DOMRect;
}

const domHelpers: DOMHelpers = {
  getMeasurements(div: HTMLElement, text: string): DOMRect {
    const key = `${div.offsetTop}-${text}`;
    if (!measurementsCache.has(key)) {
      const measureDiv = document.createElement("span");
      measureDiv.textContent = text;
      measureDiv.style.visibility = "hidden";
      div.appendChild(measureDiv);
      const rect = measureDiv.getBoundingClientRect();
      div.removeChild(measureDiv);
      measurementsCache.set(key, rect);
    }
    return measurementsCache.get(key)!;
  },
};

interface HighlightEventHandlers {
  onClick?: (
    event: MouseEvent,
    text: string,
    key: string | number,
    keyword: string,
  ) => void;
  onMouseEnter?: (
    event: MouseEvent,
    text: string,
    key: string | number,
    keyword: string,
  ) => void;
  onMouseLeave?: () => void;
}

interface HighlightRenderOptions {
  customHighlightClass?: string;
  eventHandlers?: HighlightEventHandlers;
}

function createHighlightElement(
  id: string,
  styleProps: Partial<CSSStyleDeclaration>,
  content: string,
  match: Match,
  options: HighlightRenderOptions,
): HTMLElement {
  const highlight = document.createElement("mark");
  highlight.id = id;
  highlight.className = `pdf-highlight ${
    options.customHighlightClass || "highlight"
  }`;

  Object.assign(highlight.style, styleProps);

  highlight.dataset.text = content;
  highlight.dataset.key = String(match.key);
  highlight.dataset.highlightId = String(match.key);
  highlight.dataset.keyword = match.keyword;

  const { eventHandlers } = options;

  if (eventHandlers?.onClick && match.key && match.keyword) {
    highlight.style.cursor = "pointer";
    highlight.addEventListener("click", (event) => {
      event.stopPropagation();

      eventHandlers.onClick!(
        event,
        content,
        match.key as string | number,
        match.keyword as string,
      );
    });
  }

  highlight.addEventListener("mouseenter", (event) => {
    event.stopPropagation();
    eventHandlers?.onMouseEnter?.(
      event,
      content,
      match.key as string | number,
      match.keyword as string,
    );
  });

  highlight.addEventListener("mouseleave", (event) => {
    event.stopPropagation();
    eventHandlers?.onMouseLeave?.();
  });

  return highlight;
}

function highlightMatches(
  matches: Match[],
  textContent: TextContent,
  textDivs: HTMLElement[],
  customHighlightClass: string = "highlight",
  onHighlightClick?: (
    event: MouseEvent,
    text: string,
    key: string | number,
    keyword: string,
  ) => void,
  onHighlightMouseEnter?: (
    event: MouseEvent,
    text: string,
    key: string | number,
    keyword: string,
  ) => void,
  onHighlightMouseLeave?: () => void,
  glyphLayer?: GlyphLayer,
) {
  const renderOptions: HighlightRenderOptions = {
    customHighlightClass,
    eventHandlers: {
      onClick: onHighlightClick,
      onMouseEnter: onHighlightMouseEnter,
      onMouseLeave: onHighlightMouseLeave,
    },
  };

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

    const container = currentDiv.parentElement;
    if (!container) return;

    const highlightId = `highlight-${idx}-${startOffset}-${endOffset}`;
    const existingHighlights = container.querySelectorAll(
      `[id^="${highlightId}"]`,
    );

    if (existingHighlights.length === 0) {
      // Create a selection for the text
      const selection = window.getSelection();
      if (!selection) return;

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

      // Get the bounding rectangles of the selection
      const rects = range.getClientRects();
      if (rects.length === 0) return;

      // Get the container's position
      const containerRect = container.getBoundingClientRect();

      // Create highlight for each rectangle (in case text wraps)
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];

        // Calculate position relative to container
        const y = rect.top - containerRect.top;
        let snapped: ReturnType<typeof snapToGlyphs> = null;
        if (glyphLayer && rects.length === 1) {
          snapped = snapToGlyphs(glyphLayer, container, content, {
            left: rect.left - containerRect.left,
            top: y,
            width: rect.width,
            height: rect.height,
          });
        }
        if (snapped && !snapped.visible) continue;
        const x = snapped?.left ?? rect.left - containerRect.left;
        const textWidth = snapped?.width ?? rect.width;

        const styleProps = {
          position: "absolute",
          top: `${y}px`,
          left: `${x}px`,
          width: `${textWidth}px`,
          height: `${rect.height}px`,
          pointerEvents: "all",
          zIndex: "1",
          whiteSpace: "nowrap",
        };

        const highlightElement = createHighlightElement(
          `${highlightId}-${i}`,
          styleProps,
          content,
          match,
          renderOptions,
        );

        container.appendChild(highlightElement);
      }

      // Clear the selection
      selection.removeAllRanges();
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

    const container = startDiv.parentElement;
    if (!container) return;

    const highlightId = `highlight-${match.start.idx}-${match.start.offset}-${match.end.idx}-${match.end.offset}`;
    let highlight = container.querySelector(`#${highlightId}`) as HTMLElement;

    if (!highlight) {
      const startMeasure = domHelpers.getMeasurements(
        startDiv,
        startItem.str.substring(0, match.start.offset),
      );

      const endMeasure = domHelpers.getMeasurements(
        endDiv,
        endItem.str.substring(0, match.end.offset),
      );

      // Calculate the total width for multi-div highlights
      const totalWidth =
        endDiv.offsetLeft +
        endMeasure.width -
        (startDiv.offsetLeft + startMeasure.width);

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

      const estimatedLeft = startDiv.offsetLeft + startMeasure.width;
      let snapped: ReturnType<typeof snapToGlyphs> = null;
      if (glyphLayer) {
        snapped = snapToGlyphs(glyphLayer, container, highlightText, {
          left: estimatedLeft,
          top: startDiv.offsetTop,
          width: totalWidth,
          height: endDiv.offsetHeight,
        });
      }
      if (snapped && !snapped.visible) return;

      const styleProps = {
        position: "absolute",
        top: `${startDiv.offsetTop}px`,
        left: `${snapped?.left ?? estimatedLeft}px`,
        width: `${snapped?.width ?? totalWidth}px`,
        height: `${endDiv.offsetHeight}px`,
        pointerEvents: "all",
        zIndex: "1",
        whiteSpace: "nowrap",
      };

      highlight = createHighlightElement(
        highlightId,
        styleProps,
        highlightText,
        match,
        renderOptions,
      );

      container.appendChild(highlight);
    }
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

  const matches: Match[] = [];
  for (const range of matcher(text)) {
    const first = positions[range.start];
    const last = positions[range.end - 1];
    if (!first || !last || range.end <= range.start) continue;

    const isMultiDiv = first.idx !== last.idx;
    const crossesLine = isMultiDiv && hasLineBreak(first.idx, last.idx);
    matches.push({
      start: { idx: first.idx, offset: first.offset },
      end: { idx: last.idx, offset: last.offset + 1 },
      str: text.slice(range.start, range.end),
      index: range.start,
      key: range.key,
      keyword: range.keyword,
      isMultiDivByLineBreak: crossesLine,
      isMultiDivSameLine: isMultiDiv && !crossesLine,
    });
  }
  return matches;
}

export { highlightMatches, matchesFromMatcher };
