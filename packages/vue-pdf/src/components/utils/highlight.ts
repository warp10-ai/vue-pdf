import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { TextContent } from "pdfjs-dist/types/src/display/text_layer";
import type { HighlightOptions, Match } from "../types";
import { normalize } from "node:path";

// Cache management
// ----------------
const measurementsCache = new Map<string, DOMRect>();
let computedStylesCache = new WeakMap<HTMLElement, CSSStyleDeclaration>();

interface DOMHelpers {
  getMeasurements(div: HTMLElement, text: string): DOMRect;
  getComputedStylesFor(element: HTMLElement): CSSStyleDeclaration;
  clearCache(): void;
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

  getComputedStylesFor(element: HTMLElement): CSSStyleDeclaration {
    if (!computedStylesCache.has(element)) {
      computedStylesCache.set(element, window.getComputedStyle(element));
    }
    return computedStylesCache.get(element)!;
  },

  clearCache(): void {
    measurementsCache.clear();
    computedStylesCache = new WeakMap<HTMLElement, CSSStyleDeclaration>();
  },
};


function removeSpecialChars(text: string, customChars?: string[]): string {
  let result = text.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[®©™℠]/g, '')
    .replace(/[^\w\s]{5,}/g, '')
    .replace(/[^\w\s]+$/g, '') // Remove trailing special characters
    .trim();
  
  // Remove custom characters if provided
  if (customChars && customChars.length > 0) {
    const customRegex = new RegExp(`[${customChars.map(char => 
      char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('')}]`, 'g');
    result = result.replace(customRegex, '');
  }
  
  return result;
}

function searchQuery(
  textContent: TextContent,
  query: string,
  options: HighlightOptions
): Array<[number, number, string]> {
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

  // Split text into words, treating slashes as word separators
  // const textWords = textJoined
  //   .split(/[\s/]+/)
  //   .filter(word => word.length > 0);

  const textWords = textJoined.split(/\s+/).filter(word => word.length > 0);
  const queryWords = query.trim().split(/\s+/).filter(word => word.length > 0);
  
  // Normalize query words
  const normalizedQueryWords = queryWords.map(word => 
    removeSpecialChars(word, options.customSpecialChars)
  );
  
  const matches: Array<[number, number, string]> = [];
  
  console.log('textWords', textWords);
  console.log('normalizedQueryWords', normalizedQueryWords);
  
  // Search for word sequences
  for (let i = 0; i <= textWords.length - normalizedQueryWords.length; i++) {
    let matchFound = true;
    let matchStart = -1;
    let matchEnd = -1;
    
    // Check if all query words match starting from position i
    for (let j = 0; j < normalizedQueryWords.length; j++) {
      const textWord = textWords[i + j];
      const normalizedTextWord = removeSpecialChars(textWord, options.customSpecialChars);
      const queryWord = normalizedQueryWords[j];
      
      const textWordToCompare = options.ignoreCase ? normalizedTextWord.toLowerCase() : normalizedTextWord;
      const queryWordToCompare = options.ignoreCase ? queryWord.toLowerCase() : queryWord;
      
      const textClean = textWordToCompare.replace(/[()]/g, '');
      const queryClean = queryWordToCompare.replace(/[()]/g, '');
      
      if (textClean !== queryClean) {
        matchFound = false;
        break;
      }
      
      // Track start and end positions
      if (j === 0) {
        // Find start position of first word
        let pos = 0;
        for (let k = 0; k < i; k++) {
          pos += textWords[k].length + 1;
        }
        matchStart = pos;
      }
      
      if (j === normalizedQueryWords.length - 1) {
        // Find end position of last word
        let pos = matchStart;
        for (let k = 0; k < normalizedQueryWords.length; k++) {
          const originalWord = textWords[i + k];
          const normalizedWord = removeSpecialChars(originalWord, options.customSpecialChars);
          
          // Calculate position based on the normalized word length
          // but account for any trailing special characters that were removed
          const wordLength = normalizedWord.length;
          pos += wordLength + (k < normalizedQueryWords.length - 1 ? 1 : 0);
        }
        matchEnd = pos;
      }
    }
    
    if (matchFound) {
      const matchLength = matchEnd - matchStart;
      const matchText = textWords.slice(i, i + normalizedQueryWords.length).join(' ');
      matches.push([matchStart, matchLength, matchText]);
    }
  }

  return matches;
}

function convertMatches(
  matches: Array<[number, number, string]>,
  textContent: TextContent
): Match[] {
  function endOfLineOffset(item: TextItem): number {
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

  const convertedMatches: Match[] = [];

  for (let m = 0; m < matches.length; m++) {
    let mindex = matches[m][0];

    while (index !== end && mindex >= tindex + textItems[index].str.length) {
      const item = textItems[index];
      tindex += item.str.length + endOfLineOffset(item);
      index++;
    }

    const divStart = {
      idx: index,
      offset: mindex - tindex,
    };

    mindex += matches[m][1];

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
      str: matches[m][2],
      index: matches[m][0],
      key: "",
      keyword: "",
      isMultiDivByLineBreak,
      isMultiDivSameLine,
    });
  }

  return convertedMatches;
}

// Highlight rendering functions
// ----------------------------
interface HighlightEventHandlers {
  onClick?: (
    event: MouseEvent,
    text: string,
    key: string | number,
    keyword: string
  ) => void;
  onMouseEnter?: (
    event: MouseEvent,
    text: string,
    key: string | number,
    keyword: string
  ) => void;
  onMouseLeave?: () => void;
}

interface HighlightRenderOptions {
  customHighlightClass?: string;
  activeHighlightTextColor?: string;
  customActiveHighlightClass?: string;
  activeHighlightText?: string;
  eventHandlers?: HighlightEventHandlers;
}

function createHighlightElement(
  id: string,
  styleProps: Partial<CSSStyleDeclaration>,
  content: string,
  match: Match,
  options: HighlightRenderOptions
): HTMLElement {
  const highlight = document.createElement("div");
  highlight.id = id;
  highlight.className = `pdf-highlight ${
    options.customHighlightClass || "highlight"
  }`;

  Object.assign(highlight.style, styleProps);

  highlight.dataset.text = content;
  highlight.dataset.key = String(match.key);
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
        match.keyword as string
      );
    });
  }

  highlight.addEventListener("mouseenter", (event) => {
    event.stopPropagation();
    eventHandlers?.onMouseEnter?.(
      event,
      content,
      match.key as string | number,
      match.keyword as string
    );
  });

  highlight.addEventListener("mouseleave", (event) => {
    event.stopPropagation();
    eventHandlers?.onMouseLeave?.();
  });

  return highlight;
}

function addTextOverlay(
  highlight: HTMLElement,
  content: string,
  referenceDiv: HTMLElement,
  textColor?: string
): void {
  let textContainer = highlight.querySelector(
    ".highlight-text"
  ) as HTMLDivElement | null;

  if (!textContainer) {
    textContainer = document.createElement("div");
    textContainer.className = "highlight-text";
    textContainer.appendChild(document.createTextNode(content));

    const computedStyle = domHelpers.getComputedStylesFor(referenceDiv);
    const fontSize = parseFloat(computedStyle.fontSize);

    // Copy all relevant text properties from the original element
    const textStyles: Record<string, string> = {
      position: "absolute",
      top: "0",
      left: "",
      color: textColor || computedStyle.color,
      fontSize: `${fontSize - 1}px`,
      fontFamily: computedStyle.fontFamily,
      fontWeight: computedStyle.fontWeight,
      fontStyle: computedStyle.fontStyle,
      letterSpacing: computedStyle.letterSpacing,
      lineHeight: computedStyle.lineHeight,
      textAlign: computedStyle.textAlign,
      textTransform: computedStyle.textTransform,
      fontVariant: computedStyle.fontVariant,
      fontStretch: computedStyle.fontStretch,
      wordSpacing: computedStyle.wordSpacing,
      textDecoration: computedStyle.textDecoration,
      textShadow: computedStyle.textShadow,
      whiteSpace: computedStyle.whiteSpace,
      wordBreak: computedStyle.wordBreak,
      overflowWrap: computedStyle.overflowWrap,
      direction: computedStyle.direction,
      writingMode: computedStyle.writingMode,
      textOrientation: computedStyle.textOrientation,
      textRendering: computedStyle.textRendering,
    };

    Object.assign(textContainer.style, textStyles);

    highlight.appendChild(textContainer);
  } else {
    textContainer.style.display = "block";
  }
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
  const renderOptions: HighlightRenderOptions = {
    customHighlightClass,
    activeHighlightTextColor,
    customActiveHighlightClass,
    activeHighlightText,
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
    endOffset = -1
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
      `[id^="${highlightId}"]`
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
        endOffset >= 0 ? endOffset : textNode.textContent?.length || 0
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
        const x = rect.left - containerRect.left;
        const y = rect.top - containerRect.top;

        // Calculate the center of the text
        const textCenter = x + rect.width / 2;
        // Calculate the new left position to center the highlight
        const highlightLeft = textCenter - (rect.width + 14) / 2;

        const isActive =
          match.keyword &&
          match.keyword.toLowerCase() === activeHighlightText?.toLowerCase() &&
          customActiveHighlightClass;

        const styleProps = {
          position: "absolute",
          top: `${y}px`,
          left: `${highlightLeft}px`,
          width: `${rect.width + 14}px`,
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
          renderOptions
        );

        highlightElement.className = `pdf-highlight ${
          isActive ? customActiveHighlightClass : customHighlightClass
        }`;

        container.appendChild(highlightElement);
      }

      // Clear the selection
      selection.removeAllRanges();
    } else {
      // Update existing highlights
      const isActive =
        match.keyword &&
        match.keyword.toLowerCase() === activeHighlightText?.toLowerCase() &&
        customActiveHighlightClass;

      existingHighlights.forEach((h) => {
        h.className = `pdf-highlight ${
          isActive ? customActiveHighlightClass : customHighlightClass
        }`;
      });
    }
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
        startItem.str.substring(0, match.start.offset)
      );

      const endMeasure = domHelpers.getMeasurements(
        endDiv,
        endItem.str.substring(0, match.end.offset)
      );

      // Calculate the total width for multi-div highlights
      const totalWidth =
        endDiv.offsetLeft +
        endMeasure.width -
        (startDiv.offsetLeft + startMeasure.width);

      const styleProps = {
        position: "absolute",
        top: `${startDiv.offsetTop}px`,
        left: `${startDiv.offsetLeft -7 + startMeasure.width}px`,
        width: `${totalWidth + 14}px`,
        height: `${endDiv.offsetHeight}px`,
        pointerEvents: "all",
        zIndex: "1",
        whiteSpace: "nowrap",
      };

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

      const isActive =
        match.keyword &&
        match.keyword.toLowerCase() === activeHighlightText?.toLowerCase() &&
        customActiveHighlightClass;

      highlight = createHighlightElement(
        highlightId,
        styleProps,
        highlightText,
        match,
        renderOptions
      );

      highlight.className = `pdf-highlight ${
        isActive ? customActiveHighlightClass : customHighlightClass
      }`;

      container.appendChild(highlight);
    }

    const isActive =
      match.keyword &&
      match.keyword.toLowerCase() === activeHighlightText?.toLowerCase() &&
      customActiveHighlightClass;

    highlight.className = `pdf-highlight ${
      isActive ? customActiveHighlightClass : customHighlightClass
    }`;

    if (isActive) {
      if (activeHighlightTextColor) {
        highlight.style.color = activeHighlightTextColor;
      }

      const slicedContent = textContent.items
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

      addTextOverlay(
        highlight,
        slicedContent,
        textDivs[match.start.idx],
        activeHighlightTextColor
      );
    } else {
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

// Main API functions
// -----------------
function findMatches(
  queries: string[] | Array<{ keyword: string; key: string | number }>,
  textContent: TextContent,
  options: HighlightOptions
): Match[] {
  // Sort queries by length (longest first)
  const normalizedQueries =
    Array.isArray(queries) && typeof queries[0] === "string"
      ? (queries as string[]).map((keyword) => ({ keyword, key: keyword }))
      : (queries as Array<{ keyword: string; key: string | number }>);

  // Sort by keyword length (longest first) to prioritize longer matches
  normalizedQueries.sort((a, b) => b.keyword.length - a.keyword.length);

  const convertedMatches: Match[] = [];
  // Keep track of ranges that are already highlighted
  const highlightedRanges: Array<{ start: number; end: number }> = [];

  function isOverlapping(start: number, end: number): boolean {
    // Check if the new range (start,end) overlaps with any existing range
    // Overlap cases:
    // 1. start is inside an existing range
    // 2. end is inside an existing range
    // 3. new range completely contains an existing range
    // 4. new range is completely contained within an existing range
    return highlightedRanges.some(
      (range) =>
        // Case 1 & 4: start is inside the existing range
        (start >= range.start && start < range.end) ||
        // Case 2 & 4: end is inside the existing range
        (end > range.start && end <= range.end) ||
        // Case 3: new range completely contains the existing range
        (start <= range.start && end >= range.end)
    );
  }

  for (const query of normalizedQueries) {
    const keyword = query.keyword;
    const key = query.key;

    const matches = searchQuery(textContent, keyword, options);
    const currentMatches = convertMatches(matches, textContent);

    // Filter out matches that would overlap with existing highlights
    for (const match of currentMatches) {
      const start = match.index;
      const end = match.index + match.str.length;

      // Check if this range overlaps with any existing highlight
      if (!isOverlapping(start, end)) {
        // No overlap - add to results and mark range as highlighted
        highlightedRanges.push({ start, end });
        convertedMatches.push({
          ...match,
          key: key,
          keyword: keyword,
        });
      }
    }
  }

  return convertedMatches;
}

export { findMatches, highlightMatches, resetDivs, domHelpers };
