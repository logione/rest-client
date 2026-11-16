import { createServer, IncomingMessage, Server } from 'http'
import { Readable, Stream } from 'stream'

import { getStream, postStream, putStream } from '../fetch-stream'
import { RequestError } from '../request-error'

describe('fetch-stream specs', () => {
    let server: Server
    let status: number
    let lastRequest: IncomingMessage | undefined
    let lastRequestBody: unknown
    let responseBody: Stream | undefined
    const streamToString = (stream: Readable) => {
        const chunks: Buffer[] = [];
        return new Promise((resolve, reject) => {
          stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
          stream.on('error', (err) => reject(err))
          stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        })
    }

    beforeAll(async () => {
        server = createServer(async (req, res) => {
            lastRequest = req
            let body = ''
            req.on('data', (data) => {
                body += data
            })
            req.on('end', () => {
                lastRequestBody = body
                res.writeHead(status)
                if (responseBody) {
                    responseBody.pipe(res)
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
        responseBody = undefined
        lastRequest = undefined
        lastRequestBody = undefined
    })

    afterAll(() => {
        return new Promise<void>((resolve) => {
            server.close(() => { resolve() })
        })
    })

    it('should not modify the caller headers nor leak the token to later requests', async () => {
        status = 200
        const headers = { 'custom-header': 'OK' }
        await streamToString(await getStream('http://localhost:5001/testgetstream', { headers, token: 'fakeToken' }))
        expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
        expect(headers).toEqual({ 'custom-header': 'OK' })

        await streamToString(await getStream('http://localhost:5001/testgetstream', { headers }))
        expect(lastRequest!.headers.authorization).toBeUndefined()
    })

    it('should not override or duplicate headers given in another case', async () => {
        status = 200
        await streamToString(await getStream('http://localhost:5001/testgetstream', {
            headers: { 'user-agent': 'my-agent', 'authorization': 'Basic old' },
            token: 'fakeToken'
        }))
        expect(lastRequest!.headers['user-agent']).toBe('my-agent')
        expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
    })

    it('should support IPv6 hosts', async () => {
        status = 200
        const response = new Readable()
        response.push('beep')
        response.push(null)
        responseBody = response

        const result = await streamToString(await getStream('http://[::1]:5001/testgetstream'))
        expect(result).toEqual('beep')
    })

    describe('GET', () => {
        it('should get stream', async () => {
            status = 200

            let response = new Readable()
            response.push('beep') 
            response.push(null)
            responseBody = response

            const result = await streamToString(
                await getStream('http://localhost:5001/testgetstream?page=3&',
                { token: 'fakeToken', search: 'limit=1' })
            )
            expect(result).toEqual('beep')
            expect(lastRequest!.url).toBe('/testgetstream?page=3&limit=1')
            expect(lastRequest!.method).toBe('GET')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBeUndefined()
            expect(lastRequest!.headers['content-length']).toBeUndefined()
    
            await streamToString(await getStream('http://localhost:5001/testgetstream'))
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw error if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await streamToString(await getStream('http://localhost:5001/testget'))
            } catch (err) {
                error = err
            }
            expect(error?.status).toBe(300)
        })
                  
        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            try {
                await streamToString(await getStream('http://localhost:5001/testget'))
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
        })
        
        it('should throw error if cannot connect to server', async () => {
            let error: any
            try {
                await getStream('http://localhost:65012/testputsttream')
            } catch (err) {
                error = err
            }
            expect(error.errno).toBe(-111)
        })
    })

    describe('POST', () => {
        it('should post stream', async () => {
            status = 200

            let stream = new Readable()
            stream.push('beep') 
            stream.push(null)

            await postStream(
                'http://localhost:5001/testpoststream',
                stream, {
                    token: 'fakeToken',
                    headers: { 'fake-header': 'fake' },
                    search: { asc: true, sort: 'test' }
            })
            expect(lastRequest!.url).toBe('/testpoststream?asc=true&sort=test')
            expect(lastRequest!.method).toBe('POST')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBeUndefined()
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['fake-header']).toBe('fake')
            expect(lastRequestBody).toBe('beep')

            stream = new Readable()
            stream.push('beep') 
            stream.push(null)

            await postStream('http://localhost:5001/testpoststream', stream)
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw error if bigger than 299', async () => {
            status = 300
            let error: any
            const stream = new Readable()
            stream.push('beep') 
            stream.push(null)
            try {
                await postStream('http://localhost:5001/testpoststream', stream)
            } catch (err) {
                error = err
            }
            expect(error.status).toBe(300)
        })
            
        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            const stream = new Readable()
            stream.push('beep') 
            stream.push(null)
            try {
                await postStream('http://localhost:5001/testpoststream', stream)
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
        })

        it('should throw error if cannot connect to server', async () => {
            status = 300
            let error: any
            const stream = new Readable()
            stream.push('beep') 
            stream.push(null)
            try {
                await postStream('http://localhost:65012/testputsttream', stream)
            } catch (err) {
                error = err
            }
            expect(error.errno).toBe(-111)
        })

        describe('when the upload fails', () => {
            let earlyServer: Server
            let unhandled: unknown[]
            const onUnhandled = (reason: unknown) => { unhandled.push(reason) }
            const bigStream = () => Readable.from((function* () {
                for (let i = 0; i < 2000; i++) {
                    yield Buffer.alloc(64 * 1024)
                }
            })())

            beforeAll(async () => {
                // Rejects without reading the request body, then drops the connection.
                earlyServer = createServer((req, res) => {
                    res.writeHead(413, { connection: 'close' })
                    res.end()
                    setTimeout(() => req.socket.destroy(), 20)
                })
                await new Promise<void>((resolve) => earlyServer.listen(5002, undefined, resolve))
            })

            afterAll(() => new Promise<void>((resolve) => earlyServer.close(() => resolve())))

            beforeEach(() => {
                unhandled = []
                process.on('unhandledRejection', onUnhandled)
            })

            afterEach(() => {
                process.off('unhandledRejection', onUnhandled)
            })

            it('should throw the HTTP error when the server rejects before reading the body', async () => {
                let error: any
                try {
                    await postStream('http://localhost:5002/toobig', bigStream())
                } catch (err) {
                    error = err
                }
                await new Promise((resolve) => setTimeout(resolve, 50))
                expect(error instanceof RequestError).toBeTrue()
                expect(error?.status).toBe(413)
                expect(unhandled).toEqual([])
            })

            it('should throw the source stream error', async () => {
                status = 200
                const stream = new Readable({ read() {} })
                stream.push('beep')
                setTimeout(() => stream.destroy(new Error('source failed')), 20)
                let error: any
                try {
                    await postStream('http://localhost:5001/testpoststream', stream)
                } catch (err) {
                    error = err
                }
                await new Promise((resolve) => setTimeout(resolve, 50))
                expect(error?.message).toBe('source failed')
                expect(unhandled).toEqual([])
            })
        })
    })

    describe('PUT', () => {
        it('should put stream', async () => {
            status = 200

            let stream = new Readable()
            stream.push('beep') 
            stream.push(null)

            await putStream('http://localhost:5001/testputstream', stream, { token: 'fakeToken', headers: { 'fake-header': 'fake' }})
            expect(lastRequest!.url).toBe('/testputstream')
            expect(lastRequest!.method).toBe('PUT')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBeUndefined()
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['fake-header']).toBe('fake')
            expect(lastRequestBody).toBe('beep')

            stream = new Readable()
            stream.push('beep') 
            stream.push(null)
    
            await putStream('http://localhost:5001/testputstream', stream)
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw error if bigger than 299', async () => {
            status = 300
            let error: any
            const stream = new Readable()
            stream.push('beep') 
            stream.push(null)
            try {
                await putStream('http://localhost:5001/testputsttream', stream)
            } catch (err) {
                error = err
            }
            expect(error.status).toBe(300)
        })
        
        it('should set headers on error', async () => {
            status = 300
            let error: RequestError | undefined
            const stream = new Readable()
            stream.push('beep') 
            stream.push(null)
            try {
                await putStream('http://localhost:5001/testputsttream', stream)
            } catch (err: any) {
                error = err
            }
            expect(error?.headers instanceof Headers).toBeTrue()
            expect(error?.headers.get('transfer-encoding')).toEqual('chunked')
        })

        it('should throw error if cannot connect to server', async () => {
            status = 300
            let error: any
            const stream = new Readable()
            stream.push('beep') 
            stream.push(null)
            try {
                await putStream('http://localhost:65012/testputsttream', stream)
            } catch (err) {
                error = err
            }
            expect(error.errno).toBe(-111)
        })
    })

    describe('signal', () => {
        it('should reject with an AbortError when the signal is already aborted', async () => {
            let error: any
            try {
                await getStream('http://localhost:5001/testabort', { signal: AbortSignal.abort() })
            } catch (err) {
                error = err
            }
            expect(error?.name).toBe('AbortError')
        })

        it('should destroy the response stream when aborted after the response started', async () => {
            status = 200
            const endless = new Readable({ read() {} })
            endless.push('beep')
            responseBody = endless

            const controller = new AbortController()
            const stream = await getStream('http://localhost:5001/testabort', { signal: controller.signal })
            const result = streamToString(stream)
            controller.abort()
            await expectAsync(result).toBeRejected()
            expect(stream.destroyed).toBeTrue()
            endless.destroy()
        })

        it('should abort an upload in progress', async () => {
            const endless = new Readable({ read() {} })
            endless.push('beep')
            const controller = new AbortController()
            setTimeout(() => controller.abort(), 50)
            let error: any
            try {
                await postStream('http://localhost:5001/testabort', endless, { signal: controller.signal })
            } catch (err) {
                error = err
            }
            expect(error?.name).toBe('AbortError')
            expect(endless.destroyed).toBeTrue()
        })

        it('should reject an upload with an AbortError and not send it when the signal is already aborted', async () => {
            for (const upload of [postStream, putStream]) {
                lastRequest = undefined
                const stream = Readable.from(['beep'])
                let error: any
                try {
                    await upload('http://localhost:5001/testabort', stream, { signal: AbortSignal.abort() })
                } catch (err) {
                    error = err
                }
                expect(error?.name).withContext(upload.name).toBe('AbortError')
                expect(lastRequest).withContext(upload.name).toBeUndefined()
            }
        })

        it('should reject with the signal reason, a TimeoutError for AbortSignal.timeout()', async () => {
            const endless = new Readable({ read() {} })
            endless.push('beep')
            let error: any
            try {
                await postStream('http://localhost:5001/testabort', endless, { signal: AbortSignal.timeout(50) })
            } catch (err) {
                error = err
            }
            expect(error?.name).toBe('TimeoutError')

            const reason = new Error('custom reason')
            const controller = new AbortController()
            controller.abort(reason)
            await expectAsync(getStream('http://localhost:5001/testabort', { signal: controller.signal })).toBeRejectedWith(reason)
        })
    })

    it('should send headers given as a Headers instance or as entries', async () => {
        status = 200
        await getStream('http://localhost:5001/testheaders', { headers: new Headers({ 'x-custom': 'instance' }) })
        expect(lastRequest!.headers['x-custom']).toBe('instance')
        await postStream('http://localhost:5001/testheaders', Readable.from(['beep']), { headers: [['x-custom', 'entries']] })
        expect(lastRequest!.headers['x-custom']).toBe('entries')
    })
})
