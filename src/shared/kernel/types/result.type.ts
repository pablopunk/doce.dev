/**
 * Result type for operations that can fail
 * Inspired by Rust's Result<T, E>
 */

export type Result<T, E = Error> = Success<T> | Failure<E>;

export class Success<T> {
  readonly ok: true = true;
  constructor(public readonly value: T) {}

  isSuccess(): this is Success<T> {
    return true;
  }

  isFailure(): this is Failure<never> {
    return false;
  }
}

export class Failure<E> {
  readonly ok: false = false;
  constructor(public readonly error: E) {}

  isSuccess(): this is Success<never> {
    return false;
  }

  isFailure(): this is Failure<E> {
    return true;
  }
}

export const ok = <T>(value: T): Success<T> => new Success(value);
export const fail = <E>(error: E): Failure<E> => new Failure(error);
