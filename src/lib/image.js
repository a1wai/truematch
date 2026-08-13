/**
 * Attachments are stored inline (localStorage, or a jsonb column when synced),
 * so a 4 MB phone photo has to become something small first. Downscale, then
 * step the JPEG quality down until it fits.
 */
const MAX_EDGE = 1000
const TARGET_BYTES = 220 * 1024

export async function fileToAttachment(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only images can be attached for now')
  }

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Raw decoder errors ("The source image could not be decoded") mean nothing
    // to someone who just picked a photo.
    throw new Error('Could not read that image — try a different one')
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  let dataUrl = ''
  for (const quality of [0.72, 0.6, 0.45, 0.32]) {
    dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length * 0.75 <= TARGET_BYTES) break
  }

  if (dataUrl.length * 0.75 > TARGET_BYTES) {
    throw new Error('That image is too large to send — try a smaller one')
  }

  return {
    kind: 'image',
    name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'photo',
    src: dataUrl,
    width: canvas.width,
    height: canvas.height,
  }
}
