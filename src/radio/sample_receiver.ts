export interface SampleReceiver {
    receiveSamples(samples: ArrayBuffer): void;
    checkForSignal(samples: ArrayBuffer): Promise<boolean>;
}

