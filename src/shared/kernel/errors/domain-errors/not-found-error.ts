import { DomainError } from "../base/domain-error";

export class NotFoundError extends DomainError {
	constructor(resource: string, id?: string) {
		const message = id
			? `${resource} with id '${id}' not found`
			: `${resource} not found`;

		super(message, "NOT_FOUND", 404, { resource, id });
	}
}
