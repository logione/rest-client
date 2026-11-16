import { request } from './fetch.js'
import { getHeader, setHeader, toHeaderRecord } from './headers.js'
import { RequestOptions, RequestOptionsWithSchema } from './request-options.js'
import { SchemaValidationError } from './schema-validation-error.js'
import { StandardSchemaV1 } from './standard-schema.v1.js'

export function getJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>>
export function getJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T>
export function getJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T> {
    return requestJSON<T>('GET', url, options)
}

export function deleteJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>> 
export function deleteJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T> 
export function deleteJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T> {
    return requestJSON<T>('DELETE', url, options)
}

export function putJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
export function putJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T>
export function putJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T> {
    return requestJSON<T>('PUT', url, options)
}

export function postJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
export function postJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T> 
export function postJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T> {
    return requestJSON<T>('POST', url, options)
}

async function requestJSON<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, options: RequestOptions<unknown> | RequestOptionsWithSchema<unknown, any> = {}): Promise<T> {
    const headers = toHeaderRecord(options.headers)
    if (!acceptsJSON(getHeader(headers, 'Accept'))) {
        setHeader(headers, 'Accept', 'application/json')
    }
    let body: unknown = undefined

    if (hasJSONBody(method, options.body)) {
        if (!isJSONContentType(getHeader(headers, 'Content-Type'))) {
            setHeader(headers, 'Content-Type', 'application/json')
        }
        body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
    }
    const result = await request(method, url, { ...options, headers, body } as RequestOptions<string>)
    let parsedResult
    if (isJSONContentType(result.headers.get('content-type'))) {
        const text = await result.text()
        parsedResult = text.trim() === '' ? undefined : JSON.parse(text)
    } else {
        parsedResult = await result.text()
    }
    if (options && 'schema' in options) {
        return validateSchema(options.schema, parsedResult)
    }
    return parsedResult
}

function hasJSONBody(method: 'GET' | 'POST' | 'PUT' | 'DELETE', body: unknown): boolean {
    if (body === undefined || body === '') {
        return false
    }
    return method === 'POST' || method === 'PUT' || Boolean(body)
}

function isJSONContentType(contentType: string | null | undefined): boolean {
    if (!contentType) {
        return false
    }
    return isJSONMediaType(contentType.split(';')[0])
}

function acceptsJSON(accept: string | undefined): boolean {
    if (!accept) {
        return false
    }
    return accept.split(',').some((range) => isJSONMediaType(range.split(';')[0]))
}

function isJSONMediaType(mediaType: string): boolean {
    mediaType = mediaType.trim().toLowerCase()
    return mediaType === 'application/json' || mediaType.endsWith('+json')
}

async function validateSchema<T extends StandardSchemaV1>(schema: T, input: StandardSchemaV1.InferInput<T>): Promise<StandardSchemaV1.InferOutput<T>> {
    let result = schema['~standard'].validate(input);
    if (result instanceof Promise) {
        result = await result
    }

    if (result.issues) {
        throw new SchemaValidationError(result.issues)
    }

    return result.value
}