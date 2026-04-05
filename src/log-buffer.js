export class LogBuffer {
  constructor(limit = 500) {
    this.limit = limit;
    this.rows = [];
  }

  push(level, message, meta = null) {
    this.rows.push({
      at: new Date().toISOString(),
      level,
      message,
      meta,
    });
    this.rows = this.rows.slice(-this.limit);
  }

  list(limit = 200) {
    return this.rows.slice(-limit);
  }
}
