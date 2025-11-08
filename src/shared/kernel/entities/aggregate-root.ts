import { BaseEntity } from "./base-entity";

/**
 * Aggregate Root base class
 * Aggregates are clusters of entities and value objects with a single root
 */
export abstract class AggregateRoot<T> extends BaseEntity<T> {
  // Future: Add domain events support
  // private _domainEvents: DomainEvent[] = [];
  
  // addDomainEvent(event: DomainEvent): void {
  //   this._domainEvents.push(event);
  // }
  
  // getDomainEvents(): DomainEvent[] {
  //   return this._domainEvents;
  // }
  
  // clearDomainEvents(): void {
  //   this._domainEvents = [];
  // }
}
