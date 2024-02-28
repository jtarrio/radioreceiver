import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/tooltip/tooltip.js";
import { LitElement, TemplateResult, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("rr-button")
class RrButton extends LitElement {
  @property({ reflect: true }) label?: string;
  @property({ reflect: true }) icon?: string;
  @property({ reflect: true }) iconposition: "top" | "prefix" | "suffix" = "top";

  @property({ reflect: true }) variant: "default" | "primary" | "neutral" =
    "default";
  @property({ reflect: true }) size: "small" | "medium" | "large" = "medium";
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) loading = false;

  static get styles() {
    return [
      css`
        :root {
          --rr-button-icon-color: inherit;
        }

        sl-icon {
          color: var(--rr-button-icon-color);
        }

        .topIcon {
          line-height: 0;
          margin: calc(3 * var(--sl-button-font-size-large) / 4) 0
            calc(-1 * var(--sl-button-font-size-large) / 2);
        }
      `,
    ];
  }

  render() {
    let content: TemplateResult;
    if (this.icon) {
      if (!this.label) {
        content = html`<sl-icon name=${this.icon}></sl-icon>`;
      } else if (this.iconposition == "top") {
        content = html`<div class="topIcon">
            <sl-icon name=${this.icon}></sl-icon>
          </div>
          <div>${this.label}</div>`;
      } else {
        content = html`<sl-icon
            name=${this.icon}
            slot="${this.iconposition}"
          ></sl-icon
          >${this.label}`;
      }
    } else {
      content = html`${this.label || ""}`;
    }
    return html`<sl-button
      .variant=${this.variant}
      .size=${this.size}
      .disabled=${this.disabled}
      .loading=${this.loading}
      >${content}</sl-button
    >`;
  }
}
