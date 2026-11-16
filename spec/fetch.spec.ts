import { createServer, IncomingMessage, Server } from 'http'
import { Readable } from 'stream'

import { del, get, post, put } from '../fetch'
import { RequestError } from '../request-error'

describe('fetch specs', () => {
    let server: Server
    let status: number
    let lastRequest: IncomingMessage | undefined
    let lastRequestBody: unknown
    let responseBody: string

    beforeAll(async () => {
        server = createServer(async (req, res) => {
            lastRequest = req
            let body = ''
            req.on('data', (data) => {
                body += data
            })
            req.on('end', async () => {
                lastRequestBody = body
                if (req.url === '/testslow') {
                    await new Promise((resolve) => setTimeout(resolve, 500))
                }
                res.writeHead(status)
                if (responseBody) {
                    res.write(responseBody)
                    res.end()
                } else {
                    res.end()
                }
            })
        })
        await new Promise<void>((resolve) => {
            server.listen(5001, undefined, resolve)
        })
        await new Promise<void>((resolve) => setTimeout(resolve, 100))
    })

    beforeEach(() => {
        status = 204
        responseBody = ''
        lastRequestBody = undefined
    })

    afterAll(() => {
        return new Promise<void>((resolve) => {
            server.close(() => { resolve() })
        })
    })

    it('should not modify the caller headers nor leak the token to later requests', async () => {
        const headers = { 'custom-header': 'OK' }
        await get('http://localhost:5001/testget', { headers, token: 'fakeToken' })
        expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
        expect(headers).toEqual({ 'custom-header': 'OK' })

        await get('http://localhost:5001/testget', { headers })
        expect(lastRequest!.headers.authorization).toBeUndefined()
    })

    it('should not duplicate headers given in another case', async () => {
        await get('http://localhost:5001/testget', {
            headers: { 'user-agent': 'my-agent', 'authorization': 'Basic old' },
            token: 'fakeToken'
        })
        expect(lastRequest!.headers['user-agent']).toBe('my-agent')
        expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
    })

    describe('POST', () => {
        it('should post data and parse json', async () => {
            status = 200
            responseBody = 'DataUpdated'
            const result = await post(
                'http://localhost:5001/testpost', { 
                    body: 'Data',
                    token: 'fakeToken',
                    headers: { 'custom-header': 'OK' },
                    search: { limit: 1, sort: 'name' }
                }
            )
            expect(lastRequestBody).toEqual('Data')
            expect(await result.text()).toEqual('DataUpdated')
            expect(lastRequest!.url).toBe('/testpost?limit=1&sort=name')
            expect(lastRequest!.method).toBe('POST')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('text/plain;charset=UTF-8')
            expect(lastRequest!.headers['accept']).toBe('*/*')
            expect(lastRequest!.headers['content-length']).toBe('4')
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await post('http://localhost:5001/testpost', { body: 'Data' })
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await post('http://localhost:5001/testpost', { body: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)

            status = 500
            try {
                await post('http://localhost:5001/testpost', { body: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(500)
        })
          
        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            try {
                await post('http://localhost:5001/testpost', { body: 'Data' })
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
        })

        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await post('http://localhost:65012/testget', { body: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })

    describe('PUT', () => {
        it('should put data and parse json', async () => {
            status = 200
            responseBody = 'DataUpdated'
            const result = await put('http://localhost:5001/testput', { body: 'Data', token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(lastRequestBody).toEqual('Data')
            expect(await result.text()).toEqual('DataUpdated')
            expect(lastRequest!.url).toBe('/testput')
            expect(lastRequest!.method).toBe('PUT')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('text/plain;charset=UTF-8')
            expect(lastRequest!.headers['accept']).toBe('*/*')
            expect(lastRequest!.headers['content-length']).toBe('4')
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await put('http://localhost:5001/testput', { body: 'Data' })
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await put('http://localhost:5001/testput', { body: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)
        })
                  
        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            try {
                await put('http://localhost:5001/testput', { body: 'Data' })
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
        })

        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await put('http://localhost:65012/testget', { body: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })

    describe('GET', () => {
        it('should get data and parse json', async () => {
            status = 200
            responseBody = 'DataUpdated'
            const result = await get('http://localhost:5001/testget', { token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(await result.text()).toEqual('DataUpdated')
            expect(lastRequest!.url).toBe('/testget')
            expect(lastRequest!.method).toBe('GET')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBe('*/*')
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await get('http://localhost:5001/testget')
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await get('http://localhost:5001/testget')
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)
        })
                          
        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            try {
                await get('http://localhost:5001/testget')
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
        })
        
        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await get('http://localhost:65012/testget')
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })

    describe('DELETE', () => {
        it('should delete data and parse json', async () => {
            status = 200
            responseBody = 'DataUpdated'
            const result = await del('http://localhost:5001/testdelete', { token: 'fakeToken', headers: { 'custom-header': 'OK' } })
            expect(await result.text()).toEqual('DataUpdated')
            expect(lastRequest!.url).toBe('/testdelete')
            expect(lastRequest!.method).toBe('DELETE')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBe('*/*')
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['custom-header']).toBe('OK')
    
            await del('http://localhost:5001/testdelete')
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await del('http://localhost:5001/testdelete')
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)
        })
                                  
        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            try {
                await del('http://localhost:5001/testdelete')
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
        })
        
        it('should throw an error if cannot connect to server', async () => {
            let error: any
            try {
                await del('http://localhost:65012/testget')
            } catch (err) {
                error = err
            }
            expect(error.message).toBe('fetch failed')
        })
    })

    it('should send headers given as a Headers instance or as entries without modifying them', async () => {
        const instance = new Headers({ 'x-custom': 'instance' })
        await get('http://localhost:5001/testget', { headers: instance, token: 'fakeToken' })
        expect(lastRequest!.headers['x-custom']).toBe('instance')
        expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
        expect([...instance.keys()]).toEqual(['x-custom'])

        const entries: [string, string][] = [['x-custom', 'a'], ['X-Custom', 'b']]
        await get('http://localhost:5001/testget', { headers: entries })
        expect(lastRequest!.headers['x-custom']).toBe('a, b')
    })

    it('should send a web ReadableStream or a Node.js Readable as body', async () => {
        const webStream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('web '))
                controller.enqueue(new TextEncoder().encode('stream'))
                controller.close()
            }
        })
        await post('http://localhost:5001/testpost', { body: webStream })
        expect(lastRequestBody).toBe('web stream')

        await put('http://localhost:5001/testput', { body: Readable.from([Buffer.from('node '), Buffer.from('stream')]) })
        expect(lastRequestBody).toBe('node stream')
    })

    describe('signal', () => {
        it('should reject with an AbortError and not send the request when the signal is already aborted', async () => {
            lastRequest = undefined
            let error: any
            try {
                await get('http://localhost:5001/testabort', { signal: AbortSignal.abort() })
            } catch (err) {
                error = err
            }
            expect(error?.name).toBe('AbortError')
            expect(lastRequest).toBeUndefined()
        })

        it('should complete normally when the signal is not aborted', async () => {
            status = 200
            responseBody = 'ok'
            const response = await get('http://localhost:5001/testabort', { signal: new AbortController().signal })
            expect(await response.text()).toBe('ok')
        })
    })

    describe('timeout', () => {
        it('should reject with a TimeoutError when the timeout expires', async () => {
            try {
                await get('http://localhost:5001/testslow', { timeout: 50 })
                fail('should have timed out')
            } catch (err: any) {
                expect(err.name).toBe('TimeoutError')
            }
        })

        it('should complete normally within the timeout', async () => {
            status = 200
            responseBody = 'ok'
            const response = await get('http://localhost:5001/testget', { timeout: 5000 })
            expect(await response.text()).toBe('ok')
        })

        it('should abort with the signal when it fires before the timeout', async () => {
            const reason = new Error('custom reason')
            const controller = new AbortController()
            const promise = get('http://localhost:5001/testslow', { signal: controller.signal, timeout: 5000 })
            controller.abort(reason)
            await expectAsync(promise).toBeRejectedWith(reason)
        })

        it('should time out when a signal is also set but not aborted', async () => {
            try {
                await get('http://localhost:5001/testslow', { signal: new AbortController().signal, timeout: 50 })
                fail('should have timed out')
            } catch (err: any) {
                expect(err.name).toBe('TimeoutError')
            }
        })

        it('should reject an invalid timeout without sending the request', async () => {
            lastRequest = undefined
            for (const timeout of [-1, -Infinity, NaN, '100' as any]) {
                await expectAsync(get('http://localhost:5001/testget', { timeout })).withContext(String(timeout)).toBeRejectedWithError(RangeError)
            }
            expect(lastRequest).toBeUndefined()
        })
    })
})
