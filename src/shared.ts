export class Mappings {
  connection = new Map<string, string>();
  type = new Map<string, string>();

  constructor() {}

  push(from: string, to: string, type?: string) {
    this.connection.set(from, to);

    if (type) {
      this.type.set(from, type);
    }
  }
}
