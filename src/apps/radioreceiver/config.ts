/** Loads the configuration from local storage. */
export function loadConfig(): ConfigProvider {
  let cfgJson = localStorage.getItem("config");
  let cfg = blankConfig();
  if (cfgJson != null) {
    cfg = merged(cfg, JSON.parse(cfgJson));
  }
  return new ConfigProvider(cfg);
}

/** Configuration keys. */
export type Config = ConfigV1;

/** A class with methods to get, update, and save the configuration. */
export class ConfigProvider {
  constructor(cfg: RawConfig) {
    this.cfg = { ...blankConfig, ...cfg };
  }

  private cfg: RawConfig;
  private timeout?: number;

  /** Saves the current configuration to local storage. */
  save() {
    localStorage.setItem("config", JSON.stringify(this.cfg));
    clearTimeout(this.timeout);
  }

  /** Returns a copy of the current configuration. */
  get(): Config {
    return { ...this.cfg.v1! };
  }

  /** Calls a function that makes changes in the configuration, then saves the modified configuration. */
  update(upFn: (cfg: Config) => void) {
    upFn(this.cfg.v1!);
    this.scheduleSave();
  }

  private scheduleSave() {
    clearTimeout(this.timeout);
    this.timeout = window.setTimeout(() => this.save());
  }
}

function blankConfig(): RawConfig {
  return {
    v1: {
      modes: {
        WBFM: { scheme: "WBFM", stereo: true },
        NBFM: { scheme: "NBFM", maxF: 5000 },
        AM: { scheme: "AM", bandwidth: 15000 },
        LSB: { scheme: "LSB", bandwidth: 2800 },
        USB: { scheme: "USB", bandwidth: 2800 },
        CW: { scheme: "CW", bandwidth: 50 },
      },
      mode: "WBFM",
      centerFrequency: 88500000,
      tunedFrequency: 88500000,
      tuningStep: 1000,
      frequencyScale: 1000,
      gain: null,
      sampleRate: 1024000,
      ppm: 0,
      fftSize: 2048,
      minDecibels: -90,
      maxDecibels: -20,
    },
  };
}

function merged(a: any, b: any): any {
  const isObject = (i: any) => i && typeof i === "object" && !Array.isArray(i);
  if (!isObject(a) || !isObject(b)) return b;
  let ret = { ...a };
  for (const k in b) {
    ret[k] = merged(ret[k], b[k]);
  }
  return ret;
}

type RawConfig = { v1?: ConfigV1 };
type ConfigV1 = {
  /** Available modes. */
  modes: { [key: string]: ConfigV1Mode };
  /** Current mode. */
  mode: string;
  /** Frequency tuned by the RTL device. */
  centerFrequency: number;
  /** Frequency tuned by the demodulator. */
  tunedFrequency: number;
  /** Step between frequencies. */
  tuningStep: number;
  /** Current frequency scale. */
  frequencyScale: number;
  /** Current gain. */
  gain: number | null;
  /** RTL sample rate. */
  sampleRate: number;
  /** RTL frequency correction factor in PPM. */
  ppm: number;
  /** Size of the spectrum display. */
  fftSize: number;
  /** Minimum number of decibels for scope. */
  minDecibels: number;
  /** Maximum number of decibels for scope. */
  maxDecibels: number;
};

/** This definition parallels the Mode from scheme.ts */
type ConfigV1Mode =
  | { scheme: "WBFM"; stereo: boolean }
  | { scheme: "NBFM"; maxF: number }
  | { scheme: "AM"; bandwidth: number }
  | { scheme: "USB"; bandwidth: number }
  | { scheme: "LSB"; bandwidth: number }
  | { scheme: "CW"; bandwidth: number };
