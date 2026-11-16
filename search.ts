type SearchValue = string | number | boolean
export type Search = Record<string, SearchValue> | string | [string, string][] | URLSearchParams

export function appendSearchToURL(url: string, search?: Search): string {
    const params = convertSearchToURLSearchParams(search)
    if (params.size === 0) {
        return url
    }

    const hashIndex = url.indexOf('#')
    const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
    let base = hashIndex === -1 ? url : url.slice(0, hashIndex)

    if (base.includes('?')) {
        if (!base.endsWith('&') && !base.endsWith('?')) {
            base += '&'
        }
    } else {
        base += '?'
    }
    return base + params.toString() + hash
}

function convertSearchToURLSearchParams(query?: Search) {
    if (query instanceof URLSearchParams) {
        return query
    }

    if (typeof query !== 'object' || Array.isArray(query)) {
        return new URLSearchParams(query)
    }

    const urlSearchParams = new URLSearchParams()
    for (const key in query) {
        if (query.hasOwnProperty(key)) {
            urlSearchParams.append(key, query[key].toString())
        }
    }
    return urlSearchParams
}