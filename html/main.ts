import "@shoelace-style/shoelace/dist/themes/light.css";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import "@shoelace-style/shoelace/dist/components/divider/divider.js";
import "../src/ui/rr-error-dialog";
import "../src/ui/rr-face-basic";
import RrFaceBasic from "../src/ui/rr-face-basic";
import RrErrorDialog from "../src/ui/rr-error-dialog";
import { Demodulator } from "../src/demod/demodulator";
import { Radio } from "../src/radio/radio";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";
import { connectRadioToFace } from "../src/ui/face-connector";
import { RadioErrorType } from "../src/errors";
import { RTL2832U_Provider } from "../src/rtlsdr/rtl2832u";

let scripts = document.getElementsByTagName("script");
let myScript = scripts[scripts.length - 1];
let mySrc = myScript.src;
let myPath = mySrc.substring(0, mySrc.lastIndexOf("/"));
setBasePath(myPath);

function main() {
  let errorDialog = document.querySelector("#errorDialog") as RrErrorDialog;

  let rtlProvider = new RTL2832U_Provider();
  let demodulator = new Demodulator();
  let radio = new Radio(rtlProvider, demodulator);
  demodulator.setVolume(1);
  demodulator.setStereo(true);
  demodulator.setSquelch(0);

  connectRadioToFace(
    radio,
    demodulator,
    document.querySelector("rr-face-basic") as RrFaceBasic
  );

  radio.addEventListener("radio", (e) => {
    if (e.detail.type == "error") {
      let error = e.detail.exception;
      if (
        error.type === RadioErrorType.NoDeviceSelected &&
        error.cause.name === "NotFoundError"
      ) {
        return;
      } else if (error.type == RadioErrorType.NoUsbSupport) {
        errorDialog.show([
          "This browser does not support the HTML5 USB API.",
          "Please try Chrome, Edge, or Opera on a computer or Android.",
        ]);
      } else {
        errorDialog.show(error.message);
      }
    }
  });
}

window.addEventListener("load", main);
