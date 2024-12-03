import { html, HTMLTemplateResult, svg, SVGTemplateResult } from "lit-html";

function icon(title: string, content: SVGTemplateResult): HTMLTemplateResult {
  return html`<svg version="1.1" width="16" height="16">
    <title>${title}</title>
    ${content}
  </svg>`;
}

export const Close = icon(
  "Close",
  svg`<g><path d="M2 4v-2h2l4 4 4 -4h2v2l-4 4 4 4v2h-2l-4 -4 -4 4h-2v-2l4 -4z"></path></g>`
);

export const Stop = icon(
  "Stop playing",
  svg`<g><path d="M3 3v10h10V3z"></path></g>`
);

export const Play = icon(
  "Start playing",
  svg`<g><path d="M3 2v12l10 -6z"></path></g>`
);

export const Settings = icon(
  "Settings",
  svg`<g><path d="M5 1A4 4 0 0 0 3.7 1.2L6.5 4 6 6 4 6.5 1.2 3.7A4 4 0 0 0 1 5 4 4 0 0 0 5 9 4 4 0 0 0 6.6 8.6L12.5 14.5A1.4 1.4 0 0 0 13.6 15 1.4 1.4 0 0 0 15 13.6 1.4 1.4 0 0 0 14.5 12.5L8.6 6.6A4 4 0 0 0 9 5 4 4 0 0 0 5 1z"></path></g>`
);

export const Help = icon(
  "Help",
  svg`<g>
    <path
      d="M8 1A5 4.5 0 0 0 3 5.5L3 6L5 6L5 5.5A3 2.5 0 0 1 8 3A3 2.5 0 0 1 11 5.5A3 2.5 0 0 1 8 8L7 8L7 9L7 10L7 12L9 12L9 10A5 4.5 0 0 0 13 5.5A5 4.5 0 0 0 8 1z"
    ></path>
    <circle cy="14" cx="8" r="1"></circle>
  </g>`
);

export const ScrollLeft = icon(
  "Scroll left",
  svg`<g><path d="m11 2v2l-4 4 4 4v2H9L3 8 9 2Z"></path></g>`
);

export const ScrollRight = icon(
  "Scroll right",
  svg`<g><path d="m5 2v2l4 4 -4 4v2h2L13 8 7 2Z"></path></g>`
);

function zoomIcon(title: string, sign: SVGTemplateResult) {
  return icon(
    title,
    svg`<g>
        <path
          d="M7 1A6 6 0 0 0 1 7A6 6 0 0 0 7 13A6 6 0 0 0 13 7A6 6 0 0 0 7 1zM7 3A4 4 0 0 1 11 7A4 4 0 0 1 7 11A4 4 0 0 1 3 7A4 4 0 0 1 7 3z"
        ></path>
        <path d="M14.5 13l-1.5 1.5 -4 -4 1.5 -1.5z"></path>
        ${sign}
      </g>`
  );
}

export const ZoomIn = zoomIcon(
  "Zoom in",
  svg`<path d="M4 6v2h2v2h2v-2h2v-2h-2v-2h-2v2Z"></path>`
);

export const ZoomOut = zoomIcon(
  "Zoom out",
  svg`<path d="M4 6v2h6v-2Z"></path>`
);

export const Stereo = icon(
  "Stereo",
  svg`<g><path d="M 6 3A 5 5 0 0 0 1 8A 5 5 0 0 0 6 13A 5 5 0 0 0 8 13A 5 5 0 0 0 10 13A 5 5 0 0 0 15 8A 5 5 0 0 0 10 3A 5 5 0 0 0 8 3A 5 5 0 0 0 6 3zM 6 5A 3 3 0 0 1 9 8A 3 3 0 0 1 6 11A 3 3 0 0 1 3 8A 3 3 0 0 1 6 5zM 10 5A 3 3 0 0 1 13 8A 3 3 0 0 1 10 11A 3 3 0 0 1 10 11A 5 5 0 0 0 11 8A 5 5 0 0 0 10 5z"></g>`
);
