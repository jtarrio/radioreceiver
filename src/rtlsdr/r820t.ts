// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
// Copyright 2013 Google Inc. All rights reserved.
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

import { R8xx, STD_MUX_CFGS } from "./r8xx";
import { RtlCom } from "./rtlcom";
import { Tuner } from "./tuner";

/** Operations on the R820T tuner chip. */
export class R820T extends R8xx implements Tuner {
  /**
   * Initializes the R820T tuner, if present.
   * @param com The RTL communications object.
   * @returns a promise that resolves to the tuner, or null if not present.
   */
  static async maybeInit(com: RtlCom): Promise<Tuner | null> {
    let found = await R8xx.check(com, 0x34);
    if (!found) return null;
    let tuner = new R820T(com);
    await tuner.open();
    return tuner;
  }

  /**
   * @param com The RTL communications object.
   * @param xtalFreq The frequency of the oscillator crystal.
   */
  private constructor(com: RtlCom) {
    super(com, 0x34, STD_MUX_CFGS, 2);
  }
}
