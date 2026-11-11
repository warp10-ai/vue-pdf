import { beforeAll, describe, expect, test, vi } from "vitest";

import { mount, type VueWrapper } from "@vue/test-utils";
import { ref } from "vue";

import { VuePDF, usePDF } from "@warp10-ai/vue-pdf/src";
import type {
  HighlightEventPayload,
  TextLayerLoadedEventPayload,
} from "@warp10-ai/vue-pdf/src/components/types.ts";

import a14PDF from "@samples/14.pdf";
import a45PDF from "@samples/45.pdf";
import dipietroPDF from "@samples/dipietro.pdf";
import xfaPDF from "@samples/xfa.pdf";

const latestMatches = (wrapper: VueWrapper) => {
  const emitted = wrapper.emitted("highlight") ?? [];
  return (
    (emitted.at(-1)?.[0] as HighlightEventPayload | undefined)?.matches ?? []
  );
};

describe("Text Layer", () => {
  const { pdf } = usePDF(
    "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf",
  );

  beforeAll(async () => {
    await vi.waitUntil(() => pdf.value, { timeout: 5000 });
  });

  test("Visibility", async () => {
    const wrapper = mount(VuePDF, {
      props: {
        pdf: pdf.value,
      },
    });
    expect(wrapper).toBeTruthy();

    console.log(wrapper);

    await vi.waitUntil(() => wrapper.vm.internalProps.viewport);
    expect(() => wrapper.get("div.textLayer")).toThrowError();

    await wrapper.setProps({ textLayer: true });
    expect(wrapper.get("div.textLayer")).toBeTruthy();

    await vi.waitUntil(() => wrapper.emitted("textLoaded"));
    expect(wrapper.emitted("textLoaded")).toHaveLength(1);
  });

  test("Highlight", async () => {
    const matcherFor = (pattern: RegExp) => (text: string) =>
      [...text.matchAll(pattern)].map((match) => ({
        start: match.index!,
        end: match.index! + match[0].length,
        keyword: match[0],
        key: match[0].toLowerCase(),
      }));

    const wrapper = mount(VuePDF, {
      props: {
        pdf: pdf.value,
        textLayer: true,
        highlightMatcher: matcherFor(/dynamic/gi),
      },
      attachTo: document.body,
    });

    expect(wrapper).toBeTruthy();
    await vi.waitUntil(() => wrapper.emitted("highlight"));

    const first = wrapper.emitted("highlight")![0][0] as HighlightEventPayload;
    expect(first.textDivs).toHaveLength(182);
    expect(first.matches).toHaveLength(11);
    expect(
      first.matches.every((match) => match.str.toLowerCase() === "dynamic"),
    ).toBe(true);

    await wrapper.setProps({ highlightMatcher: matcherFor(/\bdynamic\b/gi) });
    await vi.waitUntil(() => latestMatches(wrapper).length === 8);

    await wrapper.setProps({ highlightMatcher: () => [] });
    await vi.waitUntil(() => latestMatches(wrapper).length === 0);
    expect(wrapper.findAll(".pdf-highlight")).toHaveLength(0);
    wrapper.unmount();
  });

  test("Highlight edges at line breaks", async () => {
    let returned = 0;
    // Each range starts or ends on whitespace, including the spaces added at line breaks
    const matcher = (text: string) => {
      const ranges = [...text.matchAll(/\s\w+|\w+\s/g)].map((match) => ({
        start: match.index!,
        end: match.index! + match[0].length,
        keyword: match[0],
        key: match.index!,
      }));
      returned = ranges.length;
      return ranges;
    };

    const wrapper = mount(VuePDF, {
      props: { pdf: pdf.value, textLayer: true, highlightMatcher: matcher },
      attachTo: document.body,
    });
    await vi.waitUntil(() => wrapper.emitted("highlight"));

    const { matches } = wrapper.emitted(
      "highlight",
    )![0][0] as HighlightEventPayload;
    expect(matches).toHaveLength(returned);
    expect(matches.every((match) => match.str.trim())).toBe(true);
    wrapper.unmount();
  });

  test("Highlight overlapping results", async () => {
    // The same range under two keys, a shorter range inside it, and a separate range after it
    const matcher = (text: string) => {
      const start = text.search(/\w{12}/);
      const next = start + 12 + text.slice(start + 12).search(/\w{5}/);
      return [
        { start, end: start + 1, keyword: "short", key: "c" },
        { start, end: start + 12, keyword: "long", key: "a" },
        { start, end: start + 12, keyword: "long", key: "b" },
        { start: next, end: next + 5, keyword: "next", key: "d" },
      ];
    };

    const wrapper = mount(VuePDF, {
      props: { pdf: pdf.value, textLayer: true, highlightMatcher: matcher },
      // Highlights are placed from measured text, which needs the page in the document
      attachTo: document.body,
    });
    await vi.waitUntil(() => wrapper.emitted("highlight"));

    const keys = wrapper
      .findAll(".pdf-highlight")
      .map((highlight) => highlight.attributes("data-highlight-id"));
    expect(keys.sort()).toEqual(["a", "d"]);
    wrapper.unmount();
  });

  test("Highlight when a matcher's reactive input changes", async () => {
    const query = ref("dynamic");
    const matcher = (text: string) =>
      [...text.matchAll(new RegExp(query.value, "gi"))].map((match) => ({
        start: match.index!,
        end: match.index! + match[0].length,
        keyword: query.value,
        key: query.value,
      }));

    const wrapper = mount(VuePDF, {
      props: { pdf: pdf.value, textLayer: true, highlightMatcher: matcher },
      attachTo: document.body,
    });
    await vi.waitUntil(() => wrapper.emitted("highlight"));

    query.value = "trace";
    await vi.waitUntil(() => latestMatches(wrapper)[0]?.keyword === "trace");
    const matches = latestMatches(wrapper);
    expect(matches.every((match) => match.str.toLowerCase() === "trace")).toBe(
      true,
    );
    wrapper.unmount();
  });

  test("Highlight once a hidden viewer is shown", async () => {
    const host = document.createElement("div");
    host.style.display = "none";
    document.body.appendChild(host);
    const matcher = (text: string) =>
      [...text.matchAll(/dynamic/gi)].map((match) => ({
        start: match.index!,
        end: match.index! + match[0].length,
        keyword: "dynamic",
        key: "dynamic",
      }));

    const wrapper = mount(VuePDF, {
      props: { pdf: pdf.value, textLayer: true, highlightMatcher: matcher },
      attachTo: host,
    });
    await vi.waitUntil(() => wrapper.emitted("textLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(wrapper.emitted("highlight")).toBeUndefined();
    expect(wrapper.findAll(".pdf-highlight")).toHaveLength(0);

    host.style.display = "block";
    await vi.waitUntil(() => wrapper.emitted("highlight"));
    const highlights = wrapper.findAll(".pdf-highlight");
    expect(highlights.length).toBeGreaterThan(0);
    for (const highlight of highlights) {
      expect(highlight.element.getBoundingClientRect().width).toBeGreaterThan(
        0,
      );
    }
    wrapper.unmount();
    host.remove();
  });
});

describe("Marked content", () => {
  const { pdf } = usePDF(dipietroPDF);

  beforeAll(async () => {
    await vi.waitUntil(() => pdf.value, { timeout: 5000 });
  });

  test("Leave no undefined ids on marked-content containers", async () => {
    const wrapper = mount(VuePDF, {
      props: { pdf: pdf.value, page: 18, textLayer: true },
      attachTo: document.body,
    });
    await vi.waitUntil(() => wrapper.emitted("textLoaded"));

    expect(wrapper.findAll(".markedContent").length).toBeGreaterThan(0);
    expect(document.getElementById("undefined")).toBeNull();
    wrapper.unmount();
  });

  test("Highlight a match spanning marked-content containers", async () => {
    // On page 1, "MD" and ", PhD" sit in different marked-content containers,
    // and "Alessandra" comes earlier in the same container as "MD"
    const matcher = (text: string) => {
      const name = text.indexOf("Alessandra");
      const start = text.indexOf("MD, PhD");
      return [
        { start: name, end: name + 10, keyword: "Alessandra", key: "name" },
        { start, end: start + 7, keyword: "MD, PhD", key: "degree" },
      ];
    };

    const wrapper = mount(VuePDF, {
      props: { pdf: pdf.value, textLayer: true, highlightMatcher: matcher },
      attachTo: document.body,
    });
    await vi.waitUntil(() => wrapper.emitted("highlight"));
    await vi.waitUntil(() => wrapper.emitted("textLoaded"));

    const loaded = wrapper.emitted(
      "textLoaded",
    )![0][0] as TextLayerLoadedEventPayload;
    expect(loaded.textContent?.items).toHaveLength(loaded.textDivs.length);

    const layer = wrapper.get("div.textLayer").element;
    const highlight = wrapper.get('[data-highlight-id="degree"]').element;
    expect(highlight.parentElement).toBe(layer);

    const spans = [...layer.querySelectorAll("span:not(.markedContent)")];
    const first = spans.find((span) => span.textContent?.endsWith("MD"))!;
    const last = spans.find((span) => span.textContent === ", PhD")!;
    const measure = (span: Element, start: number, end: number) => {
      const range = document.createRange();
      range.setStart(span.firstChild!, start);
      range.setEnd(span.firstChild!, end);
      return range.getBoundingClientRect();
    };
    const length = first.textContent!.length;
    const textLeft = measure(first, length - 2, length).left;
    const textRight = measure(last, 0, last.textContent!.length).right;
    const drawn = highlight.getBoundingClientRect();
    expect(Math.abs(drawn.left - textLeft)).toBeLessThan(3);
    expect(Math.abs(drawn.right - textRight)).toBeLessThan(3);
    wrapper.unmount();
  });
});

describe("Annotation Layer", () => {
  const { pdf } = usePDF(a14PDF);
  const { pdf: pdf45 } = usePDF(a45PDF);

  beforeAll(async () => {
    await vi.waitUntil(() => pdf.value, { timeout: 10000 });
    await vi.waitUntil(() => pdf45.value, { timeout: 10000 });
  });

  test("Visibility", async () => {
    const wrapper = mount(VuePDF, {
      props: {
        pdf: pdf.value,
      },
    });
    expect(wrapper).toBeTruthy();

    await vi.waitUntil(() => wrapper.vm.internalProps.viewport);
    expect(() => wrapper.get("div.annotationLayer")).toThrowError();

    await wrapper.setProps({ annotationLayer: true });
    expect(wrapper.get("div.annotationLayer")).toBeTruthy();

    await vi.waitUntil(() => wrapper.emitted("annotationLoaded"));
    expect(wrapper.emitted("annotationLoaded")).toHaveLength(1);
  });

  // test("Forms Fields", async () => {
  //   const wrapper = mount(VuePDF, {
  //     props: {
  //       pdf: pdf.value,
  //       annotationLayer: true,
  //     },
  //   });
  //   expect(wrapper).toBeTruthy();

  //   await vi.waitUntil(
  //     () => wrapper.get("div.annotationLayer").element.childNodes.length > 0
  //   );

  //   const checkbox = wrapper.get("input[type='checkbox']")
  //     .element as HTMLInputElement;
  //   checkbox.click();
  //   await vi.waitUntil(() => wrapper.emitted("annotation"));

  //   expect(wrapper.emitted("annotation")).toHaveLength(1);
  //   expect(wrapper.emitted("annotation")![0][0]).toEqual({
  //     type: "form-checkbox",
  //     data: {
  //       fieldName: "newsletter",
  //       checked: true,
  //     },
  //   });

  //   const radiobutton = wrapper.get('input[data-element-id="14R"]')
  //     .element as HTMLInputElement;
  //   radiobutton.click();
  //   await vi.waitUntil(() => wrapper.emitted("annotation")?.length === 2);
  //   expect(wrapper.emitted("annotation")![1][0]).toEqual({
  //     type: "form-radio",
  //     data: {
  //       fieldName: "drink",
  //       value: "Wine",
  //       defaultValue: "Beer",
  //       options: ["Water", "Beer", "Wine", "Milk"],
  //     },
  //   });

  //   const selectOption = wrapper.get('select[data-element-id="9R"]')
  //     .element as HTMLSelectElement;
  //   selectOption.value = "F";
  //   selectOption.dispatchEvent(new Event("input", { bubbles: true }));
  //   await vi.waitUntil(() => wrapper.emitted("annotation")?.length === 3);
  //   expect(wrapper.emitted("annotation")![2][0]).toEqual({
  //     type: "form-select",
  //     data: {
  //       fieldName: "gender",
  //       value: [
  //         {
  //           value: "F",
  //           label: "Female",
  //         },
  //       ],
  //       options: [
  //         {
  //           value: "",
  //           label: "-",
  //         },
  //         {
  //           value: "M",
  //           label: "Male",
  //         },
  //         {
  //           value: "F",
  //           label: "Female",
  //         },
  //       ],
  //     },
  //   });

  //   const textInput = wrapper.get('input[name="firstname"]')
  //     .element as HTMLInputElement;
  //   textInput.value = "Testing";
  //   textInput.dispatchEvent(new Event("input", { bubbles: true }));
  //   await vi.waitUntil(() => wrapper.emitted("annotation")?.length === 4);
  //   expect(wrapper.emitted("annotation")![3][0]).toEqual({
  //     type: "form-text",
  //     data: {
  //       fieldName: "firstname",
  //       value: "Testing",
  //     },
  //   });
  // });

  test("Links", async () => {
    const wrapper = mount(VuePDF, {
      props: {
        pdf: pdf45.value,
        annotationLayer: true,
      },
    });
    expect(wrapper).toBeTruthy();

    await vi.waitUntil(
      () => wrapper.get("div.annotationLayer").element.childNodes.length > 0,
    );

    const indexLink = wrapper.get('a[data-element-id="13R"]')
      .element as HTMLAnchorElement;
    indexLink.click();
    await vi.waitUntil(() => wrapper.emitted("annotation"));
    expect(wrapper.emitted("annotation")![0][0]).toEqual({
      type: "internal-link",
      data: {
        referencedPage: 2,
        offset: {
          left: 0,
          bottom: 841.89,
        },
      },
    });
  });
});

describe("XFA Layer", () => {
  const { pdf } = usePDF({
    url: xfaPDF,
    enableXfa: true,
  });

  beforeAll(async () => {
    await vi.waitUntil(() => pdf.value, { timeout: 5000 });
  });

  test("Visibility", async () => {
    const wrapper = mount(VuePDF, {
      props: {
        pdf: pdf.value,
      },
    });
    expect(wrapper).toBeTruthy();

    await vi.waitUntil(() => wrapper.vm.internalProps.viewport);
    expect(wrapper.get("div.xfaLayer")).toBeTruthy();

    await vi.waitUntil(() => wrapper.emitted("xfaLoaded"));
    expect(wrapper.emitted("xfaLoaded")).toHaveLength(1);
  });
});
