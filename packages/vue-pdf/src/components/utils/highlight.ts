import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { TextContent } from "pdfjs-dist/types/src/display/text_layer";
import type { HighlightOptions, Match } from "../types";

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
  function appendHighlightDiv(
    match: Match,
    idx: number,
    startOffset = -1,
    endOffset = -1
  ) {
    const textItem = textContent.items[idx] as TextItem;
    const nodes = [];

    let content = "";
    let prevContent = "";
    let nextContent = "";

    let div = textDivs[idx];

    if (!div) return; // don't process if div is undefinied

    if (div.nodeType === Node.TEXT_NODE) {
      const span = document.createElement("span");
      div.before(span);
      span.append(div);
      textDivs[idx] = span;
      div = span;
    }

    if (startOffset >= 0 && endOffset >= 0)
      content = textItem.str.substring(startOffset, endOffset);
    else if (startOffset < 0 && endOffset < 0) content = textItem.str;
    else if (startOffset >= 0) content = textItem.str.substring(startOffset);
    else if (endOffset >= 0) content = textItem.str.substring(0, endOffset);

    const node = document.createTextNode(content);
    const span = document.createElement("span");

    let highlightClass = customHighlightClass;

    if (
      match.keyword &&
      match.keyword.toLowerCase() === activeHighlightText?.toLowerCase() &&
      customActiveHighlightClass
    ) {
      highlightClass = customActiveHighlightClass;

      if (activeHighlightTextColor) span.style.color = activeHighlightTextColor;
    }
    span.className = `${highlightClass} appended`;

    if (onHighlightClick && match.key && match.keyword) {
      span.style.cursor = "pointer";

      span.addEventListener("click", (event) => {
        event.stopPropagation();
        onHighlightClick(
          event,
          content,
          match.key as string | number,
          match.keyword as string
        );
      });
    }

    span.addEventListener("mouseover", (event) => {
      onHighlightMouseEnter?.(
        event,
        content,
        match.key as string | number,
        match.keyword as string
      );
    });

    span.addEventListener("mouseleave", () => {
      onHighlightMouseLeave?.();
    });

    span.append(node);

    nodes.push(span);

    if (startOffset > 0) {
      if (
        div.childNodes.length === 1 &&
        div.childNodes[0].nodeType === Node.TEXT_NODE
      ) {
        prevContent = textItem.str.substring(0, startOffset);
        const node = document.createTextNode(prevContent);
        nodes.unshift(node);
      } else {
        let alength = 0;
        const prevNodes = [];
        for (const childNode of div.childNodes) {
          const textValue =
            childNode.nodeType === Node.TEXT_NODE
              ? childNode.nodeValue!
              : childNode.firstChild!.nodeValue!;
          alength += textValue.length;

          if (alength <= startOffset) prevNodes.push(childNode);
          else if (
            startOffset >= alength - textValue.length &&
            endOffset <= alength
          )
            prevNodes.push(
              document.createTextNode(
                textValue.substring(
                  0,
                  startOffset - (alength - textValue.length)
                )
              )
            );
        }
        nodes.unshift(...prevNodes);
      }
    }
    if (endOffset > 0) {
      nextContent = textItem.str.substring(endOffset);
      const node = document.createTextNode(nextContent);
      nodes.push(node);
    }

    div.replaceChildren(...nodes);
  }

  function handleMultiDivHighlight(match: Match) {
    const startDiv = textDivs[match.start.idx];
    const endDiv = textDivs[match.end.idx];
    const startItem = textContent.items[match.start.idx] as TextItem;
    const endItem = textContent.items[match.end.idx] as TextItem;

    if (!startDiv || !endDiv || !startItem || !endItem) return;

    // Find the common parent container of PDF divs
    const container = startDiv.parentElement;
    if (!container) return;

    // Create a unique identifier for this highlight based on its position
    const highlightId = `highlight-${match.start.idx}-${match.start.offset}-${match.end.idx}-${match.end.offset}`;

    // Check if highlight already exists
    let highlight = container.querySelector(`#${highlightId}`) as HTMLElement;

    if (!highlight) {
      // Only create new highlight if it doesn't exist
      highlight = document.createElement("span");
      highlight.id = highlightId;

      // Create temporary divs for measure the text and offsets...
      const measureStartDiv = document.createElement("span");
      measureStartDiv.textContent = startItem.str.substring(
        0,
        match.start.offset
      );
      measureStartDiv.style.visibility = "hidden";
      startDiv.appendChild(measureStartDiv);

      const measureEndDiv = document.createElement("span");
      measureEndDiv.textContent = endItem.str.substring(0, match.end.offset);
      measureEndDiv.style.visibility = "hidden";
      endDiv.appendChild(measureEndDiv);

      const startMeasureRect = measureStartDiv.getBoundingClientRect();
      const endMeasureRect = measureEndDiv.getBoundingClientRect();

      startDiv.removeChild(measureStartDiv);
      endDiv.removeChild(measureEndDiv);

      // Set position and dimensions
      Object.assign(highlight.style, {
        position: "absolute",
        top: `${startDiv.offsetTop}px`,
        left: `${startDiv.offsetLeft + startMeasureRect.width}px`,
        width: `${
          endDiv.offsetLeft +
          endMeasureRect.width -
          (startDiv.offsetLeft + startMeasureRect.width)
        }px`,
        height: `${
          endDiv.offsetTop + endDiv.offsetHeight - startDiv.offsetTop
        }px`,
        pointerEvents: "all",
        zIndex: "1",
        whiteSpace: "nowrap",
      });

      // Add event listeners
      if (onHighlightClick && match.key && match.keyword) {
        highlight.style.cursor = "pointer";
        highlight.addEventListener("click", (event) => {
          event.stopPropagation();
          onHighlightClick(
            event,
            textContent.items
              .slice(match.start.idx, match.end.idx + 1)
              .map((item) => ("str" in item ? item.str : ""))
              .join(" "),
            match.key as string | number,
            match.keyword as string
          );
        });
      }

      highlight.addEventListener("mouseover", (event) => {
        onHighlightMouseEnter?.(
          event,
          textContent.items
            .slice(match.start.idx, match.end.idx + 1)
            .map((item) => ("str" in item ? item.str : ""))
            .join(" "),
          match.key as string | number,
          match.keyword as string
        );
      });

      highlight.addEventListener("mouseleave", () => {
        onHighlightMouseLeave?.();
      });

      container.appendChild(highlight);
    }

    // Update highlight class and text (whether it's new or existing)
    if (
      match.keyword &&
      match.keyword.toLowerCase() === activeHighlightText?.toLowerCase() &&
      customActiveHighlightClass
    ) {
      highlight.className = customActiveHighlightClass;
      if (activeHighlightTextColor) {
        highlight.style.color = activeHighlightTextColor;
      }

      // Update or create text container
      let textContainer = highlight.querySelector(
        ".highlight-text"
      ) as HTMLDivElement | null;
      if (!textContainer) {
        textContainer = document.createElement("div");
        textContainer.className = "highlight-text";

        // Accumulate the text
        let highlightText = "";
        for (let i = match.start.idx; i <= match.end.idx; i++) {
          const currentItem = textContent.items[i] as TextItem;
          if (!currentItem) continue;

          let text = currentItem.str;
          if (i === match.start.idx) {
            text = text.substring(match.start.offset);
          }
          if (i === match.end.idx) {
            text = text.substring(0, match.end.offset);
          }
          highlightText += text;
        }

        // Create text node
        const textNode = document.createTextNode(highlightText);
        textContainer.appendChild(textNode);

        // Apply styles
        const initialDiv = textDivs[match.start.idx];
        if (initialDiv) {
          const computedStyle = window.getComputedStyle(initialDiv);
          const originalSize = parseFloat(computedStyle.fontSize);
          const adjustedSize = originalSize - 1;

          Object.assign(textContainer.style, {
            position: "absolute",
            top: "0",
            left: "0",
            color: activeHighlightTextColor || "inherit",
            fontFamily: computedStyle.fontFamily,
            fontWeight: computedStyle.fontWeight,
            fontSize: `${adjustedSize}px`,
          });
        }

        highlight.appendChild(textContainer);
      } else {
        textContainer.style.display = "block"; // Show if exists but was hidden
      }
    } else {
      highlight.className = customHighlightClass;
      // Keep textContainer, just update styles
      const textContainer = highlight.querySelector(
        ".highlight-text"
      ) as HTMLDivElement | null;
      if (textContainer) {
        textContainer.style.display = "none"; // Instead of removing, just hide it
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
