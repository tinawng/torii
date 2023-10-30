import brotli from "./node_modules/brotli-wasm/index.node.js"
const { compress } = await brotli

const CACHE = new Map()
const ALLOWED_REMOTE_HOSTS = JSON.parse(process.env.ALLOWED_REMOTE_HOSTS)
const SHARED_SECRET = process.env.SHARED_SECRET

export default {
  port: process.env.PORT,
  async fetch({ headers, method, url: raw_url }) {
    const url = new URL(raw_url)

    if (method === "OPTIONS") {
      return new Response("OK", {
        headers: {
          "Access-Control-Allow-Methods": "GET,OPTIONS",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Max-Age": "86400",
          "Access-Control-Allow-Headers": "Content-Type, authorization",
          "Content-Length": "2",
        },
      })
    } else if (method === "GET") {
      if (url.pathname === "/ping") return new Response("🏓")

      // 🛂
      let remote_url
      try {
        remote_url = new URL(url.toString().replace(`${url.origin}/`, ""))
      } catch (e) {
        return new Response("", { status: 400 })
      }
      if (!ALLOWED_REMOTE_HOSTS.some(host => remote_url.host === host)) return new Response("", { status: 400 })

      // 🗃️
      let compressed_resp, was_rep_cached = true
      if (CACHE.has(remote_url.href)) compressed_resp = CACHE.get(remote_url.href)
      else {
        // 📡
        const remote_resp = await fetch(remote_url, { headers: { referer: process.env.NODE_NAME } })
        if (remote_resp.status > 299) return new Response("", { status: 421 })

        compressed_resp = compress(Buffer.from(await remote_resp.text()), { quality: 11 })
        CACHE.set(remote_url.href, compressed_resp)
        was_rep_cached = false
      }

      // 💨
      return new Response(Buffer.from(compressed_resp), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
          "Content-Encoding": "br",
          "X-CACHED": was_rep_cached
        },
      })
    } else if (method === "PATCH") {
      if (headers.get("X-API-KEY") !== SHARED_SECRET) return new Response("", { status: 401 })

      const key = url.toString().replace(`${url.origin}/`, "")
      if (!key.length) return new Response("", { status: 400 })

      let reqs = []
      CACHE.forEach((_, _key) => {
        if (_key.startsWith(key))
          reqs.push(
            new Promise(async resolve => {
              const remote_resp = await fetch(_key, { headers: { referer: process.env.NODE_NAME } })
              if (remote_resp.status > 299) CACHE.delete(_key)
              else CACHE.set(_key, compress(Buffer.from(await remote_resp.text()), { quality: 11 }))
              resolve()
            })
          )
      })

      try {
        // ⚡ Splice requets to not overload the remote server
        while (reqs.length) await Promise.all(reqs.splice(0, 5))
      } catch (error) {
        return new Response(`cache refetch failed: ${error}`, { status: 500 })
      }

      return new Response("", { status: 200 })
    } else if (method === "DELETE") {
      if (headers.get("X-API-KEY") !== SHARED_SECRET) return new Response("", { status: 401 })

      const key = url.toString().replace(`${url.origin}/`, "")

      if (key.length) {
        CACHE.forEach((_v, _key) => {
          if (_key.startsWith(key)) CACHE.delete(_key)
        })
      } else CACHE.clear()

      return new Response("", { status: 200 })
    }

    return new Response("", { status: 405 })
  },
}
