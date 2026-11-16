export type HeadersOption = Record<string, string> | Headers | [string, string][]

export function toHeaderRecord(headers?: HeadersOption): Record<string, string> {
    if (!headers) {
        return {}
    }
    if (isHeadersInstance(headers)) {
        const record: Record<string, string> = {}
        headers.forEach((value, name) => {
            record[name] = value
        })
        return record
    }
    if (Array.isArray(headers)) {
        const record: Record<string, string> = {}
        for (const [name, value] of headers) {
            const existing = findHeaderName(record, name)
            if (existing === undefined) {
                record[name] = value
            } else {
                record[existing] = `${record[existing]}, ${value}`
            }
        }
        return record
    }
    return { ...headers }
}

export function getHeader(headers: Record<string, string>, name: string): string | undefined {
    const key = findHeaderName(headers, name)
    return key === undefined ? undefined : headers[key]
}

export function hasHeader(headers: Record<string, string>, name: string): boolean {
    return findHeaderName(headers, name) !== undefined
}

export function setHeader(headers: Record<string, string>, name: string, value: string): void {
    removeHeader(headers, name)
    headers[name] = value
}

function isHeadersInstance(headers: HeadersOption): headers is Headers {
    return typeof Headers !== 'undefined' && headers instanceof Headers
}

function findHeaderName(headers: Record<string, string>, name: string): string | undefined {
    const lowerName = name.toLowerCase()
    return Object.keys(headers).find((key) => key.toLowerCase() === lowerName)
}

export function removeHeader(headers: Record<string, string>, name: string): void {
    const lowerName = name.toLowerCase()
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lowerName) {
            delete headers[key]
        }
    }
}
