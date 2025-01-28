import { Search } from './search'
import { StandardSchemaV1 } from './standard-schema.v1'

export interface RequestOptions<T> {
    token?: string
    headers?: Record<string, string>
    body?: T | undefined
    search?: Search
}

export interface RequestOptionsWithSchema<T, S extends StandardSchemaV1> extends RequestOptions<T> {
    schema: S
}