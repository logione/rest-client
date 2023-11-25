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

    beforeAll(() => {
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
        server.listen(5001)
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
})