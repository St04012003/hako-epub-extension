import type { CheerioAPI } from "cheerio"
import type { PromiseOr } from "registry/types"
import { load } from "cheerio"
import { minify } from "html-minifier-terser"
import { stripCorsMarker } from "./utils"

export interface ChapterEndnote {
  id: string
  sourceId: string
  content: string
  backlinks: string[]
}

export interface EndnoteCollector {
  chapterIndex: number
  chapterFilename: string
  endnotesFilename: string
  endnotes: ChapterEndnote[]
}

export function renderEndnotes(endnotes: ChapterEndnote[], lang: string): string {
  const backLabel = lang === "vi" ? "Quay lại nội dung" : "Back to text"

  return `<section class="endnotes" epub:type="endnotes"><ol class="endnotes-list">${endnotes
    .map((note) => {
      const backlinks = note.backlinks
        .map(
          (href, index) =>
            `<a href="${href}" class="endnote-backlink" aria-label="${backLabel}" title="${backLabel}">↩${note.backlinks.length > 1 ? index + 1 : ""}</a>`
        )
        .join(" ")

      return `<li id="${note.id}" class="endnote" epub:type="footnote"><div class="endnote-content">${note.content}</div>${
        backlinks ? `<p class="endnote-backlinks">${backlinks}</p>` : ""
      }</li>`
    })
    .join("")}</ol></section>`
}

export async function cleanChapter(
  html: string,
  qContainer: string | (($: CheerioAPI) => string | null),
  cleaner: ($: CheerioAPI) => void,
  transformContainer: ($: CheerioAPI) => CheerioAPI,
  preParse: (html: string) => PromiseOr<string>,
  endnoteCollector?: EndnoteCollector
): Promise<string | null> {
  const $ = transformContainer(
    load(await preParse(html), {
      xml: { xmlMode: true, selfClosingTags: false }
    })
  )

  if (typeof qContainer === "function") {
    const html = qContainer($)
    if (html === null || html.length === 0) return null
  } else {
    if ($(qContainer).length === 0) return null
  }

  $(".d-none").remove()
  const noteElements = $('[id^="note"]')
    .toArray()
    .filter((el) => /^note\d+$/.test($(el).attr("id") ?? ""))

  noteElements.forEach((el) => {
    const $el = $(el)
    $el.find(".none-print.inline").remove()
    $el.find(".note-content").parent().remove()
  })

  if (typeof qContainer !== "function") {
    $(`${qContainer} > a[target='__blank']`).remove()
    $(`${qContainer} script, ${qContainer} noscript`).remove()
  }

  $("img").each((_, image) => {
    const $img = $(image)
    const src = $img.attr("data-src") ?? $img.attr("src")

    if ($img.parent().is("a")) {
      $img.parent().replaceWith($img)
    }

    // Keep the original resource URL in the chapter XHTML. epub-gen-memory
    // determines the packaged filename and media type from this value; adding
    // `#cors` here makes a `.jpg#cors` URL look like an unknown file type.
    // The CORS marker is applied only when the resource is actually fetched.
    if (src) {
      $img.attr("src", stripCorsMarker(src))
    } else {
      $img.remove()
    }
  })

  cleaner($)

  $("[style]").each((_, el) => {
    const $el = $(el)
    if ($el.attr("style")?.match(/display:\s*none/)) $el.remove()
  })

  const notes: ChapterEndnote[] = noteElements.map((item, index) => {
    const $item = $(item)
    const sourceId = $item.attr("id")!
    const noteContent = $item.find(".note-content_real").first()
    const content = (noteContent.length ? noteContent.html() : $item.html())?.trim() ?? ""

    return {
      id: `endnote-${endnoteCollector ? endnoteCollector.chapterIndex + 1 : 1}-${index + 1}`,
      sourceId,
      content,
      backlinks: []
    }
  })

  if (endnoteCollector) {
    noteElements.forEach((item) => $(item).remove())
    $(".note-reg").remove()
    endnoteCollector.endnotes.push(...notes)
  }

  const rawHtml = typeof qContainer === "function" ? qContainer($) : $(qContainer).html()
  if (!rawHtml) return null

  const output = await minify(rawHtml, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: true,
    continueOnParseError: true
  })
    // fix XHTML not parse &nbsp;
    .then((html) => html.replaceAll("&amp;", "&"))
    .then((html) => html.replaceAll("&nbsp;", "\u00A0"))

  const notesBySourceId = new Map(notes.map((note) => [note.sourceId, note]))
  const occurrenceBySourceId = new Map<string, number>()

  return output.replace(/\[(note\d+)\]/g, (match, noteId) => {
    const note = notesBySourceId.get(noteId)
    if (!note) return match

    if (!endnoteCollector) {
      return `<a id="anchor-${noteId}" href="#${noteId}" class="note-link">*</a>`
    }

    const occurrence = (occurrenceBySourceId.get(noteId) ?? 0) + 1
    occurrenceBySourceId.set(noteId, occurrence)

    const referenceId = `note-ref-${endnoteCollector.chapterIndex + 1}-${notes.indexOf(note) + 1}-${occurrence}`
    note.backlinks.push(`${endnoteCollector.chapterFilename}#${referenceId}`)

    return `<a id="${referenceId}" href="${endnoteCollector.endnotesFilename}#${note.id}" class="note-link" epub:type="noteref">*</a>`
  })
}
