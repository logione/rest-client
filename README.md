# Rest Client by LogiONE

This is a free, ultra-lightweight and easy-to-use http(s) client for Node.js and browsers supporting JSON requests and streams with no external dependencies.

It uses fetch to provide a simple interface for making http(s) requests, and the native Node.js http and https modules for streams.

**New: it supports [Standard Schema](https://standardschema.dev) validation. So, you can validate the data received from any API with your preferred library ([list of supported libraries](https://github.com/standard-schema/standard-schema/blob/main/packages/spec/README.md#what-schema-libraries-implement-the-spec)).**

## Installation

```bash
npm install @logi.one/rest-client
```

With TypeScript in a Node.js project, the type definitions also need the Node.js types (`npm install --save-dev @types/node`), which most Node.js projects already have. Browser projects don't need them.

## Browser support

The same import works in browsers: bundlers (Vite, webpack, esbuild, Rollup…) pick the browser build automatically through the `browser` export condition.

```javascript
import { getJSON } from '@logi.one/rest-client' // resolves to the browser build in a browser bundle
```

The browser build is plain ES modules, so it can also be loaded without a bundler (from `dist/esm/browser.js`). Tools that `require()` the package with the `browser` condition, such as Jest with the jsdom environment, get a CommonJS copy of the same browser build.

Differences from Node.js:

- **Stream functions (`getStream`, `postStream`, `putStream`) are Node.js only** and are not exported by the browser build. In a browser, use `get` and read `response.body`, which is a web `ReadableStream`.
- **No default `User-Agent` header.** In Node.js, requests send `User-Agent: node` unless you set one. Browsers set their own.
- **CORS applies.** Cross-origin requests need the server to allow them. JSON requests with a body (`postJSON`, `putJSON`) send `Content-Type: application/json`, and `token` adds an `Authorization` header: both trigger a CORS preflight (`OPTIONS`) request, so the server must allow these headers.

## Usage

### JSON requests

```javascript
import { getJSON, postJSON, putJSON, deleteJSON } from '@logi.one/rest-client'

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

// DELETE request with bearer token and custom headers
const headers = { 'X-Custom-Header': 'value' }
response = await deleteJSON('https://myapi/addresses/1', { token, headers })
console.log(response.message)
```

In every function, `headers` can be a plain object, a `Headers` instance or an array of `[name, value]` pairs.

Notes on JSON requests:

- **Body**: objects and other values are serialized with `JSON.stringify`, and `Content-Type: application/json` is added. A string is sent as is (already serialized JSON), so an empty string sends no body. `null`, `false` and `0` are sent as JSON with `postJSON` and `putJSON`, and ignored with `getJSON` and `deleteJSON`.
- **Content type**: `Accept` and `Content-Type` default to `application/json`. A JSON media type you set yourself is kept, such as `Content-Type: application/merge-patch+json` or `Accept: application/vnd.api+json`.
- **Response**: JSON content types (`application/json` and `+json` types such as `application/problem+json`) are parsed. Other content types are returned as text.

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

### Stream requests (Node.js only)

```javascript
import { getStream, postStream, putStream } from '@logi.one/rest-client'
import { createReadStream } from 'fs'

// GET stream
const token = 'MyBearerToken'
const stream = await getStream('https://my-source-api/files/1', { token }) // stream is an http IncomingMessage object

// POST stream
const headers = { 'X-Custom-Header': 'value' }
await postStream('https://myapi/files', stream, { headers })

// PUT stream
const readStream = createReadStream('file.txt')
await putStream('https://myapi/files/1', readStream)
```

### HTTP requests

```javascript
import { get, post, put, del } from '@logi.one/rest-client'

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
await get('https://myapi/texts?page=1&limit=2&filter=noreply%40fake.ch')
```

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

### Cookies and credentials (browser)

In a browser, cross-origin requests don't send cookies by default. Set `credentials: 'include'` to send them (the server must answer with `Access-Control-Allow-Credentials: true` and an explicit `Access-Control-Allow-Origin`). It is the fetch [`credentials`](https://developer.mozilla.org/docs/Web/API/RequestInit#credentials) option: `'omit'`, `'same-origin'` (default) or `'include'`.

```javascript
import { getJSON } from '@logi.one/rest-client'

const me = await getJSON('https://api.example.com/me', { credentials: 'include' })
```

### Client with defaults

`RestClient` has the same methods as the functions (`getJSON`, `postJSON`, `putJSON`, `deleteJSON`, `get`, `post`, `put`, `del`, and in Node.js `getStream`, `postStream`, `putStream`) and sends its defaults with every request.

```javascript
import { RestClient } from '@logi.one/rest-client'

const api = new RestClient({
  baseUrl: 'https://myapi/v1',             // prepended to relative URLs
  token: 'MyBearerToken',                  // Authorization: Bearer MyBearerToken
  headers: { 'X-Custom-Header': 'value' },
  timeout: 10000,
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
- **Absolute URLs still get the default token and headers.** For a URL that must not get them, such as a presigned storage URL or a link to another API, pass `ignoreDefaults: true`: the request is then sent without any default (base URL, token, headers, timeout, credentials), as with the plain functions.
- **Options of a request win over the defaults**: its `token`, `timeout` and `credentials` replace the defaults, and its headers replace the default headers of the same name (ignoring case). A request with its own `Authorization` header doesn't get the default token. `timeout: null` or `Infinity` removes the default timeout, e.g. for a long upload.

### Error handling

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
    console.log(error.response) // error.response is the original http IncomingMessage object
    console.log(error.headers) // error.headers is formatted as a Headers object
    console.log(error.status) // error.status === error.response.statusCode
    console.log(error.message) // error.message === error.response.statusMessage
  } else {
    console.log(error.message)
  }
}
```