# Rest Client by LogiONE

This is a free, ultra-lightweight and easy-to-use http(s) client for Node.js and browsers supporting JSON requests and streams with no external dependencies.

It uses fetch for every request, in Node.js and in browsers. In Node.js, the stream functions send and return Node.js streams on top of fetch.

It is similar to [ky](https://github.com/sindresorhus/ky) or [ofetch](https://github.com/unjs/ofetch), with built-in schema validation, token renewal and Node.js streams.

**It supports [Standard Schema](https://standardschema.dev) validation. So, you can validate the data received from any API with your preferred library ([list of supported libraries](https://github.com/standard-schema/standard-schema/blob/main/packages/spec/README.md#what-schema-libraries-implement-the-spec)).**

### Compared to fetch

The same POST request with a bearer token, which fails on an error status:

```javascript
// With fetch
const response = await fetch('https://myapi/addresses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ name: 'john' })
})
if (!response.ok) {
  throw new Error(`${response.status} ${response.statusText}`)
}
const address = await response.json()

// With rest-client
const address = await postJSON('https://myapi/addresses', { body: { name: 'john' }, token })
```

`postJSON` also handles what the fetch version doesn't: an empty response, a response that isn't JSON, a `timeout`, `search` parameters, optional retries, and an optional `schema` to validate the result.

### Two ways to use it

```javascript
// 1. Functions: each request gives everything it needs
import { getJSON } from '@logi.one/rest-client'

const user = await getJSON('https://myapi/v1/users/1', { token })

// 2. RestClient: give the base URL, token and headers once
import { RestClient } from '@logi.one/rest-client'

const api = new RestClient({ baseUrl: 'https://myapi/v1', token })
const user = await api.getJSON('users/1')
```

Both have the same methods and options. The functions suit a few requests to different APIs. `RestClient` suits an app that talks to one API: it sends its defaults with every request, can [renew an expired token](#renewing-an-expired-token), and is easy to [mock in tests](#restclient). See [RestClient](#restclient).

## Installation

```bash
npm install @logi.one/rest-client
```

## Browser support

The same import works in browsers: bundlers (Vite, webpack, esbuild, Rollup…) pick the browser build automatically through the `browser` export condition.

```javascript
import { getJSON } from '@logi.one/rest-client' // resolves to the browser build in a browser bundle
```

The browser build is plain ES modules, so it can also be loaded without a bundler (from `dist/esm/browser.js`). Tools that `require()` the package with the `browser` condition, such as Jest with the jsdom environment, get a CommonJS copy of the same browser build.

Differences from Node.js:

- **Stream functions (`getStream`, `postStream`, `putStream`, `patchStream`) are Node.js only** and are not exported by the browser build. In a browser, use `get` and read `response.body`, which is a web `ReadableStream`.
- **No default `User-Agent` header.** In Node.js, requests send `User-Agent: node` unless you set one. Browsers set their own.
- **CORS applies.** Cross-origin requests need the server to allow them. A CORS preflight (`OPTIONS`) request is sent before any PUT, PATCH or DELETE request, with or without a body, since only GET, HEAD and POST can skip it. JSON requests with a body (`postJSON`, `putJSON`, `patchJSON`) send `Content-Type: application/json`, and `token` adds an `Authorization` header: both also trigger a preflight, so the server must allow these methods and headers.

## Usage

### JSON requests

```javascript
import { getJSON, postJSON, putJSON, patchJSON, deleteJSON } from '@logi.one/rest-client'

// GET request
let response = await getJSON('https://api.github.com/repos/logione/rest-client')
console.log(response.name) // rest-client

// POST request
const body = { name: 'john' }
response = await postJSON('https://myapi/addresses', { body })
console.log(response.id)

// PUT request with bearer token
const token = 'MyBearerToken'
body.name = 'John'
response = await putJSON('https://myapi/addresses/1', { body, token })
console.log(response.name)

// PATCH request with a JSON merge patch
response = await patchJSON('https://myapi/addresses/1', {
  body: { city: null },
  token,
  headers: { 'Content-Type': 'application/merge-patch+json' }
})

// DELETE request with bearer token and custom headers
const headers = { 'X-Custom-Header': 'value' }
response = await deleteJSON('https://myapi/addresses/1', { token, headers })
console.log(response.message)
```

In every function, `headers` can be a plain object, a `Headers` instance or an array of `[name, value]` pairs.

Notes on JSON requests:

- **Body**: objects and other values are serialized with `JSON.stringify`, and `Content-Type: application/json` is added. A string is sent as is (already serialized JSON), so an empty string sends no body. `null`, `false` and `0` are sent as JSON with `postJSON`, `putJSON` and `patchJSON`, and ignored with `getJSON` and `deleteJSON`.
- **Content type**: `Accept` is set to `application/json`, and so is `Content-Type` when there is a body. A JSON media type you set yourself is kept, such as `Content-Type: application/merge-patch+json` or `Accept: application/vnd.api+json`; any other value is replaced.
- **Response**: JSON content types (`application/json` and `+json` types such as `application/problem+json`) are parsed, and an empty JSON response gives `undefined`. Other content types are returned as text.

### JSON request with schema validation

```javascript
import { getJSON } from '@logi.one/rest-client'
import { z } from 'zod' // Example with zod but other libraries can be used.

const schema = z.object({
    email: z.string().email(),
    age: z.number()
})

try {
  const { email, age } = await getJSON('https://example.com/data.json', { schema })
  console.log(email, age) // email and age are valid
} catch (err) {
  if (err.issues) {
    console.error(err.issues) // throws an error if the response does not match the schema
  }
}
```

Every JSON function accepts a `schema`. It validates the parsed response, and the result is typed by the schema. A response that doesn't match it rejects with a `SchemaValidationError`, whose `issues` are those of the schema library.

### Stream requests (Node.js only)

```javascript
import { getStream, postStream, putStream, patchStream } from '@logi.one/rest-client'
import { createReadStream } from 'fs'

// GET stream
const token = 'MyBearerToken'
const stream = await getStream('https://my-source-api/files/1', { token }) // a Node.js Readable
console.log(stream.statusCode, stream.headers['content-type']) // status and headers as in an http IncomingMessage

// POST stream
const headers = { 'X-Custom-Header': 'value' }
await postStream('https://myapi/files', stream, { headers })

// PUT stream
const readStream = createReadStream('file.txt')
await putStream('https://myapi/files/1', readStream)

// PATCH stream
await patchStream('https://myapi/files/1', createReadStream('changes.txt'))
```

The stream functions use fetch, like the other functions. They return a `StreamResponse`: a Node.js `Readable` of the response body with `statusCode`, `statusMessage` and `headers` (lowercase names, `set-cookie` as an array), so it can be piped or read with `for await` as before.

- **Downloads follow redirects.** Uploads don't, since a stream can't be sent twice: a 3xx rejects with a `RequestError`.
- **Compressed responses are decompressed**, as fetch does: a file served with `Content-Encoding: gzip` arrives decompressed, while the header still says gzip.
- **When the server rejects an upload**, the source stream is destroyed so the rest isn't read.

### HTTP requests

```javascript
import { get, head, post, put, patch, del } from '@logi.one/rest-client'

// GET request
let response = await get('https://myapi/texts/1') // response is a fetch Response object
const mytext = await response.text()

// POST request
const text = 'Hello World'
response = await post('https://myapi/texts', { body: text })
console.log(response.headers.get('content-type'))

// PUT request with bearer token
const token = 'MyBearerToken'
response = await put('https://myapi/texts/1', { body: text, token })
console.log(response.status)

// PATCH request
response = await patch('https://myapi/texts/1', { body: 'Hello', token })

// HEAD request: the headers without the body
response = await head('https://myapi/texts/1')
console.log(response.headers.get('content-length'))

// DELETE request with bearer token and custom headers
const headers = { 'X-Custom-Header': 'value' }
await del('https://myapi/texts/1', { token, headers })
```

The body can also be a stream: a web `ReadableStream`, or in Node.js any async iterable such as a `stream.Readable`. In browsers, Chromium only sends stream bodies over HTTP/2, and Firefox and Safari don't support them.

### URL Search parameters

```javascript
import { get } from '@logi.one/rest-client'

// The requests that follow are all the same
await get('https://myapi/texts', { search: 'page=1&sort=true&filter=noreply%40fake.ch' })
await get('https://myapi/texts', { search: [['page', '1'], ['sort', 'true'], ['filter', 'noreply@fake.ch']]})
await get('https://myapi/texts', { search: new URLSearchParams({ page: '1', sort: 'true', filter: 'noreply@fake.ch' })})
await get('https://myapi/texts', { search: { page: 1, sort: true, filter: 'noreply@fake.ch' }})
await get('https://myapi/texts?page=1&sort=true&filter=noreply%40fake.ch')
```

In an object, `null` and `undefined` values are left out. The parameters are added to those already in the URL, before any `#hash`: `get('https://myapi/texts?page=1', { search: { sort: true } })` requests `https://myapi/texts?page=1&sort=true`.

### Cancellation and timeouts

All functions accept a `timeout` in milliseconds and an [`AbortSignal`](https://developer.mozilla.org/docs/Web/API/AbortSignal). Aborting rejects the request with an `AbortError`, or a `TimeoutError` when the timeout expires. When both are set, whichever comes first aborts the request. A `timeout` of `null` or `Infinity` means no timeout.

The timeout covers the whole request, including reading the response body: for `getJSON` and the other JSON functions, until the body is parsed; for streams, aborting after the response has started destroys the response stream, so a long download is cut off even while data is still arriving.

```javascript
import { getJSON } from '@logi.one/rest-client'

// Give up after 5 seconds
const data = await getJSON('https://myapi/slow', { timeout: 5000 })

// Or cancel it yourself
const controller = new AbortController()
const promise = getJSON('https://myapi/slow', { signal: controller.signal })
controller.abort()

// Both: cancel it yourself, or give up after 5 seconds
await getJSON('https://myapi/slow', { signal: controller.signal, timeout: 5000 })
```

### Retries

With `retry`, a request is sent again after a network error or a 408, 429, 500, 502, 503 or 504 response. It is off by default.

```javascript
import { getJSON } from '@logi.one/rest-client'

// Up to 2 retries
const data = await getJSON('https://myapi/items', { retry: 2 })

// With options
await getJSON('https://myapi/items', {
  retry: {
    limit: 3,                // retries after the first attempt
    methods: ['GET', 'POST'], // default: GET, HEAD, PUT, DELETE
    statusCodes: [503],      // default: 408, 429, 500, 502, 503, 504
    delay: 500,              // first wait in milliseconds, doubled at each retry (default: 300)
    maxDelay: 10000          // longest wait (default: 30000)
  }
})
```

- **Only methods that are safe to send twice** are retried by default: GET, HEAD, PUT and DELETE. A POST or PATCH that timed out may have been processed, so add them to `methods` only if the API handles duplicates.
- **The wait** doubles at each retry, with some randomness so that clients don't all retry at once. A `Retry-After` header (seconds or a date) is used instead when the server sends one. If it asks for longer than `maxDelay`, the request gives up at once.
- **The `timeout` covers all the attempts**, and the waits between them. Aborting the `signal` stops the waits at once.
- **A stream body is never retried**, since it can't be sent twice. `getStream` is retried.
- **After the last attempt**, the request rejects with the last error, as without retries.

### Cookies and credentials (browser)

In a browser, cross-origin requests don't send cookies by default. Set `credentials: 'include'` to send them (the server must answer with `Access-Control-Allow-Credentials: true` and an explicit `Access-Control-Allow-Origin`). It is the fetch [`credentials`](https://developer.mozilla.org/docs/Web/API/RequestInit#credentials) option: `'omit'`, `'same-origin'` (default) or `'include'`.

```javascript
import { getJSON } from '@logi.one/rest-client'

const me = await getJSON('https://api.example.com/me', { credentials: 'include' })
```

In Node.js, fetch has no cookie store, so `credentials` has no effect: set a `Cookie` header yourself.

### RestClient

`RestClient` has the same methods as the functions (`getJSON`, `postJSON`, `putJSON`, `patchJSON`, `deleteJSON`, `get`, `head`, `post`, `put`, `patch`, `del`, and in Node.js `getStream`, `postStream`, `putStream`, `patchStream`) and sends its defaults with every request.

```javascript
import { RestClient } from '@logi.one/rest-client'

const api = new RestClient({
  baseUrl: 'https://myapi/v1',             // prepended to relative URLs
  token: 'MyBearerToken',                  // Authorization: Bearer MyBearerToken
  headers: { 'X-Custom-Header': 'value' },
  timeout: 10000,
  retry: 2,
  credentials: 'include'
})

const address = await api.getJSON('/addresses/1') // GET https://myapi/v1/addresses/1
await api.postJSON('addresses', { body: { name: 'john' } })

// The defaults can be changed at any time
api.token = 'MyNewToken' // e.g. after a login or a token refresh
api.timeout = undefined
api.setHeader('Accept-Language', 'fr')
api.removeHeader('X-Custom-Header')

// Without the defaults, e.g. for a presigned URL that rejects an Authorization header
await api.put(presignedUrl, { body: file, ignoreDefaults: true })
```

- **URLs**: the base URL and a relative URL are joined with exactly one slash, so `https://myapi/v1/` or `https://myapi/v1` with `/items` or `items` all give `https://myapi/v1/items`. `http://…`, `https://…` and `//host/…` URLs are used as is (`//host/…` only works in browsers). Paths are joined as is.
- **Absolute URLs still get the default token and headers.** For a URL that must not get them, such as a presigned storage URL or a link to another API, pass `ignoreDefaults: true`: the request is then sent without any default (base URL, token, headers, timeout, retry, credentials), as with the plain functions.
- **Options of a request win over the defaults**: its `token`, `timeout`, `retry` and `credentials` replace the defaults, and its headers replace the default headers of the same name (ignoring case). A request with its own `Authorization` header doesn't get the default token. `timeout: null` or `Infinity` removes the default timeout, e.g. for a long upload, and `retry: 0` the default retries.

### Renewing an expired token

`onUnauthorized` is called when a request sent with the client token gets a 401 response. Return the new token: it becomes the client token and the request is sent again with it, once. Return `false` to give up: the request then rejects with the 401 `RequestError`, whose body can still be read. If `onUnauthorized` throws, the request rejects with that error.

```javascript
let refreshToken = 'myRefreshToken'
const api = new RestClient({
  baseUrl: 'https://myapi/v1',
  token: accessToken,
  onUnauthorized: async (error, client) => {
    const tokens = await client.postJSON('auth/token', {
      body: { grant_type: 'refresh_token', refresh_token: refreshToken },
      token: '' // don't send the expired access token
    })
    refreshToken = tokens.refresh_token
    return tokens.access_token
  }
})
```

- **Send the renewal requests with the `client` argument**, not with `api`. It is a copy of the client defaults without `onUnauthorized`, so a 401 there rejects at once. A request through `api` with the expired token would wait for the renewal it is part of, forever. Changes made on `client` (its token or headers) aren't applied to `api`: the returned token is the only result.
- **One renewal per token.** Every request sent with the token being renewed waits for the same call, including requests started during the renewal, so a rotating refresh token is only used once. A request that gets a 401 after the token already changed is sent again without calling `onUnauthorized`.
- **A token that couldn't be renewed isn't renewed again.** After `onUnauthorized` returns `false`, the later 401s of that token reject without calling it, so it can prompt for a new login only once. Setting a new `api.token` (after the login) enables it again. A thrown error isn't remembered: the next 401 calls `onUnauthorized` again.
- **Not called** when the client has no token, for requests with their own `token` or `Authorization` header, with `ignoreDefaults`, or with a stream body (`postStream`, `putStream`, `patchStream`, or `post`, `put`, `patch` with a stream), since a stream can't be sent twice. `getStream` is retried.

### Error handling

A request rejects with:

- **`RequestError`** when the response status is not 2xx, with `status`, `headers` and the `response`.
- **`SchemaValidationError`** when the response doesn't match the `schema`.
- **The abort reason** when the `signal` aborts: an `AbortError` by default, or the reason given to `abort(reason)`. A `TimeoutError` when the `timeout` expires.
- **A network error** when the server can't be reached: fetch's `TypeError: fetch failed` with the reason in `error.cause`, and for the stream functions that reason itself, such as an error with `code: 'ECONNREFUSED'`.
- **A `RangeError`** for an invalid `timeout`, before anything is sent.

```javascript
import { getJSON, getStream } from '@logi.one/rest-client'

try {
  await getJSON('https://api.github.com/repos/logione/rest-client-fake')
} catch (error) { // throws an error if the request fails or the response status is not 2xx
  if (error.status) {
    console.log(error.response) // error.response is the original fetch Response object
    console.log(error.headers) // error.headers === error.response.headers
    console.log(error.status) // error.status === error.response.status
    console.log(error.message) // error.message === error.response.statusText
  } else {
    console.log(error.message)
  }
}

try {
  await getStream('https://my-source-api/files/1')
} catch (error) { // throws an error if the request fails or the response status is not 2xx
  if (error.status) {
    console.log(error.response) // error.response is a StreamResponse, readable as a stream
    console.log(error.headers) // error.headers is a fetch Headers object
    console.log(error.status) // error.status === error.response.statusCode
    console.log(error.message) // error.message === error.response.statusMessage
  } else {
    console.log(error.message)
  }
}
```
