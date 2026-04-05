export class QrState {
  constructor() {
    this.payload = null;
  }

  set(payload) {
    this.payload = payload;
  }

  get() {
    return this.payload;
  }
}
