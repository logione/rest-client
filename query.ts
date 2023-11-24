type QueryValue = string | number | boolean
export type Query = Record<string, QueryValue | QueryValue[]> | string | string[]

export function getUrlWithQuery(url: string, query: Query): string {
    if (!query) {
        return url
    }

    if (url.includes('?')) {
        if (!url.endsWith('&')) {
            url += '&'
        }
    } else {
        url += '?'
    }

    if (typeof query === 'string') {
        return url + query
    }

    if (Array.isArray(query)) {
        for (const q of query) {
            url += `${q}&`
        }
    } else {
        for (const key in query) {
            let values = query[key]
            if (!Array.isArray(values)) {
                values = [values]
            }
            for (const value of values) {
                url += `${key}=${encodeURIComponent(value)}&`
            }
        }
    }

    return url.slice(0, -1)
}