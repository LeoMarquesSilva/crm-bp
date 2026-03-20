/**
 * API – Envia um arquivo para o Google Drive usando o access_token do usuário.
 * POST body (JSON): { access_token, file_name, file_base64 } ou (multipart): file + access_token.
 * Resposta: { webViewLink, id } do arquivo criado no Drive.
 */
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let accessToken
  let fileName
  let fileBuffer
  let mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

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
  } else {
    return res.status(400).json({ error: 'Content-Type deve ser application/json com access_token, file_name e file_base64' })
  }

  const boundary = '-------drive_upload_' + Date.now()
  const metaPart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: fileName, mimeType }),
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

  try {
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
    console.error('Upload Drive error:', err)
    return res.status(500).json({ error: err.message || 'Erro ao enviar para o Drive' })
  }
}
