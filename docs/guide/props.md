# Props

## pdf

Type: `PDFDocumentLoadingTask` <br/>
Required: `true`

The `PDFDocumentLoadingTask` obtained from usePDF.

```vue
<VuePDF :pdf="pdf" />
```

## page

Type: `int` <br/>
Required: `false` <br />
Default: `1`

Page to render, this prop must be a page number starting at 1.

```vue
<VuePDF :pdf="pdf" :page="1" />
```

## intent

Type: `string` <br />
Required: `false` <br />
Default: `display`

Rendering intent, can be `display`, `print`, or `any`.

```vue
<VuePDF :pdf="pdf" intent="print" />
```

## scale

Type: `int` <br />
Required: `false` <br />
Default: `1`

Page's scale.

```vue
<VuePDF :pdf="pdf" :scale="0.5" />
```

## fit-parent

Type: `boolean` <br /> 
Required: `false` <br />
Default: `false`

Fit the page's width with the parent width. This prop replace [scale](#scale) in size calculation and has more precedence than [width](#width).

```vue
<VuePDF :pdf="pdf" fit-parent />
```

## width

Type: `number` <br /> 
Required: `false` <br />
Default: `null`

Scale the page using a `width` in px. This prop replace [scale](#scale) in size calculation and has more precedence than [height](#height).

```vue
<VuePDF :pdf="pdf" :width="500" />
```

## height

Type: `number` <br /> 
Required: `false` <br />
Default: `null`

Scale the page using a `height` in px. This prop replace [scale](#scale) in size calculation.

```vue
<VuePDF :pdf="pdf" :height="500" />
```

## rotation

Type: `int` <br />
Required: `false` <br />
Default: `Document's Default`

Rotate the page in 90° multiples eg. (`90`, `180`, `270`)

```vue
<VuePDF :pdf="pdf" :rotation="90" />
```

## text-layer

Type: `boolean` <br />
Required: `false` <br />
Default: `false`

Enables text selection.

```vue
<VuePDF :pdf="pdf" text-layer />
```

## highlight-matcher  <badge type="tip" text="v2.0" vertical="middle" />

Type: `(text: string) => { start: number, end: number, keyword: string, key: string | number }[]` <br />
Required: `false` <br />
Default: `null`

Decides what to highlight on each page. It receives the page's text, with a space at each line break unless the line ends in a hyphen, and returns the ranges to highlight. Each highlight is a `<mark>` element with the range's `key` in `data-highlight-id`.

If ranges overlap, the one that starts first is kept, and of ranges that start at the same place, the longest. The others are dropped.

```vue
<script setup>
const highlightMatcher = (text) =>
  [...text.matchAll(/javascript/gi)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    keyword: 'javascript',
    key: 'javascript',
  }))
</script>

<VuePDF :pdf="pdf" text-layer :highlight-matcher="highlightMatcher" />
```

Highlights let the pointer through so text selection can start on them, which means `:hover` never applies to them. The highlight under the pointer gets `data-hovered` instead. Give highlights a class with `custom-highlight-class` and style it:

```vue
<VuePDF
  :pdf="pdf"
  text-layer
  :highlight-matcher="highlightMatcher"
  custom-highlight-class="my-highlight"
/>
```

Highlights are `<mark>` elements, so a custom class needs its own background; otherwise the browser's opaque yellow covers the text.

```css
/* Translucent, because highlights sit on top of the text */
.my-highlight {
  background: rgb(255 235 59 / 0.4);
}

.my-highlight[data-hovered] {
  background: rgb(255 165 0 / 0.4);
}

/* The text under a highlight sets the cursor */
.textLayer:has(mark[data-hovered]) span {
  cursor: pointer;
}
```

## annotation-layer

Type: `boolean` <br />
Required: `false` <br />
Default: `false`

Enables document annotations like links, popups, widgets, etc.

```vue
<VuePDF :pdf="pdf" annotation-layer />
```

## watermark-text 

Type: `string` <br />
Required: `false` <br />
Default: `null`

Prints a watermark pattern over the canvas.

```vue
<VuePDF :pdf="pdf" watermark-text="Sample" />
```

## watermark-options

Type: `object` <br />
Required: `false` <br />
Default: 
```
{
  columns: 4,
  rows: 4,
  rotation: 45,
  fontSize: 18,
  color: 'rgba(211, 210, 211, 0.4)',
}
```

Customize how watermark is printed over the canvas.

```vue
<script setup>
const watermarkOptions = ref({
  columns: 1,
  rows: 1,
  color: '#23FFFF',
  rotation: 45,
  fontSize: 20,
})
</script>

<VuePDF :pdf="pdf" watermark-text="Sample" :watermark-options="watermarkOptions" />
```

## image-resources-path 

Type: `string` <br />
Required: `false` <br />
Default: `null` <br />

Path to image resources needed to render some graphics when required.

```vue
<VuePDF :pdf="pdf" image-resources-path="https://unpkg.com/pdfjs-dist@latest/web/images/" />
```

## hide-forms 

Type: `boolean` <br />
Required: `false` <br />
Default: `false` <br />

Hide AcroForms from annotation-layer.

```vue
<VuePDF :pdf="pdf" annotation-layer hide-forms />
```

## annotations-filter

Type: `array` <br />
Required: `false` <br />
Default: `null`

Allows to choose which annotations display on page, the following options are available:

*  `Link`
*  `Text`
*  `Stamp`
*  `Popup`
*  `FreeText`
*  `Line`
*  `Square`
*  `Circle`
*  `PolyLine`
*  `Caret`
*  `Ink`
*  `Polygon`
*  `Highlight`
*  `Underline`
*  `Squiggly`
*  `StrikeOut`
*  `FileAttachment`
*  `Widget`
    *  `Widget.Tx`
    *  `Widget.Btn`
    *  `Widget.Ch`
    *  `Widget.Sig`

> NOTE: `Widget` shows all `Widget` subtypes like `Widget.Tx`, `Widget.Btn`, etc.


```vue
<script setup>
const filter = ref(['Link', 'Text', 'Widget'])
</script>

<VuePDF :pdf="pdf" annotation-layer :annotations-filter="filter" />
```

## annotations-map 

Type: `object` <br />
Required: `false` <br />
Default: `null` <br />

Allows to map values to annotation's storage, useful for edit annotation's data before rendering.

```vue
<script setup>
const annotationMap = ref({ '7R': { value: 'Modified value' } })
</script>

<VuePDF :pdf="pdf" annotation-layer :annotations-map="annotationMap" />
```
