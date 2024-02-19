import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
import '../src/ui/rr-face';

let scripts = document.getElementsByTagName('script');
let myScript = scripts[scripts.length - 1];
let mySrc = myScript.src;
let myPath = mySrc.substring(0, mySrc.lastIndexOf('/'));
setBasePath(myPath);