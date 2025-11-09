/**
 * Common types used across the application
 */

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type ID = string;

export type Timestamp = Date;

export interface WithId {
	id: ID;
}

export interface WithTimestamps {
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

export interface WithSoftDelete {
	deletedAt: Nullable<Timestamp>;
}
