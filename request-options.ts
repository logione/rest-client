import { HeadersOption } from './headers.js'
import { Search } from './search.js'
import { StandardSchemaV1 } from './standard-schema.v1.js'

export interface RequestOptions<T> {
    token?: string
    headers?: HeadersOption
    body?: T | undefined
    search?: Search
    signal?: AbortSignal
    timeout?: number
    credentials?: 'omit' | 'same-origin' | 'include'
}

export interface RequestOptionsWithSchema<T, S extends StandardSchemaV1> extends RequestOptions<T> {
    schema: S
}