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
    // When textitem has a EOL flag and the string has a hyphen at the end
    // the hyphen should be removed (-1 len) so the sentence could be searched as a joined one.
    // In other cases the EOL flag introduce a whitespace (+1 len) between two different sentences
    if (item.hasEOL) {
      if (item.str.endsWith("-")) return -1;
      else return 1;
    }
    return 0;
  }

  let index = 0;
  let tindex = 0;
  const textItems = textContent.items as TextItem[];
  const end = textItems.length - 1;

  const convertedMatches = [];

  // iterate over all matches
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
    convertedMatches.push({
      start: divStart,
      end: divEnd,
      str: matches[m][2] as string,
      index: matches[m][0] as number,
      key: "",
      keyword: "",
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

    span.addEventListener("mouseenter", (event) => {
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

  for (const match of matches) {
    if (match.start.idx === match.end.idx) {
      appendHighlightDiv(
        match,
        match.start.idx,
        match.start.offset,
        match.end.offset
      );
    } else {
      for (let si = match.start.idx, ei = match.end.idx; si <= ei; si++) {
        if (si === match.start.idx) {
          appendHighlightDiv(match, si, match.start.offset);
        } else if (si === match.end.idx) {
          appendHighlightDiv(match, si, -1, match.end.offset);
        } else {
          appendHighlightDiv(match, si);
        }
      }
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
