# Radio Receiver

An application to listen to radio transmissions from your browser using a cheap USB digital TV tuner.

Try it out at [radio.ea1iti.es](https://radio.ea1iti.es).

## What is this

Radio Receiver is an HTML5 webpage that uses an USB digital TV receiver to capture radio signals, demodulates them in the browser, and plays the demodulated audio through your computer's speakers or headphones. This is called SDR (Software-Defined Radio), because all the radio signal processing is done by software running in the computer instead of purpose-built hardware.

## Compatible hardware and software

Radio Receiver was written to work with an RTL-2832U-based DVB-T (European digital TV) USB receiver, with a R820T tuner chip. This hardware configuration is a little dated, but support for newer tuner chips is planned.

## Building

For a development build:

```shell
$ npm run build
```

You can find the output in the directory `dist`.

For a development build served from your computer with live reload:

```shell
$ npm run watch
```

For a release build:

```shell
$ npm run dist
```

You can find the output in the directory `dist`.

## Acknowledgements

This started as a fork of https://github.com/google/radioreceiver that has been updated to use the HTML5 USB API and modern features, and converted to TypeScript.

Kudos and thanks to the [RTL-SDR project](http://sdr.osmocom.org/trac/wiki/rtl-sdr) for figuring out the magic numbers needed to drive the USB tuner.

If you want to experiment further with Software-Defined Radio and listen to more things using your cheap tuner, you can try [the various programs listed on rtl-sdr.com](http://www.rtl-sdr.com/big-list-rtl-sdr-supported-software/).
