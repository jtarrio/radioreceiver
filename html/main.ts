import "@shoelace-style/shoelace/dist/themes/light.css";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import "@shoelace-style/shoelace/dist/components/divider/divider.js";
import "../src/ui/rr-face-basic";
import { RrFaceBasic } from "../src/ui/rr-face-basic";
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
  demodulator.setVolume(1);
  demodulator.setStereo(true);
  demodulator.setSquelch(0);

  connectRadioToFace(
    radio,
    demodulator,
    document.querySelector("rr-face-basic") as RrFaceBasic
  );
}

window.addEventListener("load", main);
