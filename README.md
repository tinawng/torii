⛩️

# Usage

`{ TORII_BASE_URL} / { TARGET API URL }`

ex: `https://torii.domain.url/https://some-api.domain.url/product_list?year=2023`

⚠️ Only works with json payload.

## GET

`/ping` - return `"🏓"` - check if alive.

📡 Fetch `remote_url` payload, compress it to brotli format and cache it.

## PUT
> *X-API-KEY necessary*

📡 Refetching cache with key matching or starting with specified `remote_url`.

## DELETE
> *X-API-KEY necessary*

🔥 Purging cache with key matching or starting with specified `remote_url`.