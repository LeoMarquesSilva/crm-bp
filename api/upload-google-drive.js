/**
 * API – Envia um arquivo para o Google Drive usando o access_token do usuário.
 * POST body (JSON): { access_token, file_name, file_base64, mime_type?, due_diligence_folder?, due_diligence_razao_social? }
 * Se due_diligence_folder=true: cria/usa "Due Diligence" / {razao_social} e envia o arquivo lá.
 * Resposta: { webViewLink, id } do arquivo criado no Drive.
 */
import { isGoogleAuthError, refreshSharedGoogleAccessToken } from './_google-auth.js'

const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink'
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'

function sanitizeFolderName(name) {
  if (!name || typeof name !== 'string') return 'Cliente'
  return name.replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 120) || 'Cliente'
}

async function findFolderByName(accessToken, folderName, parentId) {
  const escaped = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const parentClause = parentId ? `'${parentId}' in parents` : `'root' in parents`
  const q = `mimeType='application/vnd.google-apps.folder' and name='${escaped}' and ${parentClause} and trashed=false`
  const url = `${DRIVE_FILES}?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await r.json()
  if (!r.ok) {
    const err = new Error(data.error?.message || 'Falha ao listar pastas no Drive')
    err.status = r.status
    err.payload = data
    throw err
  }
  return data.files?.[0]?.id || null
}

async function createFolder(accessToken, folderName, parentId) {
  const body = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentId ? { parents: [parentId] } : {}),
  }
  const r = await fetch(`${DRIVE_FILES}?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) {
    const err = new Error(data.error?.message || 'Falha ao criar pasta no Drive')
    err.status = r.status
    err.payload = data
    throw err
  }
  return data.id
}

async function findOrCreateFolder(accessToken, folderName, parentId) {
  const existing = await findFolderByName(accessToken, folderName, parentId)
  if (existing) return existing
  return createFolder(accessToken, folderName, parentId)
}

async function resolveDueDiligenceParentId(accessToken, razaoSocial) {
  const rootDue = await findOrCreateFolder(accessToken, 'Due Diligence', null)
  const sub = sanitizeFolderName(razaoSocial)
  return findOrCreateFolder(accessToken, sub, rootDue)
}

async function uploadDriveFile({
  accessToken,
  fileName,
  mimeType,
  fileBuffer,
  dueDiligenceFolder,
  dueDiligenceRazaoSocial,
}) {
  let parentFolderId = null
  if (dueDiligenceFolder === true && dueDiligenceRazaoSocial) {
    parentFolderId = await resolveDueDiligenceParentId(accessToken, dueDiligenceRazaoSocial)
  }

  const boundary = '-------drive_upload_' + Date.now()
  const fileMeta = { name: fileName, mimeType }
  if (parentFolderId) fileMeta.parents = [parentFolderId]
  const metaPart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(fileMeta),
    '',
  ].join('\r\n')
  const filePart = [
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
  ].join('\r\n')
  const endPart = '\r\n' + `--${boundary}--` + '\r\n'
  const body = Buffer.concat([
    Buffer.from(metaPart + '\r\n', 'utf8'),
    Buffer.from(filePart + '\r\n', 'utf8'),
    fileBuffer,
    Buffer.from(endPart, 'utf8'),
  ])

  const driveRes = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  })
  const data = await driveRes.json()
  return { driveRes, data }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let accessToken
  let fileName
  let fileBuffer
  let mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  let dueDiligenceFolder = false
  let dueDiligenceRazaoSocial = null

  const contentType = (req.headers['content-type'] || '').toLowerCase()

  if (contentType.includes('application/json')) {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    accessToken = body.access_token
    fileName = body.file_name
    const b64 = body.file_base64
    mimeType = body.mime_type || mimeType
    if (!accessToken || !fileName || !b64) {
      return res.status(400).json({ error: 'access_token, file_name e file_base64 são obrigatórios' })
    }
    try {
      fileBuffer = Buffer.from(b64, 'base64')
    } catch {
      return res.status(400).json({ error: 'file_base64 inválido' })
    }
    dueDiligenceFolder = body.due_diligence_folder === true
    dueDiligenceRazaoSocial = body.due_diligence_razao_social
      ? String(body.due_diligence_razao_social)
      : null
  } else {
    return res.status(400).json({ error: 'Content-Type deve ser application/json com access_token, file_name e file_base64' })
  }

  try {
    let driveRes
    let data
    try {
      ;({ driveRes, data } = await uploadDriveFile({
        accessToken,
        fileName,
        mimeType,
        fileBuffer,
        dueDiligenceFolder,
        dueDiligenceRazaoSocial,
      }))
    } catch (firstErr) {
      if (!isGoogleAuthError(firstErr?.status, firstErr?.payload)) {
        throw firstErr
      }
      const refreshed = await refreshSharedGoogleAccessToken()
      accessToken = refreshed.accessToken
      ;({ driveRes, data } = await uploadDriveFile({
        accessToken,
        fileName,
        mimeType,
        fileBuffer,
        dueDiligenceFolder,
        dueDiligenceRazaoSocial,
      }))
    }
    if (isGoogleAuthError(driveRes.status, data)) {
      const refreshed = await refreshSharedGoogleAccessToken()
      accessToken = refreshed.accessToken
      ;({ driveRes, data } = await uploadDriveFile({
        accessToken,
        fileName,
        mimeType,
        fileBuffer,
        dueDiligenceFolder,
        dueDiligenceRazaoSocial,
      }))
    }
    if (!driveRes.ok) {
      const errObj = typeof data.error === 'object' ? data.error : null
      const errMsg =
        errObj?.message ||
        data.error_description ||
        (typeof data.error === 'string' ? data.error : null) ||
        (driveRes.status === 401
          ? 'Token expirado. Reconecte o Google Drive.'
          : driveRes.status === 403
            ? 'Sem permissão para enviar ao Drive. Verifique se conectou com a conta correta e concedeu acesso.'
            : 'Falha ao enviar para o Drive')
      console.error('Drive upload error:', driveRes.status, data)
      return res.status(driveRes.status).json({ error: errMsg })
    }
    return res.status(200).json({
      id: data.id,
      webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    })
  } catch (err) {
    if (isGoogleAuthError(err?.status, err?.payload)) {
      return res.status(401).json({ error: 'Token expirado. Reconecte o Google Drive.' })
    }
    console.error('Upload Drive error:', err)
    return res.status(500).json({ error: err.message || 'Erro ao enviar para o Drive' })
  }
}
