import { StandardSchemaV1 } from './standard-schema.v1'

export class SchemaValidationError extends Error {
    constructor(public readonly issues: ReadonlyArray<StandardSchemaV1.Issue>) {
        super('Schema validation error')
    }
}