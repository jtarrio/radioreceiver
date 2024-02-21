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
