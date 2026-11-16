import { del, get, post, put, RequestBody } from './fetch.js'
import { deleteJSON, getJSON, postJSON, putJSON } from './fetch-json.js'
import { getHeader, HeadersOption, hasHeader, removeHeader, setHeader, toHeaderRecord } from './headers.js'
import { RequestOptions, RequestOptionsWithSchema } from './request-options.js'
import { StandardSchemaV1 } from './standard-schema.v1.js'

export interface RestClientOptions {
    /** Prepended to every relative URL. Absolute URLs (`https://…`, `//host/…`) are used as is. */
    baseUrl?: string
    /** Bearer token sent with every request, unless a request sets its own `token` or `Authorization` header. */
    token?: string
    /** Headers sent with every request. A request's own headers replace them by name, ignoring case. */
    headers?: HeadersOption
    /** Default timeout in milliseconds. */
    timeout?: number
    /** Default fetch credentials mode. */
    credentials?: 'omit' | 'same-origin' | 'include'
}

/** The methods of RestClient, to type dependencies on a client and replace it with a mock in tests. */
export interface IRestClient {
    getJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>>
    getJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T>
    deleteJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>>
    deleteJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T>
    postJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    postJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T>
    putJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    putJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T>

    get(url: string, options?: RequestOptions<undefined>): Promise<Response>
    del(url: string, options?: RequestOptions<undefined>): Promise<Response>
    post(url: string, options?: RequestOptions<RequestBody>): Promise<Response>
    put(url: string, options?: RequestOptions<RequestBody>): Promise<Response>
}

/**
 * A client that sends its defaults (base URL, token, headers, timeout, credentials) with every request.
 * The defaults can be changed at any time; headers through setHeader and removeHeader.
 */
export class RestClient implements IRestClient {
    baseUrl: string | undefined
    token: string | undefined
    timeout: number | undefined
    credentials: 'omit' | 'same-origin' | 'include' | undefined

    private readonly headers: Record<string, string>

    constructor(options: RestClientOptions = {}) {
        this.baseUrl = options.baseUrl
        this.token = options.token
        this.timeout = options.timeout
        this.credentials = options.credentials
        this.headers = toHeaderRecord(options.headers)
    }

    /** Sets a default header, replacing any header of the same name (ignoring case). */
    setHeader(name: string, value: string): void {
        setHeader(this.headers, name, value)
    }

    /** Removes a default header (ignoring case). */
    removeHeader(name: string): void {
        removeHeader(this.headers, name)
    }

    /** Returns the value of a default header (ignoring case). */
    getHeader(name: string): string | undefined {
        return getHeader(this.headers, name)
    }

    getJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>>
    getJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T>
    getJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T> {
        return getJSON<T>(this.resolveURL(url), this.withDefaults(options))
    }

    deleteJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>>
    deleteJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T>
    deleteJSON<T>(url: string, options?: RequestOptions<undefined>): Promise<T> {
        return deleteJSON<T>(this.resolveURL(url), this.withDefaults(options))
    }

    postJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    postJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T>
    postJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T> {
        return postJSON<T>(this.resolveURL(url), this.withDefaults(options))
    }

    putJSON<T extends StandardSchemaV1>(url: string, options: RequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    putJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T>
    putJSON<T>(url: string, options?: RequestOptions<unknown>): Promise<T> {
        return putJSON<T>(this.resolveURL(url), this.withDefaults(options))
    }

    get(url: string, options?: RequestOptions<undefined>): Promise<Response> {
        return get(this.resolveURL(url), this.withDefaults(options))
    }

    del(url: string, options?: RequestOptions<undefined>): Promise<Response> {
        return del(this.resolveURL(url), this.withDefaults(options))
    }

    post(url: string, options?: RequestOptions<RequestBody>): Promise<Response> {
        return post(this.resolveURL(url), this.withDefaults(options))
    }

    put(url: string, options?: RequestOptions<RequestBody>): Promise<Response> {
        return put(this.resolveURL(url), this.withDefaults(options))
    }

    /** Joins a relative URL to baseUrl with exactly one slash between them. */
    protected resolveURL(url: string): string {
        if (!this.baseUrl || /^([a-z][a-z\d+\-.]*:|\/\/)/i.test(url)) {
            return url
        }
        const base = this.baseUrl.replace(/\/+$/, '')
        if (url === '' || url.startsWith('?') || url.startsWith('#')) {
            return base + url
        }
        return `${base}/${url.replace(/^\/+/, '')}`
    }

    /** Returns a copy of the request options completed with the client defaults. */
    protected withDefaults<T extends RequestOptions<unknown>>(options?: T): T {
        const ownHeaders = toHeaderRecord(options?.headers)
        const headers = { ...this.headers }
        for (const [name, value] of Object.entries(ownHeaders)) {
            setHeader(headers, name, value)
        }
        const merged = { ...options, headers } as T
        const timeout = options?.timeout ?? this.timeout
        if (timeout !== undefined) {
            merged.timeout = timeout
        }
        const credentials = options?.credentials ?? this.credentials
        if (credentials !== undefined) {
            merged.credentials = credentials
        }
        if (options?.token === undefined && this.token !== undefined && !hasHeader(ownHeaders, 'Authorization')) {
            merged.token = this.token
        }
        return merged
    }
}
