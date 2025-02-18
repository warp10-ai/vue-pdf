import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { TextContent } from "pdfjs-dist/types/src/display/text_layer";
import type { HighlightOptions, Match } from "../types";

const measurementsCache = new Map<string, DOMRect>();
const computedStylesCache = new WeakMap<HTMLElement, CSSStyleDeclaration>();
const textItemsCache = new Map<string, TextItem[]>();

function getMeasurements(div: HTMLElement, text: string): DOMRect {
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
}

function getComputedStylesFor(element: HTMLElement): CSSStyleDeclaration {
  if (!computedStylesCache.has(element)) {
    computedStylesCache.set(element, window.getComputedStyle(element));
  }
  return computedStylesCache.get(element)!;
}

function getTextItemsSlice(
  textContent: TextContent,
  start: number,
  end: number
): TextItem[] {
  const key = `${start}-${end}`;
  if (!textItemsCache.has(key)) {
    textItemsCache.set(
      key,
      textContent.items.slice(start, end + 1) as TextItem[]
    );
  }
  return textItemsCache.get(key)!;
}

function searchQuery(
  textContent: TextContent,
  query: string,
  options: HighlightOptions
) {
  const strs = [];
  for (const textItem of textContent.items as TextItem[]) {
    if (textItem.hasEOL) {
      // Remove the break line hyphen in the middle of the sentence
      if (textItem.str.endsWith("-")) {
        const lastHyphen = textItem.str.lastIndexOf("-");
        strs.push(textItem.str.substring(0, lastHyphen));
      } else {
        strs.push(textItem.str, "\n");
      }
    } else {
      strs.push(textItem.str);
    }
  }

  // Join the text as is presented in textlayer and then replace newlines (/n) with whitespaces
  const textJoined = strs.join("").replace(/\n/g, " ");

  const regexFlags = ["g"];
  if (options.ignoreCase) regexFlags.push("i");

  // Trim the query and escape all regex special characters
  let fquery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (options.completeWords) fquery = `\\b${fquery}\\b`;

  const regex = new RegExp(fquery, regexFlags.join(""));

  const matches = [];
  let match;

  // eslint-disable-next-line no-cond-assign

  while ((match = regex.exec(textJoined)) !== null)
    matches.push([match.index, match[0].length, match[0]]);

  return matches;
}

function convertMatches(
  matches: (number | string)[][],
  textContent: TextContent
): Match[] {
  function endOfLineOffset(item: TextItem) {
    if (item.hasEOL) {
      if (item.str.endsWith("-")) return -1;
      else return 1;
    }
    return 0;
  }

  function areInSameLine(startIdx: number, endIdx: number): boolean {
    for (let i = startIdx; i < endIdx; i++) {
      if ((textContent.items[i] as TextItem).hasEOL) {
        return false;
      }
    }
    return true;
  }

  let index = 0;
  let tindex = 0;
  const textItems = textContent.items as TextItem[];
  const end = textItems.length - 1;

  const convertedMatches = [];

  for (let m = 0; m < matches.length; m++) {
    let mindex = matches[m][0] as number;

    while (index !== end && mindex >= tindex + textItems[index].str.length) {
      const item = textItems[index];
      tindex += item.str.length + endOfLineOffset(item);
      index++;
    }

    const divStart = {
      idx: index,
      offset: mindex - tindex,
    };

    mindex += matches[m][1] as number;

    while (index !== end && mindex > tindex + textItems[index].str.length) {
      const item = textItems[index];
      tindex += item.str.length + endOfLineOffset(item);
      index++;
    }

    const divEnd = {
      idx: index,
      offset: mindex - tindex,
    };

    const isMultiDiv = divStart.idx !== divEnd.idx;
    const areSameLine = areInSameLine(divStart.idx, divEnd.idx);

    const isMultiDivByLineBreak = isMultiDiv && !areSameLine;
    const isMultiDivSameLine = isMultiDiv && areSameLine;

    convertedMatches.push({
      start: divStart,
      end: divEnd,
      str: matches[m][2] as string,
      index: matches[m][0] as number,
      key: "",
      keyword: "",
      isMultiDivByLineBreak,
      isMultiDivSameLine,
    });
  }

  return convertedMatches;
}

function highlightMatches(
  matches: Match[],
  textContent: TextContent,
  textDivs: HTMLElement[],
  customHighlightClass: string = "highlight",
  activeHighlightTextColor?: string,
  customActiveHighlightClass?: string,
  activeHighlightText?: string,
  onHighlightClick?: (
    event: MouseEvent,
    text: string,
    key: string | number,
    keyword: string
  ) => void,
  onHighlightMouseEnter?: (
    event: MouseEvent,
    text: string,
    key: string | number,
    keyword: string
  ) => void,
  onHighlightMouseLeave?: () => void
) {
  // Initialize container and setup event delegation
  const container = textDivs[0]?.parentElement;
  if (!container) return;

  // Setup event delegation
  container.addEventListener("mouseover", (event) => {
    const target = event.target as HTMLElement;
    const highlight = target.closest(".highlight-text, .highlight");
    if (highlight && highlight instanceof HTMLElement) {
      const { text, key, keyword } = highlight.dataset;
      if (text && key && keyword) {
        onHighlightMouseEnter?.(event, text, key, keyword);
      }
    }
  });

  container.addEventListener("mouseleave", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest(".highlight-text, .highlight")) {
      onHighlightMouseLeave?.();
    }
  });

  if (onHighlightClick) {
    container.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const highlight = target.closest(".highlight-text, .highlight");
      if (highlight && highlight instanceof HTMLElement) {
        const { text, key, keyword } = highlight.dataset;
        if (text && key && keyword) {
          event.stopPropagation();
          onHighlightClick(event, text, key, keyword);
        }
      }
    });
  }

  function appendHighlightDiv(
    match: Match,
    idx: number,
    startOffset = -1,
    endOffset = -1
  ) {
    const textItem = textContent.items[idx] as TextItem;
    const div = textDivs[idx];
    if (!div) return;

    const fragment = document.createDocumentFragment();
    const nodes: Node[] = [];

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

    const span = document.createElement("span");
    const node = document.createTextNode(content);

    let highlightClass = customHighlightClass;
    if (
      match.keyword &&
      match.keyword.toLowerCase() === activeHighlightText?.toLowerCase() &&
      customActiveHighlightClass
    ) {
      highlightClass = customActiveHighlightClass;
      if (activeHighlightTextColor) {
        span.style.color = activeHighlightTextColor;
      }
    }

    span.className = `${highlightClass} appended`;
    span.dataset.text = content;
    span.dataset.key = String(match.key);
    span.dataset.keyword = match.keyword;

    if (onHighlightClick && match.key && match.keyword) {
      span.style.cursor = "pointer";
    }

    span.append(node);
    nodes.push(span);

    if (startOffset > 0) {
      const prevContent = textItem.str.substring(0, startOffset);
      nodes.unshift(document.createTextNode(prevContent));
    }

    if (endOffset > 0) {
      const nextContent = textItem.str.substring(endOffset);
      nodes.push(document.createTextNode(nextContent));
    }

    nodes.forEach((node) => fragment.appendChild(node));
    div.replaceChildren(fragment);
  }

  function handleMultiDivHighlight(match: Match) {
    const startDiv = textDivs[match.start.idx];
    const endDiv = textDivs[match.end.idx];
    const startItem = textContent.items[match.start.idx] as TextItem;
    const endItem = textContent.items[match.end.idx] as TextItem;

    if (!startDiv || !endDiv || !startItem || !endItem || !container) return;

    const highlightId = `highlight-${match.start.idx}-${match.start.offset}-${match.end.idx}-${match.end.offset}`;
    let highlight = container.querySelector(`#${highlightId}`) as HTMLElement;

    if (!highlight) {
      highlight = document.createElement("span");
      highlight.id = highlightId;

      const startMeasure = getMeasurements(
        startDiv,
        startItem.str.substring(0, match.start.offset)
      );
      const endMeasure = getMeasurements(
        endDiv,
        endItem.str.substring(0, match.end.offset)
      );

      Object.assign(highlight.style, {
        position: "absolute",
        top: `${startDiv.offsetTop}px`,
        left: `${startDiv.offsetLeft + startMeasure.width}px`,
        width: `${
          endDiv.offsetLeft +
          endMeasure.width -
          (startDiv.offsetLeft + startMeasure.width)
        }px`,
        height: `${
          endDiv.offsetTop + endDiv.offsetHeight - startDiv.offsetTop
        }px`,
        pointerEvents: "all",
        zIndex: "1",
        whiteSpace: "nowrap",
      });

      highlight.dataset.text = getTextItemsSlice(
        textContent,
        match.start.idx,
        match.end.idx
      )
        .map((item) => item.str)
        .join(" ");
      highlight.dataset.key = String(match.key);
      highlight.dataset.keyword = match.keyword;

      if (onHighlightClick && match.key && match.keyword) {
        highlight.style.cursor = "pointer";
      }

      container.appendChild(highlight);
    }

    if (
      match.keyword &&
      match.keyword.toLowerCase() === activeHighlightText?.toLowerCase() &&
      customActiveHighlightClass
    ) {
      highlight.className = customActiveHighlightClass;
      if (activeHighlightTextColor) {
        highlight.style.color = activeHighlightTextColor;
      }

      let textContainer = highlight.querySelector(
        ".highlight-text"
      ) as HTMLDivElement | null;

      if (!textContainer) {
        textContainer = document.createElement("div");
        textContainer.className = "highlight-text";

        const highlightText = getTextItemsSlice(
          textContent,
          match.start.idx,
          match.end.idx
        )
          .map((item, index) => {
            let text = item.str;
            if (index === 0) {
              text = text.substring(match.start.offset);
            }
            if (index === match.end.idx - match.start.idx) {
              text = text.substring(0, match.end.offset);
            }
            return text;
          })
          .join("");

        const textNode = document.createTextNode(highlightText);
        textContainer.appendChild(textNode);

        const computedStyle = getComputedStylesFor(textDivs[match.start.idx]);
        const originalSize = parseFloat(computedStyle.fontSize);

        Object.assign(textContainer.style, {
          position: "absolute",
          top: "0",
          left: "0",
          color: activeHighlightTextColor || "inherit",
          fontFamily: computedStyle.fontFamily,
          fontWeight: computedStyle.fontWeight,
          fontSize: `${originalSize - 1}px`,
        });

        highlight.appendChild(textContainer);
      } else {
        textContainer.style.display = "block";
      }
    } else {
      highlight.className = customHighlightClass;
      const textContainer = highlight.querySelector(
        ".highlight-text"
      ) as HTMLElement;
      if (textContainer) {
        textContainer.style.display = "none";
      }
    }
  }

  for (const match of matches) {
    if (match.start.idx === match.end.idx) {
      // Single div case
      appendHighlightDiv(
        match,
        match.start.idx,
        match.start.offset,
        match.end.offset
      );
    } else if (match.isMultiDivByLineBreak) {
      // Has line breaks
      if (match.isMultiDivSameLine) {
        // Has multiple divs in at least one line
        handleMultiDivHighlight(match);
      } else {
        // Single div per line
        for (let idx = match.start.idx; idx <= match.end.idx; idx++) {
          const textItem = textContent.items[idx] as TextItem;
          if (!textItem) continue;

          if (idx === match.start.idx) {
            // First line
            appendHighlightDiv(
              match,
              idx,
              match.start.offset,
              textItem.str.length
            );
          } else if (idx === match.end.idx) {
            // Last line
            appendHighlightDiv(match, idx, 0, match.end.offset);
          } else {
            // Middle lines
            appendHighlightDiv(match, idx, 0, textItem.str.length);
          }
        }
      }
    } else if (match.isMultiDivSameLine) {
      // Multiple divs in same line without line breaks
      handleMultiDivHighlight(match);
    }
  }
}

function resetDivs(textContent: TextContent, textDivs: HTMLElement[]) {
  const textItems = textContent.items.map((val) => (val as TextItem).str);
  for (let idx = 0; idx < textDivs.length; idx++) {
    const div = textDivs[idx];

    if (div && div.nodeType !== Node.TEXT_NODE) {
      const textNode = document.createTextNode(textItems[idx]);
      div.replaceChildren(textNode);
    }
  }
}

function findMatches(
  queries: string[] | Array<{ keyword: string; key: string | number }>,
  textContent: TextContent,
  options: HighlightOptions
) {
  const convertedMatches = [];

  const normalizedQueries =
    Array.isArray(queries) && typeof queries[0] === "string"
      ? (queries as string[]).map((keyword) => ({ keyword, key: keyword }))
      : queries;

  for (const query of normalizedQueries) {
    const keyword = typeof query === "string" ? query : query.keyword;
    const key = typeof query === "string" ? keyword : query.key;

    const matches = searchQuery(textContent, keyword, options);

    const matchesWithKeys = convertMatches(matches, textContent).map(
      (match) => ({
        ...match,
        key: key as string | number,
        keyword: keyword as string,
      })
    );

    convertedMatches.push(...matchesWithKeys);
  }

  return convertedMatches;
}

export { findMatches, highlightMatches, resetDivs };
