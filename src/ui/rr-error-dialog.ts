// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/dialog/dialog.js";
import SlDialog from "@shoelace-style/shoelace/dist/components/dialog/dialog.js";
import { LitElement, css, html } from "lit";
import { customElement, state, query } from "lit/decorators.js";

@customElement("rr-error-dialog")
export default class RrErrorDialog extends LitElement {
  @state() content: string[] = [];

  @query("#dialog") dialog?: SlDialog;

  render() {
    return html`<sl-dialog label="Error" id="dialog"
      >${this.content.length == 1
        ? html`${this.content[0]}`
        : this.content.map((line) => html`<p>${line}</p>`)}
      <sl-button slot="footer" variant="primary" @click=${this._handleClose}
        >Close</sl-button
      >
    </sl-dialog>`;
  }

  show(text: string | string[]) {
    this.content = Array.isArray(text) ? text : [text];
    this.dialog?.show();
  }

  private _handleClose() {
    this.dialog?.hide();
  }
}
