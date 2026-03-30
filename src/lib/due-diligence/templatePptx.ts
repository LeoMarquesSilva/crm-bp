/**
 * Carrega MODELO.pptx, substitui [nome] pelo nome do cliente.
 * Mescla slides gerados (pptxgenjs) ao final do modelo em um único arquivo.
 */
import JSZip from 'jszip'

const TEMPLATE_URL = '/MODELO.pptx'
const REL_SLIDE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'
const REL_LAYOUT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout'
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const OFFDOC_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PRES_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'

type RelationshipNode = {
  id: string
  type: string
  target: string
  targetMode?: string
}

type ContentTypesInfo = {
  overrideMap: Map<string, string>
  defaultMap: Map<string, string>
}

function isTextFile(name: string): boolean {
  const n = name.toLowerCase()
  return n.endsWith('.xml') || n.endsWith('.rels') || n === '[content_types].xml'
}

function stripSlash(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path
}

function ensureAbs(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function zipHas(zip: JSZip, absPath: string): boolean {
  return !!zip.file(stripSlash(absPath))
}

function splitPart(path: string): { dir: string; file: string } {
  const abs = ensureAbs(path)
  const idx = abs.lastIndexOf('/')
  return { dir: idx <= 0 ? '/' : abs.slice(0, idx), file: abs.slice(idx + 1) }
}

function extOf(file: string): string {
  const idx = file.lastIndexOf('.')
  return idx >= 0 ? file.slice(idx + 1).toLowerCase() : ''
}

function joinPosix(baseDir: string, rel: string): string {
  if (rel.startsWith('/')) return normalizePartPath(rel)
  const stack = baseDir.split('/').filter(Boolean)
  for (const part of rel.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return `/${stack.join('/')}`
}

function normalizePartPath(path: string): string {
  const stack: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return `/${stack.join('/')}`
}

function relativeFromDir(fromDir: string, absTo: string): string {
  const from = fromDir.split('/').filter(Boolean)
  const to = absTo.split('/').filter(Boolean)
  let i = 0
  while (i < from.length && i < to.length && from[i] === to[i]) i++
  const up = new Array(from.length - i).fill('..')
  const down = to.slice(i)
  const rel = [...up, ...down].join('/')
  return rel || '.'
}

function partToRelsPath(partAbs: string): string {
  const { dir, file } = splitPart(partAbs)
  return `${dir}/_rels/${file}.rels`
}

function relsOwnerPart(relsAbs: string): string {
  const abs = ensureAbs(relsAbs)
  if (abs === '/_rels/.rels') return '/'
  const m = abs.match(/^(.*)\/_rels\/([^/]+)\.rels$/)
  if (!m) return '/'
  const dir = m[1] || '/'
  return `${dir}/${m[2]}`
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml')
}

function serializeXml(doc: Document): string {
  return new XMLSerializer().serializeToString(doc)
}

function xmlHasParseError(doc: Document): boolean {
  return !!doc.getElementsByTagName('parsererror').length
}

function getRelNodes(doc: Document): Element[] {
  const byNs = Array.from(doc.getElementsByTagNameNS(REL_NS, 'Relationship'))
  if (byNs.length > 0) return byNs
  return Array.from(doc.getElementsByTagName('Relationship'))
}

function readRelationships(xml: string): RelationshipNode[] {
  const doc = parseXml(xml)
  if (xmlHasParseError(doc)) return []
  return getRelNodes(doc).map((node) => ({
    id: node.getAttribute('Id') ?? '',
    type: node.getAttribute('Type') ?? '',
    target: node.getAttribute('Target') ?? '',
    targetMode: node.getAttribute('TargetMode') ?? undefined,
  }))
}

function getMaxRidFromRelationships(xml: string): number {
  const rels = readRelationships(xml)
  let max = 0
  for (const rel of rels) {
    const m = rel.id.match(/^rId(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max
}

function listSlideNumbers(zip: JSZip): number[] {
  const nums: number[] = []
  for (const name of Object.keys(zip.files)) {
    const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/i)
    if (m) nums.push(parseInt(m[1], 10))
  }
  return nums.sort((a, b) => a - b)
}

function parseContentTypes(xml: string): ContentTypesInfo {
  const doc = parseXml(xml)
  const overrideMap = new Map<string, string>()
  const defaultMap = new Map<string, string>()
  if (xmlHasParseError(doc)) return { overrideMap, defaultMap }
  const overrides = Array.from(doc.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Override'))
  const defaults = Array.from(doc.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Default'))
  for (const n of overrides) {
    const part = n.getAttribute('PartName')
    const ctype = n.getAttribute('ContentType')
    if (part && ctype) overrideMap.set(part, ctype)
  }
  for (const n of defaults) {
    const ext = n.getAttribute('Extension')?.toLowerCase()
    const ctype = n.getAttribute('ContentType')
    if (ext && ctype) defaultMap.set(ext, ctype)
  }
  return { overrideMap, defaultMap }
}

function ensureContentType(
  templateDoc: Document,
  partName: string,
  contentType: string,
  isDefaultByExt = false
): void {
  const typesNode =
    templateDoc.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Types')[0] ||
    templateDoc.getElementsByTagName('Types')[0]
  if (!typesNode) return

  if (isDefaultByExt) {
    const ext = partName.toLowerCase()
    const existingDefaults = Array.from(
      templateDoc.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Default')
    )
    if (existingDefaults.some((n) => n.getAttribute('Extension')?.toLowerCase() === ext)) return
    const d = templateDoc.createElementNS(CONTENT_TYPES_NS, 'Default')
    d.setAttribute('Extension', ext)
    d.setAttribute('ContentType', contentType)
    typesNode.appendChild(d)
    return
  }

  const existingOverrides = Array.from(
    templateDoc.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Override')
  )
  if (existingOverrides.some((n) => n.getAttribute('PartName') === partName)) return
  const o = templateDoc.createElementNS(CONTENT_TYPES_NS, 'Override')
  o.setAttribute('PartName', partName)
  o.setAttribute('ContentType', contentType)
  typesNode.appendChild(o)
}

function contentTypeForPart(partAbs: string, srcTypes: ContentTypesInfo): { type: string; fromDefault: boolean } | null {
  const partName = ensureAbs(partAbs)
  const override = srcTypes.overrideMap.get(partName)
  if (override) return { type: override, fromDefault: false }
  const ext = extOf(splitPart(partName).file)
  if (!ext) return null
  const d = srcTypes.defaultMap.get(ext)
  if (!d) return null
  return { type: d, fromDefault: true }
}

function makeAllocator(templateZip: JSZip): (sourceAbsPath: string) => string {
  const used = new Set(Object.keys(templateZip.files).map((p) => ensureAbs(p)))
  const counters = new Map<string, number>()

  const nextIndexed = (key: string, dir: string, prefix: string, ext: string): string => {
    let n = counters.get(key)
    if (!n) {
      n = 1
      for (const p of used) {
        const m = p.match(new RegExp(`^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${prefix}(\\d+)\\.${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))
        if (m) n = Math.max(n, parseInt(m[1], 10) + 1)
      }
    }
    let candidate = `${dir}/${prefix}${n}.${ext}`
    while (used.has(candidate)) {
      n += 1
      candidate = `${dir}/${prefix}${n}.${ext}`
    }
    counters.set(key, n + 1)
    used.add(candidate)
    return candidate
  }

  return (sourceAbsPath: string): string => {
    const src = ensureAbs(sourceAbsPath)
    if (src.startsWith('/ppt/charts/chart') && src.endsWith('.xml')) {
      return nextIndexed('chart', '/ppt/charts', 'chart', 'xml')
    }
    if (src.startsWith('/ppt/charts/style') && src.endsWith('.xml')) {
      return nextIndexed('chartStyle', '/ppt/charts', 'style', 'xml')
    }
    if (src.startsWith('/ppt/charts/colors') && src.endsWith('.xml')) {
      return nextIndexed('chartColors', '/ppt/charts', 'colors', 'xml')
    }
    if (src.startsWith('/ppt/embeddings/')) {
      const { file } = splitPart(src)
      const ext = extOf(file) || 'bin'
      return nextIndexed(`embed-${ext}`, '/ppt/embeddings', 'oleObject', ext)
    }
    if (src.startsWith('/ppt/media/')) {
      const { file } = splitPart(src)
      const ext = extOf(file) || 'bin'
      return nextIndexed(`media-${ext}`, '/ppt/media', 'image', ext)
    }
    if (src.startsWith('/ppt/drawings/drawing') && src.endsWith('.xml')) {
      return nextIndexed('drawing', '/ppt/drawings', 'drawing', 'xml')
    }
    const { dir, file } = splitPart(src)
    let candidate = `${dir}/${file}`
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
    const dot = file.lastIndexOf('.')
    const base = dot >= 0 ? file.slice(0, dot) : file
    const ext = dot >= 0 ? file.slice(dot) : ''
    let i = 1
    do {
      candidate = `${dir}/${base}_m${i}${ext}`
      i += 1
    } while (used.has(candidate))
    used.add(candidate)
    return candidate
  }
}

/** Carrega o zip do modelo e substitui [nome]. Retorna o zip para permitir merge. */
export async function loadTemplateZipAndReplaceName(clientName: string): Promise<JSZip | null> {
  let res: Response
  try {
    res = await fetch(TEMPLATE_URL)
  } catch {
    return null
  }
  if (!res.ok) return null
  const arrayBuffer = await res.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  const replace = (s: string) =>
    s
      .replace(/\[nome\]/g, clientName)
      .replace(/\[NOME\]/g, clientName.toUpperCase())

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    if (!isTextFile(name)) continue
    try {
      const text = await file.async('string')
      const newText = replace(text)
      if (newText !== text) zip.file(name, newText)
    } catch {
      // ignore binary or malformed files
    }
  }
  return zip
}

/** Remove slides 2, 3, 4 do template, mantendo apenas o slide 1 (capa com [nome]). */
export async function keepOnlySlide1(templateZip: JSZip): Promise<void> {
  const presPath = 'ppt/presentation.xml'
  const relsPath = 'ppt/_rels/presentation.xml.rels'
  const ctPath = '[Content_Types].xml'

  const presFile = templateZip.file(presPath)
  const relsFile = templateZip.file(relsPath)
  const ctFile = templateZip.file(ctPath)
  if (!presFile || !relsFile || !ctFile) return

  const [presXml, relsXml, ctXml] = await Promise.all([
    presFile.async('string'),
    relsFile.async('string'),
    ctFile.async('string'),
  ])

  const rels = readRelationships(relsXml)
  const ridsToRemove = new Set<string>()
  for (const r of rels) {
    if (r.type === REL_SLIDE && r.target) {
      const m = r.target.match(/slides\/slide([234])\.xml$/i)
      if (m) ridsToRemove.add(r.id)
    }
  }

  const presDoc = parseXml(presXml)
  const sldIdLst =
    presDoc.getElementsByTagNameNS(PRES_NS, 'sldIdLst')[0] ||
    presDoc.getElementsByTagName('p:sldIdLst')[0] ||
    presDoc.getElementsByTagName('sldIdLst')[0]
  if (sldIdLst) {
    const toRemove: Element[] = []
    for (const sldId of Array.from(sldIdLst.children)) {
      const rid = sldId.getAttribute?.('r:id') ?? sldId.getAttribute?.('id')
      if (rid && ridsToRemove.has(rid)) toRemove.push(sldId as Element)
    }
    toRemove.forEach((el) => el.remove())
  }

  const relsDoc = parseXml(relsXml)
  const relsRoot =
    relsDoc.getElementsByTagNameNS(REL_NS, 'Relationships')[0] ||
    relsDoc.getElementsByTagName('Relationships')[0]
  if (relsRoot) {
    const toRemove: Element[] = []
    for (const rel of Array.from(relsRoot.children)) {
      const id = rel.getAttribute?.('Id')
      if (id && ridsToRemove.has(id)) toRemove.push(rel as Element)
    }
    toRemove.forEach((el) => el.remove())
  }

  const ctDoc = parseXml(ctXml)
  const typesNode =
    ctDoc.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Types')[0] ||
    ctDoc.getElementsByTagName('Types')[0]
  if (typesNode) {
    const toRemove: Element[] = []
    for (const o of Array.from(typesNode.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Override'))) {
      const part = o.getAttribute('PartName') ?? ''
      if (/\/slides\/slide[234]\.xml$/i.test(part)) toRemove.push(o)
    }
    toRemove.forEach((el) => el.remove())
  }

  templateZip.file(presPath, serializeXml(presDoc))
  templateZip.file(relsPath, serializeXml(relsDoc))
  templateZip.file(ctPath, serializeXml(ctDoc))

  const toRemove = Object.keys(templateZip.files).filter(
    (name) =>
      /^ppt\/slides\/slide[234]\.xml$/i.test(name) || /^ppt\/slides\/_rels\/slide[234]\.xml\.rels$/i.test(name)
  )
  for (const name of toRemove) templateZip.remove(name)
}

/** Mantido para compatibilidade. */
export async function loadTemplateAndReplaceName(clientName: string): Promise<Blob | null> {
  const zip = await loadTemplateZipAndReplaceName(clientName)
  if (!zip) return null
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
}

async function getTemplateLayoutTarget(templateZip: JSZip): Promise<string> {
  const relFile = templateZip.file('ppt/slides/_rels/slide1.xml.rels')
  if (!relFile) throw new Error('Modelo sem relação de slide base (slide1.xml.rels).')
  const xml = await relFile.async('string')
  const rels = readRelationships(xml)
  const layoutRel = rels.find((r) => r.type === REL_LAYOUT)
  if (!layoutRel) throw new Error('Modelo sem relação slideLayout no slide1.')
  return layoutRel.target
}

function maxSlideIdFromPresentation(xml: string): number {
  const doc = parseXml(xml)
  const sldIds = Array.from(doc.getElementsByTagNameNS(PRES_NS, 'sldId'))
  let max = 255
  for (const n of sldIds) {
    const id = n.getAttribute('id')
    if (!id) continue
    const parsed = parseInt(id, 10)
    if (!Number.isNaN(parsed)) max = Math.max(max, parsed)
  }
  return max
}

function ensureSlideLayoutRel(
  relsDoc: Document,
  templateLayoutTarget: string
): void {
  const relNodes = getRelNodes(relsDoc)
  const layout = relNodes.find((n) => n.getAttribute('Type') === REL_LAYOUT)
  if (layout) {
    layout.setAttribute('Target', templateLayoutTarget)
    return
  }
  let maxRid = 0
  for (const n of relNodes) {
    const id = n.getAttribute('Id') ?? ''
    const m = id.match(/^rId(\d+)$/)
    if (m) maxRid = Math.max(maxRid, parseInt(m[1], 10))
  }
  const relsRoot =
    relsDoc.getElementsByTagNameNS(REL_NS, 'Relationships')[0] ||
    relsDoc.getElementsByTagName('Relationships')[0]
  if (!relsRoot) return
  const rel = relsDoc.createElementNS(REL_NS, 'Relationship')
  rel.setAttribute('Id', `rId${maxRid + 1}`)
  rel.setAttribute('Type', REL_LAYOUT)
  rel.setAttribute('Target', templateLayoutTarget)
  relsRoot.appendChild(rel)
}

async function mergePartDependencies(
  sourceZip: JSZip,
  templateZip: JSZip,
  srcPartAbs: string,
  dstPartAbs: string,
  srcTypes: ContentTypesInfo,
  templateTypesDoc: Document,
  sourceToDestPartMap: Map<string, string>,
  allocatePath: (sourceAbsPath: string) => string,
  visitedPairs: Set<string>
): Promise<void> {
  const key = `${srcPartAbs}->${dstPartAbs}`
  if (visitedPairs.has(key)) return
  visitedPairs.add(key)

  const srcRelsAbs = partToRelsPath(srcPartAbs)
  const srcRelsFile = sourceZip.file(stripSlash(srcRelsAbs))
  if (!srcRelsFile) return
  const relXml = await srcRelsFile.async('string')
  const relDoc = parseXml(relXml)
  if (xmlHasParseError(relDoc)) return
  const relNodes = getRelNodes(relDoc)

  for (const rel of relNodes) {
    const targetMode = rel.getAttribute('TargetMode') || ''
    if (targetMode.toLowerCase() === 'external') continue
    const target = rel.getAttribute('Target')
    if (!target) continue
    const resolvedSrcTargetAbs = joinPosix(splitPart(srcPartAbs).dir, target)
    if (!zipHas(sourceZip, resolvedSrcTargetAbs)) {
      throw new Error(`Parte referenciada ausente no conteúdo: ${resolvedSrcTargetAbs}`)
    }
    let resolvedDstTargetAbs = sourceToDestPartMap.get(resolvedSrcTargetAbs)
    if (!resolvedDstTargetAbs) {
      resolvedDstTargetAbs = allocatePath(resolvedSrcTargetAbs)
      sourceToDestPartMap.set(resolvedSrcTargetAbs, resolvedDstTargetAbs)
      const bin = await sourceZip.file(stripSlash(resolvedSrcTargetAbs))!.async('uint8array')
      templateZip.file(stripSlash(resolvedDstTargetAbs), bin)
      const srcType = contentTypeForPart(resolvedSrcTargetAbs, srcTypes)
      if (srcType) {
        if (srcType.fromDefault) {
          ensureContentType(templateTypesDoc, extOf(splitPart(resolvedDstTargetAbs).file), srcType.type, true)
        } else {
          ensureContentType(templateTypesDoc, ensureAbs(resolvedDstTargetAbs), srcType.type, false)
        }
      }
      await mergePartDependencies(
        sourceZip,
        templateZip,
        resolvedSrcTargetAbs,
        resolvedDstTargetAbs,
        srcTypes,
        templateTypesDoc,
        sourceToDestPartMap,
        allocatePath,
        visitedPairs
      )
    }
    const newTarget = relativeFromDir(splitPart(dstPartAbs).dir, resolvedDstTargetAbs)
    rel.setAttribute('Target', newTarget)
  }

  const dstRelsAbs = partToRelsPath(dstPartAbs)
  templateZip.file(stripSlash(dstRelsAbs), serializeXml(relDoc))
}

async function rewriteSlideRelsWithTemplateLayout(
  sourceZip: JSZip,
  templateZip: JSZip,
  srcSlideAbs: string,
  dstSlideAbs: string,
  templateLayoutTarget: string,
  srcTypes: ContentTypesInfo,
  templateTypesDoc: Document,
  sourceToDestPartMap: Map<string, string>,
  allocatePath: (sourceAbsPath: string) => string,
  visitedPairs: Set<string>
): Promise<void> {
  const srcSlideRelsAbs = partToRelsPath(srcSlideAbs)
  const srcSlideRelsFile = sourceZip.file(stripSlash(srcSlideRelsAbs))
  if (!srcSlideRelsFile) {
    // cria rels mínimo com layout se slide de origem não tiver .rels
    const doc = parseXml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>')
    ensureSlideLayoutRel(doc, templateLayoutTarget)
    templateZip.file(stripSlash(partToRelsPath(dstSlideAbs)), serializeXml(doc))
    return
  }

  const xml = await srcSlideRelsFile.async('string')
  const relDoc = parseXml(xml)
  if (xmlHasParseError(relDoc)) {
    throw new Error(`Rels inválido no slide de conteúdo: ${srcSlideRelsAbs}`)
  }
  const relNodes = getRelNodes(relDoc)
  for (const rel of relNodes) {
    const relType = rel.getAttribute('Type') ?? ''
    if (relType === REL_LAYOUT) {
      rel.setAttribute('Target', templateLayoutTarget)
      continue
    }
    const targetMode = rel.getAttribute('TargetMode') || ''
    if (targetMode.toLowerCase() === 'external') continue
    const target = rel.getAttribute('Target')
    if (!target) continue
    const resolvedSrcTargetAbs = joinPosix(splitPart(srcSlideAbs).dir, target)
    if (!zipHas(sourceZip, resolvedSrcTargetAbs)) {
      throw new Error(`Parte referenciada ausente no slide: ${resolvedSrcTargetAbs}`)
    }
    let resolvedDstTargetAbs = sourceToDestPartMap.get(resolvedSrcTargetAbs)
    if (!resolvedDstTargetAbs) {
      resolvedDstTargetAbs = allocatePath(resolvedSrcTargetAbs)
      sourceToDestPartMap.set(resolvedSrcTargetAbs, resolvedDstTargetAbs)
      const bin = await sourceZip.file(stripSlash(resolvedSrcTargetAbs))!.async('uint8array')
      templateZip.file(stripSlash(resolvedDstTargetAbs), bin)
      const srcType = contentTypeForPart(resolvedSrcTargetAbs, srcTypes)
      if (srcType) {
        if (srcType.fromDefault) {
          ensureContentType(templateTypesDoc, extOf(splitPart(resolvedDstTargetAbs).file), srcType.type, true)
        } else {
          ensureContentType(templateTypesDoc, ensureAbs(resolvedDstTargetAbs), srcType.type, false)
        }
      }
      await mergePartDependencies(
        sourceZip,
        templateZip,
        resolvedSrcTargetAbs,
        resolvedDstTargetAbs,
        srcTypes,
        templateTypesDoc,
        sourceToDestPartMap,
        allocatePath,
        visitedPairs
      )
    }
    const newTarget = relativeFromDir(splitPart(dstSlideAbs).dir, resolvedDstTargetAbs)
    rel.setAttribute('Target', newTarget)
  }

  ensureSlideLayoutRel(relDoc, templateLayoutTarget)
  templateZip.file(stripSlash(partToRelsPath(dstSlideAbs)), serializeXml(relDoc))
}

function validateMergedZip(zip: JSZip, contentTypesXml: string): void {
  const ctInfo = parseContentTypes(contentTypesXml)
  const errors: string[] = []
  const files = Object.keys(zip.files).filter((name) => name.endsWith('.rels'))
  for (const relsPath of files) {
    const relsFile = zip.file(relsPath)
    if (!relsFile) continue
    const relsText = (relsFile as unknown as { _data?: unknown })._data
    if (relsText === undefined) {
      // fallback read synchronously not available; skip
    }
  }
  // validação assíncrona simplificada executada em mergeSlidesFromPptx
  if (!ctInfo.defaultMap.size && !ctInfo.overrideMap.size) {
    errors.push('Content_Types inválido após merge.')
  }
  if (errors.length) {
    throw new Error(errors.join(' '))
  }
}

async function preflightValidateMergedZip(zip: JSZip): Promise<void> {
  const ctFile = zip.file('[Content_Types].xml')
  if (!ctFile) throw new Error('Arquivo [Content_Types].xml ausente no PPT final.')
  const ctXml = await ctFile.async('string')
  const ct = parseContentTypes(ctXml)
  const relFiles = Object.keys(zip.files).filter((p) => p.toLowerCase().endsWith('.rels'))
  const issues: string[] = []

  for (const relPath of relFiles) {
    const relFile = zip.file(relPath)
    if (!relFile) continue
    const relXml = await relFile.async('string')
    const rels = readRelationships(relXml)
    const ids = new Set<string>()
    const ownerAbs = ensureAbs(relsOwnerPart(ensureAbs(relPath)))
    for (const rel of rels) {
      if (!rel.id) {
        issues.push(`Relationship sem Id em ${relPath}`)
        continue
      }
      if (ids.has(rel.id)) issues.push(`Relationship Id duplicado (${rel.id}) em ${relPath}`)
      ids.add(rel.id)
      if ((rel.targetMode || '').toLowerCase() === 'external') continue
      if (!rel.target) continue
      const targetAbs = joinPosix(splitPart(ownerAbs).dir, rel.target)
      if (!zipHas(zip, targetAbs)) {
        issues.push(`Target ausente: ${targetAbs} (referenciado por ${relPath})`)
        continue
      }
      const partName = ensureAbs(targetAbs)
      if (!partName.toLowerCase().endsWith('.rels')) {
        const override = ct.overrideMap.get(partName)
        const dflt = ct.defaultMap.get(extOf(splitPart(partName).file))
        if (!override && !dflt) {
          issues.push(`Content-Type ausente para part ${partName}`)
        }
      }
    }
  }
  if (issues.length) {
    throw new Error(`PPTX inválido no preflight: ${issues.slice(0, 8).join(' | ')}`)
  }
}

/**
 * Mescla os slides do pptx gerado ao final do template em um único arquivo.
 * Copia recursivamente o grafo de dependências (charts, embeddings, media etc.)
 * e valida integridade de relações antes de finalizar.
 */
export async function mergeSlidesFromPptx(templateZip: JSZip, contentArrayBuffer: ArrayBuffer): Promise<void> {
  const sourceZip = await JSZip.loadAsync(contentArrayBuffer)
  const srcSlideNums = listSlideNumbers(sourceZip)
  if (srcSlideNums.length === 0) return

  const templatePresPath = '/ppt/presentation.xml'
  const templateRelsPath = '/ppt/_rels/presentation.xml.rels'
  const templateCTPath = '/[Content_Types].xml'

  const presFile = templateZip.file(stripSlash(templatePresPath))
  const relsFile = templateZip.file(stripSlash(templateRelsPath))
  const ctFile = templateZip.file(stripSlash(templateCTPath))
  const sourceCtFile = sourceZip.file('[Content_Types].xml')
  if (!presFile || !relsFile || !ctFile || !sourceCtFile) {
    throw new Error('Estrutura PPTX incompleta para merge.')
  }

  const [presXml, relsXml, ctXml, sourceCtXml] = await Promise.all([
    presFile.async('string'),
    relsFile.async('string'),
    ctFile.async('string'),
    sourceCtFile.async('string'),
  ])

  const presDoc = parseXml(presXml)
  const relsDoc = parseXml(relsXml)
  const ctDoc = parseXml(ctXml)
  if (xmlHasParseError(presDoc) || xmlHasParseError(relsDoc) || xmlHasParseError(ctDoc)) {
    throw new Error('XML base do template inválido para merge.')
  }

  const srcTypes = parseContentTypes(sourceCtXml)
  const templateLayoutTarget = await getTemplateLayoutTarget(templateZip)
  const templateSlideNums = listSlideNumbers(templateZip)
  let nextSlideNum = (templateSlideNums[templateSlideNums.length - 1] ?? 0) + 1
  let nextSlideId = maxSlideIdFromPresentation(presXml) + 1
  let nextPresRid = getMaxRidFromRelationships(relsXml) + 1

  const sldIdLst =
    presDoc.getElementsByTagNameNS(PRES_NS, 'sldIdLst')[0] ||
    presDoc.getElementsByTagName('p:sldIdLst')[0] ||
    presDoc.getElementsByTagName('sldIdLst')[0]
  if (!sldIdLst) throw new Error('presentation.xml sem p:sldIdLst.')
  const relsRoot =
    relsDoc.getElementsByTagNameNS(REL_NS, 'Relationships')[0] ||
    relsDoc.getElementsByTagName('Relationships')[0]
  if (!relsRoot) throw new Error('presentation.xml.rels sem Relationships.')

  const sourceToDestPartMap = new Map<string, string>()
  const visitedPairs = new Set<string>()
  const allocatePath = makeAllocator(templateZip)

  for (const srcNum of srcSlideNums) {
    const srcSlideAbs = `/ppt/slides/slide${srcNum}.xml`
    const dstSlideAbs = `/ppt/slides/slide${nextSlideNum}.xml`
    nextSlideNum += 1

    const srcSlideFile = sourceZip.file(stripSlash(srcSlideAbs))
    if (!srcSlideFile) continue
    const slideBin = await srcSlideFile.async('uint8array')
    templateZip.file(stripSlash(dstSlideAbs), slideBin)
    sourceToDestPartMap.set(srcSlideAbs, dstSlideAbs)

    const slideType = contentTypeForPart(srcSlideAbs, srcTypes)
    if (slideType) {
      if (slideType.fromDefault) {
        ensureContentType(ctDoc, extOf(splitPart(dstSlideAbs).file), slideType.type, true)
      } else {
        ensureContentType(ctDoc, ensureAbs(dstSlideAbs), slideType.type, false)
      }
    }

    await rewriteSlideRelsWithTemplateLayout(
      sourceZip,
      templateZip,
      srcSlideAbs,
      dstSlideAbs,
      templateLayoutTarget,
      srcTypes,
      ctDoc,
      sourceToDestPartMap,
      allocatePath,
      visitedPairs
    )

    const sldId = presDoc.createElementNS(PRES_NS, 'p:sldId')
    sldId.setAttribute('id', String(nextSlideId++))
    sldId.setAttributeNS(OFFDOC_REL_NS, 'r:id', `rId${nextPresRid}`)
    sldIdLst.appendChild(sldId)

    const rel = relsDoc.createElementNS(REL_NS, 'Relationship')
    rel.setAttribute('Id', `rId${nextPresRid}`)
    rel.setAttribute('Type', REL_SLIDE)
    rel.setAttribute('Target', `slides/slide${nextSlideNum - 1}.xml`)
    relsRoot.appendChild(rel)
    nextPresRid += 1
  }

  const newPresXml = serializeXml(presDoc)
  const newRelsXml = serializeXml(relsDoc)
  const newCtXml = serializeXml(ctDoc)

  templateZip.file(stripSlash(templatePresPath), newPresXml)
  templateZip.file(stripSlash(templateRelsPath), newRelsXml)
  templateZip.file(stripSlash(templateCTPath), newCtXml)

  validateMergedZip(templateZip, newCtXml)
  await preflightValidateMergedZip(templateZip)
}
