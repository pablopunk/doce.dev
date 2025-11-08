import type { Identifier } from "../value-objects/identifier.vo";

/**
 * Base class for Entities
 * Entities are compared by identity (id), not by value
 */
export abstract class BaseEntity<T> {
  protected readonly _id: Identifier;
  protected props: T;

  constructor(props: T, id: Identifier) {
    this._id = id;
    this.props = props;
  }

  get id(): Identifier {
    return this._id;
  }

  equals(other: BaseEntity<T>): boolean {
    if (!other) return false;
    if (!(other instanceof this.constructor)) return false;
    
    return this._id.equals(other._id);
  }
}
