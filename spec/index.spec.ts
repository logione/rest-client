import { createServer, IncomingMessage, Server } from 'http'
import { Readable, Stream } from 'stream'

import { get, post, put, del, getStream, postStream, putStream } from '../index'

describe('rest-client specs', () => {
    let server: Server
    let status: number
    let lastRequest: IncomingMessage | undefined
    let lastRequestBody: unknown
    let responseBody: string | Stream = ''
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
                if (typeof body === 'string') {
                    try {
                        lastRequestBody = JSON.parse(body)
                    } catch (err) {
                        lastRequestBody = body
                    }
                }
                if (typeof responseBody === 'string') {
                    try {
                        JSON.parse(responseBody)
                        res.setHeader('Content-Type', 'application/json; charset=utf-8')
                    } catch (err) {
                    }
                }
                res.writeHead(status)
                if (responseBody) {
                    if (typeof responseBody === 'string') {
                        res.write(responseBody)
                        res.end()
                    } else {
                        responseBody.pipe(res)
                    }
                } else {
                    res.end()
                }
            })
        })
        server.listen(5001)
    })

    beforeEach(() => {
        status = 204
        responseBody = ''
        lastRequest = undefined
        lastRequestBody = undefined
    })

    afterAll(() => {
        server.close()
    })

    describe('POST', () => {
        it('should post data and parse json', async () => {
            status = 200
            responseBody = JSON.stringify({ fake: 'DataUpdated' })
            const result = await post<{ fake: string }>('http://localhost:5001/testpost', { fake: 'Data' }, 'fakeToken')
            expect(lastRequestBody).toEqual({ fake: 'Data'})
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testpost')
            expect(lastRequest!.method).toBe('POST')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('application/json')
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBe('15')
    
            await post<{ fake: string }>('http://localhost:5001/testpost', { fake: 'Data' })
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await post<{ fake: string }>('http://localhost:5001/testpost', { fake: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error).toBe(300)

            status = 500
            try {
                await post<{ fake: string }>('http://localhost:5001/testpost', { fake: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error).toBe(500)
        })
    })

    describe('PUT', () => {
        it('should put data and parse json', async () => {
            status = 200
            responseBody = JSON.stringify({ fake: 'DataUpdated' })
            const result = await put<{ fake: string }>('http://localhost:5001/testput', { fake: 'Data' }, 'fakeToken')
            expect(lastRequestBody).toEqual({ fake: 'Data'})
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testput')
            expect(lastRequest!.method).toBe('PUT')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('application/json')
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBe('15')
    
            await put<{ fake: string }>('http://localhost:5001/testput', { fake: 'Data' })
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await put<{ fake: string }>('http://localhost:5001/testput', { fake: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error).toBe(300)
        })
    })

    describe('GET', () => {
        it('should get data and parse json', async () => {
            status = 200
            responseBody = JSON.stringify({ fake: 'DataUpdated' })
            const result = await get<{ fake: string }>('http://localhost:5001/testget', 'fakeToken')
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testget')
            expect(lastRequest!.method).toBe('GET')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBeUndefined()
    
            await get<{ fake: string }>('http://localhost:5001/testget')
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await get<{ fake: string }>('http://localhost:5001/testget')
            } catch (err) {
                error = err
            }
            expect(error).toBe(300)
        })
    })

    describe('PUT', () => {
        it('should put data and parse json', async () => {
            status = 200
            responseBody = JSON.stringify({ fake: 'DataUpdated' })
            const result = await put<{ fake: string }>('http://localhost:5001/testput', { fake: 'Data' }, 'fakeToken')
            expect(lastRequestBody).toEqual({ fake: 'Data'})
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testput')
            expect(lastRequest!.method).toBe('PUT')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBe('application/json')
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBe('15')
    
            await put<{ fake: string }>('http://localhost:5001/testput', { fake: 'Data' })
            expect(lastRequest!.headers.authorization).toBeUndefined()
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await put<{ fake: string }>('http://localhost:5001/testput', { fake: 'Data' })
            } catch (err) {
                error = err
            }
            expect(error).toBe(300)
        })
    })

    describe('DELETE', () => {
        it('should delete data and parse json', async () => {
            status = 200
            responseBody = JSON.stringify({ fake: 'DataUpdated' })
            const result = await del<{ fake: string }>('http://localhost:5001/testdelete', 'fakeToken')
            expect(result).toEqual({ fake: 'DataUpdated'})
            expect(lastRequest!.url).toBe('/testdelete')
            expect(lastRequest!.method).toBe('DELETE')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBe('application/json')
            expect(lastRequest!.headers['content-length']).toBeUndefined()
    
            await del<{ fake: string }>('http://localhost:5001/testdelete')
            expect(lastRequest!.headers.authorization).toBeUndefined()

            responseBody = 'OK'
            const result2 = await del<string>('http://localhost:5001/testdelete', 'fakeToken')
            expect(result2).toEqual('OK')
        })
    
        it('should throw status if bigger than 299', async () => {
            status = 300
            let error: any
            try {
                await del<{ fake: string }>('http://localhost:5001/testdelete')
            } catch (err) {
                error = err
            }
            expect(error).toBe(300)
        })
    })

    describe('GET Stream', () => {
        it('should get stream', async () => {
            status = 200

            const response = new Readable()
            response.push('beep') 
            response.push(null)
            responseBody = response

            const result = await streamToString(await getStream('http://localhost:5001/testgetstream', 'fakeToken'))
            expect(result).toEqual('beep')
            expect(lastRequest!.url).toBe('/testgetstream')
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
            expect(error).toBeDefined()
        })
    })

    describe('POST Stream', () => {
        it('should post stream', async () => {
            status = 200

            const stream = new Readable()
            stream.push('beep') 
            stream.push(null)

            await postStream('http://localhost:5001/testpoststream', stream, 'fakeToken', { 'fake-header': 'fake' })
            expect(lastRequest!.url).toBe('/testpoststream')
            expect(lastRequest!.method).toBe('POST')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBeUndefined()
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['fake-header']).toBe('fake')
            expect(lastRequestBody).toBe('beep')
 
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
            expect(error).toBeDefined()
        })
    })

    describe('PUT Stream', () => {
        it('should post stream', async () => {
            status = 200

            const stream = new Readable()
            stream.push('beep') 
            stream.push(null)

            await putStream('http://localhost:5001/testputstream', stream, 'fakeToken',{ 'fake-header': 'fake' })
            expect(lastRequest!.url).toBe('/testputstream')
            expect(lastRequest!.method).toBe('PUT')
            expect(lastRequest!.headers.authorization).toBe('Bearer fakeToken')
            expect(lastRequest!.headers['content-type']).toBeUndefined()
            expect(lastRequest!.headers['accept']).toBeUndefined()
            expect(lastRequest!.headers['content-length']).toBeUndefined()
            expect(lastRequest!.headers['fake-header']).toBe('fake')
            expect(lastRequestBody).toBe('beep')
    
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
            expect(error).toBeDefined()
        })
    })
})