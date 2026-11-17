import { del, get, head, isStreamBody, patch, post, put, RequestBody } from './fetch.js'
import { deleteJSON, getJSON, patchJSON, postJSON, putJSON } from './fetch-json.js'
import { getHeader, HeadersOption, hasHeader, removeHeader, setHeader, toHeaderRecord } from './headers.js'
import { RequestError } from './request-error.js'
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
    /**
     * Called when a request sent with the client token gets a 401 response, to renew the token.
     * Returns the new token, and the request is sent again with it, once; or false to give up.
     */
    onUnauthorized?: UnauthorizedHandler
}

/**
 * Renews the client token after a 401 response. Returns the new token, which becomes the client token
 * and is used to send the request again, once. Returning false (or anything but a non-empty string)
 * gives up: the request rejects with the 401 RequestError.
 *
 * `client` is a copy of the client defaults without onUnauthorized, for the requests of the renewal
 * (such as the token refresh): a 401 there rejects at once. Changes made on it are not applied to the
 * client: the returned token is the only result. Requests sent with the token being renewed wait for
 * one shared call.
 */
export type UnauthorizedHandler = (error: RequestError<unknown>, client: RestClient) => string | false | Promise<string | false>

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
    onUnauthorized: UnauthorizedHandler | undefined

    private readonly headers: Record<string, string>
    /** The renewal in progress, for the token it renews. */
    private renewal: { token: string, renewed: Promise<boolean> } | undefined
    /** A token that onUnauthorized failed to renew, so its later 401s don't call it again. */
    private unrenewable: { token: string } | undefined

    constructor(options: RestClientOptions = {}) {
        this.baseUrl = options.baseUrl
        this.token = options.token
        this.timeout = options.timeout
        this.credentials = options.credentials
        this.onUnauthorized = options.onUnauthorized
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
        return this.send(url, options, (target, merged) => getJSON<T>(target, merged))
    }

    deleteJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<undefined, T>): Promise<StandardSchemaV1.InferOutput<T>>
    deleteJSON<T>(url: string, options?: RestClientRequestOptions<undefined>): Promise<T>
    deleteJSON<T>(url: string, options?: RestClientRequestOptions<undefined>): Promise<T> {
        return this.send(url, options, (target, merged) => deleteJSON<T>(target, merged))
    }

    postJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    postJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T>
    postJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T> {
        return this.send(url, options, (target, merged) => postJSON<T>(target, merged))
    }

    putJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    putJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T>
    putJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T> {
        return this.send(url, options, (target, merged) => putJSON<T>(target, merged))
    }

    patchJSON<T extends StandardSchemaV1>(url: string, options: RestClientRequestOptionsWithSchema<unknown, T>): Promise<StandardSchemaV1.InferOutput<T>>
    patchJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T>
    patchJSON<T>(url: string, options?: RestClientRequestOptions<unknown>): Promise<T> {
        return this.send(url, options, (target, merged) => patchJSON<T>(target, merged))
    }

    get(url: string, options?: RestClientRequestOptions<undefined>): Promise<Response> {
        return this.send(url, options, get)
    }

    del(url: string, options?: RestClientRequestOptions<undefined>): Promise<Response> {
        return this.send(url, options, del)
    }

    post(url: string, options?: RestClientRequestOptions<RequestBody>): Promise<Response> {
        return this.send(url, options, post, !isStreamBody(options?.body))
    }

    put(url: string, options?: RestClientRequestOptions<RequestBody>): Promise<Response> {
        return this.send(url, options, put, !isStreamBody(options?.body))
    }

    patch(url: string, options?: RestClientRequestOptions<RequestBody>): Promise<Response> {
        return this.send(url, options, patch, !isStreamBody(options?.body))
    }

    head(url: string, options?: RestClientRequestOptions<undefined>): Promise<Response> {
        return this.send(url, options, head)
    }

    /**
     * Sends a request with the client defaults. On a 401, renews the token with onUnauthorized and sends
     * the request once more. `replayable` is false when the body is a stream, which can't be sent twice.
     */
    protected async send<T, R>(url: string, options: RestClientRequestOptions<T> | undefined, run: (url: string, options: RequestOptions<T>) => Promise<R>, replayable = true): Promise<R> {
        const [target, merged] = this.prepare(url, options)
        try {
            return await run(target, merged)
        } catch (err) {
            const sentToken = this.clientTokenSent(options, merged)
            if (!replayable || !(err instanceof RequestError) || err.status !== 401 || sentToken === undefined) {
                throw err
            }
            if (!await this.renew(err, sentToken)) {
                // The 401 body is kept for the caller.
                throw err
            }
            this.discardBody(err.response)
        }
        return run(...this.prepare(url, options))
    }

    /** Resolves true when the request sent with `sentToken` should be sent again. */
    private renew(error: RequestError<unknown>, sentToken: string): Promise<boolean> {
        if (this.token !== sentToken) {
            // Renewed since the request was sent.
            return Promise.resolve(true)
        }
        if (this.renewal && this.renewal.token === sentToken) {
            return this.renewal.renewed
        }
        if (!this.onUnauthorized || (this.unrenewable && this.unrenewable.token === sentToken)) {
            return Promise.resolve(false)
        }
        const onUnauthorized = this.onUnauthorized
        const renewal = {
            token: sentToken,
            renewed: (async () => {
                const token: unknown = await onUnauthorized(error, this.copyWithoutOnUnauthorized())
                if (typeof token !== 'string' || token === '') {
                    this.unrenewable = { token: sentToken }
                    return false
                }
                this.token = token
                this.unrenewable = undefined
                return true
            })()
        }
        this.renewal = renewal
        const clear = () => {
            if (this.renewal === renewal) {
                this.renewal = undefined
            }
        }
        renewal.renewed.then(clear, clear)
        return renewal.renewed
    }

    /** A client with the same defaults, without onUnauthorized, for the requests sent by onUnauthorized. */
    private copyWithoutOnUnauthorized(): RestClient {
        const Client = this.constructor as new (options: RestClientOptions) => RestClient
        return new Client({ baseUrl: this.baseUrl, token: this.token, headers: this.headers, timeout: this.timeout, credentials: this.credentials })
    }

    /**
     * The client token the request was sent with, or undefined when it was sent without it: with
     * ignoreDefaults, its own token or Authorization header, or no client token (undefined or '', which sends none).
     */
    private clientTokenSent<T>(options: RestClientRequestOptions<T> | undefined, merged: RequestOptions<T>): string | undefined {
        if (options?.ignoreDefaults || options?.token !== undefined || hasHeader(toHeaderRecord(options?.headers), 'Authorization')) {
            return undefined
        }
        return merged.token || undefined
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

    private discardBody(response: unknown): void {
        if (typeof Response !== 'undefined' && response instanceof Response) {
            response.body?.cancel().catch(() => {})
        } else if (response && typeof (response as { resume?: unknown }).resume === 'function') {
            // A Node.js IncomingMessage from the stream functions.
            (response as { resume(): void }).resume()
        }
    }
}
