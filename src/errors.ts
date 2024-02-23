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

export class RadioError extends Error {
  constructor(
    message: string,
    type?: RadioErrorType,
    options?: RadioErrorOptions
  );
  constructor(message: string, type?: RadioErrorType);
  constructor(message: string, options?: RadioErrorOptions);
  constructor(
    message: string,
    typeOrOptions?: RadioErrorType | RadioErrorOptions,
    options?: RadioErrorOptions
  ) {
    super(
      message,
      options !== undefined
        ? options
        : typeof typeOrOptions === "object"
          ? typeOrOptions
          : undefined
    );
    if (typeof typeOrOptions === "number") {
      this.type = typeOrOptions;
      this.name = `RadioError.${RadioErrorType[typeOrOptions]}`;
    }
  }

  type?: RadioErrorType;
}

export enum RadioErrorType {
  NoUsbSupport,
  NoDeviceSelected,
  UnsupportedDevice,
  UsbTransferError,
  TunerError,
  DemodulationError,
}

type RadioErrorOptions = {
  cause?: any;
};
