import JSZip from "jszip"
import { vi } from "vitest"

vi.mock("idb-keyval", () => ({
  del: vi.fn(async () => undefined),
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => undefined)
}))

import { generateEpub } from "./generate-epub"

describe("generateEpub endnotes", () => {
  it("places one endnotes.xhtml last and preserves two-way links", async () => {
    const chapters = [
      {
        name: "Chapter 1",
        href: "https://example.com/chapter-1",
        noteId: "note101",
        noteText: "First note"
      },
      {
        name: "Chapter 2",
        href: "https://example.com/chapter-2",
        noteId: "note202",
        noteText: "Second note"
      }
    ]

    const buffer = await generateEpub(
      {
        title: "Test volume",
        bookTitle: "Test series",
        author: ["Test author"],
        tags: ["Test"],
        publisher: "Test publisher",
        lang: "vi",
        chapterNumber: 1,
        chapters: chapters.map(({ name, href }) => ({ name, href }))
      },
      () => undefined,
      "#chapter-content",
      () => undefined,
      ($) => $,
      { concurrency: 1, retry: 1 },
      (html) => html,
      (chapter) => {
        const fixture = chapters.find(({ href }) => href === chapter.href)!
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => `<div id="chapter-content">
            <p>Body [${fixture.noteId}]</p>
            <div class="note-reg">
              <h2>Ghi chú</h2>
              <div id="${fixture.noteId}">
                <div style="display: none"><span class="note-content">duplicate</span></div>
                <span class="note-content_real">${fixture.noteText}</span>
              </div>
            </div>
          </div>`
        } as Response)
      }
    )

    const epub = await JSZip.loadAsync(buffer)
    const chapter1 = await epub.file("OEBPS/chapter-0001.xhtml")!.async("string")
    const chapter2 = await epub.file("OEBPS/chapter-0002.xhtml")!.async("string")
    const endnotes = await epub.file("OEBPS/endnotes.xhtml")!.async("string")
    const opf = await epub.file("OEBPS/content.opf")!.async("string")
    const toc = await epub.file("OEBPS/toc.xhtml")!.async("string")

    expect(chapter1).toContain('href="endnotes.xhtml#endnote-1-1"')
    expect(chapter1).toContain('id="note-ref-1-1-1"')
    expect(chapter1).toContain(">*</a>")
    expect(chapter1).not.toContain("First note")
    expect(chapter2).toContain('href="endnotes.xhtml#endnote-2-1"')
    expect(chapter2).not.toContain("Second note")

    expect(endnotes).toContain('id="endnote-1-1"')
    expect(endnotes).toContain("First note")
    expect(endnotes).toContain('href="chapter-0001.xhtml#note-ref-1-1-1"')
    expect(endnotes).toContain('id="endnote-2-1"')
    expect(endnotes).toContain("Second note")
    expect(endnotes).toContain('href="chapter-0002.xhtml#note-ref-2-1-1"')

    expect(opf).toContain('href="endnotes.xhtml"')
    expect(opf.indexOf('idref="content_1_item_1"')).toBeLessThan(
      opf.indexOf('idref="content_2_item_2"')
    )
    expect(toc).toContain('href="endnotes.xhtml"')
    expect(toc.indexOf('href="chapter-0002.xhtml"')).toBeLessThan(
      toc.indexOf('href="endnotes.xhtml"')
    )
  })
})
