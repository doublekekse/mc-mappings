export type Type = "class" | "field" | "method";

export class Mappings {
  classes = new Map<string, string>();
  fields = new Map<string, string>();
  methods = new Map<string, string>();

  constructor() {}

  method(from: string, to: string) {
    this.methods.set(from, to);
  }

  field(from: string, to: string) {
    this.fields.set(from, to);
  }

  class(from: string, to: string) {
    this.classes.set(from, to);
  }

  get(type: Type, descriptor: string, name: string) {
    return this.getType(type).get(`${descriptor}###${name}`);
  }

  getType(type: Type) {
    switch (type) {
      case "class":
        return this.classes;
      case "field":
        return this.fields;
      case "method":
        return this.methods;
    }
  }

  push(from: string, to: string, type: Type) {
    switch (type) {
      case "class":
        this.class(from, to);
        return;
      case "field":
        this.field(from, to);
        return;
      case "method":
        this.method(from, to);
        return;
    }
  }
}
