import { afterEach, describe, expect, it, vi } from "vitest"
import { getFetchCredentials, getFetchUrl, stripCorsMarker } from "./utils"

describe("EPUB resource fetch URLs", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("adds the CORS marker only to the outgoing cross-origin request", () => {
    vi.stubGlobal("location", { origin: "https://hako.vn" })

    expect(getFetchUrl("https://cdn.example.com/illustration.jpg")).toBe(
      "https://cdn.example.com/illustration.jpg#cors"
    )
    expect(getFetchUrl("https://cdn.example.com/illustration.jpg#cors")).toBe(
      "https://cdn.example.com/illustration.jpg#cors"
    )
    expect(getFetchUrl("/assets/illustration.jpg")).toBe("/assets/illustration.jpg")
  })

  it("does not treat data and blob URLs as CORS fetches", () => {
    vi.stubGlobal("location", { origin: "https://hako.vn" })

    expect(getFetchUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA")
    expect(getFetchUrl("blob:https://hako.vn/id")).toBe("blob:https://hako.vn/id")
    expect(getFetchCredentials("https://hako.vn/image.jpg#cors")).toBe("include")
    expect(stripCorsMarker("https://cdn.example.com/image.jpg#cors")).toBe(
      "https://cdn.example.com/image.jpg"
    )
  })
})
