import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import { readFile } from 'fs/promises'
import { join, normalize } from 'path'
import { Browser, BrowserType, chromium, firefox, Page } from 'playwright'

// Runs the browser build (compiled to dist/browser-test by `npm test`) in headless Chromium and Firefox.
// Both matter: e.g. Chromium silently drops a User-Agent header set on fetch, while Firefox sends it and preflights.
// The page and the API are served on different ports, so every request is a real cross-origin (CORS) request.
const PAGE_ORIGIN = 'http://localhost:5011'
const API_ORIGIN = 'http://localhost:5012'
const LIB_DIR = join(__dirname, '..', 'browser-test')

interface ReceivedRequest {
    method: string
    url: string
    headers: IncomingMessage['headers']
    body: string
}

for (const browserType of [chromium, firefox]) {
    describeBrowser(browserType)
}

function describeBrowser(browserType: BrowserType) {
    describe(`browser specs (${browserType.name()})`, () => {
        let pageServer: Server
        let apiServer: Server
        let browser: Browser
        let page: Page
        let received: ReceivedRequest[]

        const listen = (server: Server, port: number) => new Promise<void>((resolve) => server.listen(port, 'localhost', resolve))
        const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()))

        beforeAll(async () => {
            pageServer = createServer(async (req, res) => {
                if (req.url === '/') {
                    res.setHeader('Content-Type', 'text/html')
                    res.end(`<!doctype html><script type="module">
                        import * as lib from '/lib/browser.js'
                        window.lib = lib
                    </script>`)
                    return
                }
                const file = normalize(join(LIB_DIR, (req.url ?? '').replace(/^\/lib\//, '')))
                if (!req.url?.startsWith('/lib/') || !file.startsWith(LIB_DIR)) {
                    res.writeHead(404).end()
                    return
                }
                try {
                    res.setHeader('Content-Type', 'text/javascript')
                    res.end(await readFile(file))
                } catch {
                    res.writeHead(404).end()
                }
            })
            apiServer = createServer((req, res) => {
                let body = ''
                req.on('data', (data) => body += data)
                req.on('end', () => {
                    received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body })
                    handleApi(req, res, body)
                })
            })
            await Promise.all([listen(pageServer, 5011), listen(apiServer, 5012)])

            try {
                browser = await browserType.launch()
            } catch (err) {
                throw new Error(`Cannot launch ${browserType.name()}, run "npx playwright install chromium firefox" first.\n${err}`)
            }
            page = await browser.newPage()
            await page.goto(PAGE_ORIGIN)
            await page.waitForFunction(() => 'lib' in window)
        }, 30000)

        afterAll(async () => {
            await browser?.close()
            await Promise.all([close(pageServer), close(apiServer)])
        })

        beforeEach(() => {
            received = []
        })

        function handleApi(req: IncomingMessage, res: ServerResponse, body: string) {
            // Echo the origin (not "*") so that credentialed requests are allowed too.
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
            res.setHeader('Access-Control-Allow-Credentials', 'true')
            if (req.method === 'OPTIONS') {
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
                res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
                res.writeHead(204).end()
                return
            }
            const path = (req.url ?? '').split('?')[0]
            if (path === '/missing') {
                res.writeHead(404, 'Not Found').end()
            } else if (path === '/slow') {
                setTimeout(() => res.end('late'), 2000)
            } else if (path === '/text') {
                res.setHeader('Content-Type', 'text/plain')
                res.end('hello stream')
            } else {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ path, query: (req.url ?? '').split('?')[1] ?? null, body: body || null, cookie: req.headers.cookie ?? null }))
            }
        }

        const apiRequests = () => received.filter((r) => r.method !== 'OPTIONS')
        const preflights = () => received.filter((r) => r.method === 'OPTIONS')

        it('should not export the Node.js stream functions', async () => {
            const exported = await page.evaluate(() => Object.keys((window as any).lib).sort())
            expect(exported).toEqual(['RequestError', 'SchemaValidationError', 'del', 'deleteJSON', 'get', 'getJSON', 'post', 'postJSON', 'put', 'putJSON'])
        })

        it('should getJSON cross-origin without a CORS preflight nor a "node" user agent', async () => {
            const result = await page.evaluate((api) => (window as any).lib.getJSON(`${api}/items`, { search: { page: 2, skip: undefined } }), API_ORIGIN)
            expect(result).toEqual({ path: '/items', query: 'page=2', body: null, cookie: null })
            expect(preflights()).toEqual([])
            expect(apiRequests()[0].headers['user-agent']).not.toBe('node')
            expect(apiRequests()[0].headers.accept).toBe('application/json')
        })

        it('should postJSON with a token after the CORS preflight', async () => {
            const result = await page.evaluate((api) => (window as any).lib.postJSON(`${api}/items`, { body: { name: 'john' }, token: 'fakeToken' }), API_ORIGIN)
            expect(result.body).toBe('{"name":"john"}')
            expect(preflights().length).toBe(1)
            const [post] = apiRequests()
            expect(post.method).toBe('POST')
            expect(post.headers.authorization).toBe('Bearer fakeToken')
            expect(post.headers['content-type']).toBe('application/json')
        })

        it('should throw a RequestError holding the fetch Response', async () => {
            const error = await page.evaluate(async (api) => {
                const { getJSON, RequestError } = (window as any).lib
                try {
                    await getJSON(`${api}/missing`)
                    return null
                } catch (err: any) {
                    return { isRequestError: err instanceof RequestError, name: err.name, status: err.status, message: err.message, hasResponse: err.response instanceof Response }
                }
            }, API_ORIGIN)
            expect(error).toEqual({ isRequestError: true, name: 'RequestError', status: 404, message: 'Not Found', hasResponse: true })
        })

        it('should validate the response with a standard schema', async () => {
            const error = await page.evaluate(async (api) => {
                const { getJSON, SchemaValidationError } = (window as any).lib
                const schema = {
                    '~standard': {
                        version: 1,
                        vendor: 'test',
                        validate: (value: any) => typeof value?.id === 'number' ? { value } : { issues: [{ message: 'id must be a number' }] }
                    }
                }
                try {
                    await getJSON(`${api}/items`, { schema })
                    return null
                } catch (err: any) {
                    return { isSchemaError: err instanceof SchemaValidationError, issues: err.issues }
                }
            }, API_ORIGIN)
            expect(error).toEqual({ isSchemaError: true, issues: [{ message: 'id must be a number' }] })
        })

        it('should give access to the response body as a web ReadableStream', async () => {
            const text = await page.evaluate(async (api) => {
                const response: Response = await (window as any).lib.get(`${api}/text`)
                const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
                let result = ''
                for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
                    result += chunk.value
                }
                return result
            }, API_ORIGIN)
            expect(text).toBe('hello stream')
        })

        it('should abort a request with a signal', async () => {
            const name = await page.evaluate(async (api) => {
                try {
                    await (window as any).lib.get(`${api}/slow`, { signal: AbortSignal.timeout(50) })
                    return null
                } catch (err: any) {
                    return err.name
                }
            }, API_ORIGIN)
            expect(name).toBe('TimeoutError')
        })

        it('should send cookies cross-origin only with credentials "include"', async () => {
            await page.context().addCookies([{ name: 'session', value: 'abc', domain: 'localhost', path: '/', sameSite: 'Lax' }])
            const [withoutCredentials, withCredentials] = await page.evaluate(async (api) => {
                const { getJSON } = (window as any).lib
                return [
                    await getJSON(`${api}/items`),
                    await getJSON(`${api}/items`, { credentials: 'include' })
                ]
            }, API_ORIGIN)
            expect(withoutCredentials.cookie).toBeNull()
            expect(withCredentials.cookie).toBe('session=abc')
        })
    })
}
