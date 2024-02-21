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

/** An ugly receiver to be able to test all the functionality. */

import "@shoelace-style/shoelace/dist/themes/light.css";
import "@shoelace-style/shoelace/dist/components/divider/divider.js";
import "../src/ui/rr-face";
import { RrFace } from "../src/ui/rr-face";
import { Demodulator, DemodulatorEvent } from "../src/demod/demodulator";
import { Radio, RadioEvent } from "../src/radio/radio";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";
import { connectRadioToFace } from "../src/ui/face-connector";

let scripts = document.getElementsByTagName("script");
let myScript = scripts[scripts.length - 1];
let mySrc = myScript.src;
let myPath = mySrc.substring(0, mySrc.lastIndexOf("/"));
setBasePath(myPath);

function main() {
  let demodulator = new Demodulator();
  let radio = new Radio(demodulator);
  let eventLog = document.querySelector("#eventLog");
  radio.addEventListener("radio", (e: RadioEvent) => {
    if (eventLog)
      eventLog.textContent = `${new Date().toLocaleTimeString()} Radio: ${JSON.stringify(e.detail)}\n${eventLog.textContent}`;
  });
  demodulator.addEventListener("demodulator", (e: DemodulatorEvent) => {
    if (eventLog)
      eventLog.textContent = `${new Date().toLocaleTimeString()} Demodulator: ${JSON.stringify(e.detail)}\n${eventLog.textContent}`;
  });

  demodulator.setVolume(1);
  demodulator.setStereo(true);
  demodulator.setSquelch(0.5);

  document
    .querySelectorAll("rr-face")
    .forEach((face) => connectRadioToFace(radio, demodulator, face as RrFace));
}

window.addEventListener("load", main);
