import { del, get, head, patch, post, put, RequestBody } from './fetch.js'
import { deleteJSON, getJSON, patchJSON, postJSON, putJSON } from './fetch-json.js'
import { getHeader, HeadersOption, hasHeader, removeHeader, setHeader, toHeaderRecord } from './headers.js'
import { RequestOptions, RequestOptionsWithSchema } from './request-options.js'
import { StandardSchemaV1 } from './standard-schema.v1.js'

export interface RestClientOptions {
    /** Prepended to every URL, except `http://…`, `https://…` and `//host/…` URLs which are used as is. */
    baseUrl?: string
    /** Bearer token sent with every request, unless a request sets its own `token` or `Authorization` header. */
    token?: string
    /** Headers sent with every request. A request's own headers replace them by name, ignoring case. */
    headers?: HeadersOption
    /** Default timeout in milliseconds. `null` or `Infinity` in a request means no timeout. */
    timeout?: number
    /** Default fetch credentials mode. */
    credentials?: 'omit' | 'same-origin' | 'include'
}

export interface RestClientRequestOptions<T> extends RequestOptions<T> {
    /** Sends the request without the client defaults (base URL, token, headers, timeout, credentials), as the plain functions do. */
    ignoreDefaults?: boolean
}

export interface RestClientRequestOptionsWithSchema<T, S extends StandardSchemaV1> extends RequestOptionsWithSchema<T, S> {
    /** Sends the request without the client defaults (base URL, token, headers, timeout, credentials), as the plain functions do. */
    ignoreDefaults?: boolean
}

/** The methods of RestClient, to type dependencies on a client and replace it with a mock in tests. */
export interface IRestClient {
    getJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>>
    getJSON<T>(url: string, options?: RestClientRequestOptions<undefined>): Promise<T>
    deleteJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>>
    deleteJSON<T>(url: string, options?: RestClientRequestOptions<undefined>): Promise<T>
    postJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    postJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T>
    putJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    putJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T>
    patchJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    patchJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T>

    get(url: string, options?: RestClientRequestOptions<undefined>): Promise<Response>
    del(url: string, options?: RestClientRequestOptions<undefined>): Promise<Response>
    post(url: string, options?: RestClientRequestOptions<RequestBody>): Promise<Response>
    put(url: string, options?: RestClientRequestOptions<RequestBody>): Promise<Response>
    patch(url: string, options?: RestClientRequestOptions<RequestBody>): Promise<Response>
    head(url: string, options?: RestClientRequestOptions<undefined>): Promise<Response>
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

    getJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>>
    getJSON<T>(url: string, options?: RestClientRequestOptions<undefined>): Promise<T>
    getJSON<T>(url: string, options?: RestClientRequestOptions<undefined>): Promise<T> {
        const [target, merged] = this.prepare(url, options)
        return getJSON<T>(target, merged)
    }

    deleteJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>>
    deleteJSON<T>(url: string, options?: RestClientRequestOptions<undefined>): Promise<T>
    deleteJSON<T>(url: string, options?: RestClientRequestOptions<undefined>): Promise<T> {
        const [target, merged] = this.prepare(url, options)
        return deleteJSON<T>(target, merged)
    }

    postJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    postJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T>
    postJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T> {
        const [target, merged] = this.prepare(url, options)
        return postJSON<T>(target, merged)
    }

    putJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    putJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T>
    putJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T> {
        const [target, merged] = this.prepare(url, options)
        return putJSON<T>(target, merged)
    }

    patchJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    patchJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T>
    patchJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T> {
        const [target, merged] = this.prepare(url, options)
        return patchJSON<T>(target, merged)
    }

    get(url: string, options?: RestClientRequestOptions<undefined>): Promise<Response> {
        return get(...this.prepare(url, options))
    }

    del(url: string, options?: RestClientRequestOptions<undefined>): Promise<Response> {
        return del(...this.prepare(url, options))
    }

    post(url: string, options?: RestClientRequestOptions<RequestBody>): Promise<Response> {
        return post(...this.prepare(url, options))
    }

    put(url: string, options?: RestClientRequestOptions<RequestBody>): Promise<Response> {
        return put(...this.prepare(url, options))
    }

    patch(url: string, options?: RestClientRequestOptions<RequestBody>): Promise<Response> {
        return patch(...this.prepare(url, options))
    }

    head(url: string, options?: RestClientRequestOptions<undefined>): Promise<Response> {
        return head(...this.prepare(url, options))
    }

    /** Returns the URL to request and a copy of the request options completed with the client defaults. */
    protected prepare<T>(url: string, options?: RestClientRequestOptions<T>): [string, RequestOptions<T>] {
        const { ignoreDefaults, ...requestOptions } = options ?? {}
        if (ignoreDefaults) {
            return [url, requestOptions]
        }
        return [this.resolveURL(url), this.withDefaults(requestOptions)]
    }

    /** Joins a relative URL to baseUrl with exactly one slash between them. */
    private resolveURL(url: string): string {
        if (!this.baseUrl || /^(https?:)?\/\//i.test(url)) {
            return url
        }
        const base = this.baseUrl.replace(/\/+$/, '')
        if (url === '' || url.startsWith('?') || url.startsWith('#')) {
            return base + url
        }
        return `${base}/${url.replace(/^\/+/, '')}`
    }

    private withDefaults<T>(options: RequestOptions<T>): RequestOptions<T> {
        const ownHeaders = toHeaderRecord(options.headers)
        const headers = { ...this.headers }
        for (const [name, value] of Object.entries(ownHeaders)) {
            setHeader(headers, name, value)
        }
        const merged: RequestOptions<T> = { ...options, headers }
        const timeout = options.timeout !== undefined ? options.timeout : this.timeout
        if (timeout !== undefined) {
            merged.timeout = timeout
        }
        const credentials = options.credentials ?? this.credentials
        if (credentials !== undefined) {
            merged.credentials = credentials
        }
        if (options.token === undefined && this.token !== undefined && !hasHeader(ownHeaders, 'Authorization')) {
            merged.token = this.token
        }
        return merged
    }
}
