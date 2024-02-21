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

/** A message channel, in which messages are sent and received asynchronously. */
export class Channel<Msg> {
  constructor() {
    this.msgQueue = [];
    this.notifyQueue = [];
  }

  /** Messages waiting to be delivered. */
  private msgQueue: Msg[];
  /** Clients waiting to receive messages. */
  private notifyQueue: ((msg: Msg) => void)[];

  /**
   * Sends a message.
   *
   * If there is a client waiting to receive a message, it is delivered straight to it.
   * Otherwise, the message is added to the queue.
   */
  send(msg: Msg) {
    let notif = this.notifyQueue.shift();
    if (notif !== undefined) {
      notif(msg);
    } else {
      this.msgQueue.push(msg);
    }
  }

  /**
   * Receives a message, returning a promise.
   *
   * If there is a message in the queue, the promise resolves to that message.
   * Otherwise, the promise will resolve when a message is received.
   */
  receive(): Promise<Msg> {
    let msg = this.msgQueue.shift();
    if (msg !== undefined) return Promise.resolve(msg);
    return new Promise((r) => this.notifyQueue.push(r));
  }
}
