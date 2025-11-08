/**
 * Base class for Value Objects
 * Value Objects are immutable and compared by value, not identity
 */
export abstract class BaseValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  equals(other: BaseValueObject<T>): boolean {
    if (!other) return false;
    if (!(other instanceof this.constructor)) return false;
    
    return this.deepEquals(this.props, other.props);
  }

  private deepEquals(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== "object" || typeof b !== "object") return false;

    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEquals((a as any)[key], (b as any)[key])) return false;
    }

    return true;
  }

  toString(): string {
    return JSON.stringify(this.props);
  }
}
