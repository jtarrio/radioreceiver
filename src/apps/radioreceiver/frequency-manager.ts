import { css, html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  RrWindow,
  WindowPosition,
  WindowClosedEvent,
} from "../../ui/controls/window";
import * as Icons from "../../ui/icons";
import "../../ui/controls/window";

@customElement("rr-frequency-manager")
export class RrFrequencyManager extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          font-family: Arial, Helvetica, sans-serif;
        }

        @media (prefers-color-scheme: dark) {
          input,
          select {
            background: #222;
            color: #ddd;
          }
        }

        rr-window {
          bottom: calc(1em + 24px);
          right: 1em;
        }

        rr-window.inline {
          position: initial;
          display: inline-block;
        }

        @media (max-width: 778px) {
          rr-window {
            bottom: calc(1em + 48px);
          }
        }

        button:has(svg) {
          padding-inline: 0;
          width: 24px;
          height: 24px;
        }

        button > svg {
          display: block;
          width: 16px;
          height: 16px;
          margin: auto;
        }

        table {
          border-collapse: collapse;
          width: 100%;
        }

        tr:nth-child(even) {
          background: #ddd;
        }

        td {
          text-wrap: nowrap;
        }

        a svg {
            fill: #22e;
        }
      `,
    ];
  }

  render() {
    return html`<rr-window
      label="Frequency Manager"
      id="frequencyManager"
      class=${this.inline ? "inline" : ""}
      .hidden=${this.hidden}
      .fixed=${this.inline}
      .resizeable=${true}
    >
      <button slot="label-right" id="close" @click=${this.onClose}>
        ${Icons.Close}
      </button>
      <div><input type="text" /><button>Save</button></div>
      <table>
        <tr>
          <th>Name</th>
          <th>Frequency</th>
          <th>Mode</th>
          <th></th>
        </tr>
        <tr>
          <td>WNYC</td>
          <td>93.9 MHz</td>
          <td>WBFM</td>
          <td><a href="javascript:0">${Icons.Edit}</a><a href="javascript:0">${Icons.Delete}</a></td>
        </tr>
        <tr>
          <td>Weather</td>
          <td>162550 kHz</td>
          <td>NBFM</td>
          <td><a href="javascript:0">${Icons.Edit}</a><a href="javascript:0">${Icons.Delete}</a></td>
        </tr>
      </table>
    </rr-window>`;
  }

  @property({ attribute: false }) inline: boolean = false;
  @property({ attribute: false }) hidden: boolean = false;
  @query("rr-window") private window?: RrWindow;

  getPosition(): WindowPosition | undefined {
    return this.window?.getPosition();
  }

  activate() {
    this.window?.activate();
  }

  private onClose() {
    this.dispatchEvent(new WindowClosedEvent());
  }
}
