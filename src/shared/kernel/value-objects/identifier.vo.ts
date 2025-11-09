import { randomUUID } from "crypto";
import { BaseValueObject } from "./base-value-object";

/**
 * Identifier Value Object
 * Represents a unique identifier
 */
export class Identifier extends BaseValueObject<string> {
	private constructor(value: string) {
		super(value);
	}

	static create(value?: string): Identifier {
		return new Identifier(value || randomUUID());
	}

	static fromString(value: string): Identifier {
		if (!value || value.trim().length === 0) {
			throw new Error("Identifier cannot be empty");
		}
		return new Identifier(value);
	}

	getValue(): string {
		return this.props;
	}

	toString(): string {
		return this.props;
	}
}
