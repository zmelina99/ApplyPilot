/** Domain-level errors, distinct from database/driver errors. */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Raised when an application status transition is not allowed. */
export class InvalidTransitionError extends DomainError {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Invalid application status transition: ${from} -> ${to}`);
  }
}

/** Raised when an entity expected to exist was not found. */
export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
  }
}
