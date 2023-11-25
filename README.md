# Rest Client by LogiONE

This is a free, ultra-lightweight and easy to use rest client for node.js supporting JSON requests and streams with no external dependencies.

It uses the native node.js http and https modules and fetch to provide a simple interface for making http(s) requests.

## Installation

```bash
npm install @logi.one/rest-client
```

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

### Stream requests

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
response = await put('https://myapi/texts/1', { body: text, token })
console.log(response.status)

// DELETE request with bearer token and custom headers
const headers = { 'X-Custom-Header': 'value' }
await del('https://myapi/texts/1', { token, headers })
```

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
    console.log(error.headers) // error.headers is formated has an Headers object
    console.log(error.status) // error.status === error.response.statusCode
    console.log(error.message) // error.message === error.response.statusMessage
  } else {
    console.log(error.message)
  }
}
```