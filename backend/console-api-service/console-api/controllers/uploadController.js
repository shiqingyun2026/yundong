const { createOkHandler } = require('./_helpers')
const { createUploadSignature, uploadImageByProxy } = require('../services/uploadService')

const signUpload = createOkHandler('生成上传签名失败', req =>
  createUploadSignature({
    filename: req.body && req.body.filename,
    contentType: req.body && req.body.contentType,
    folder: req.body && req.body.folder
  })
)

const uploadImage = createOkHandler('上传图片失败', req =>
  uploadImageByProxy({
    filename: req.body && req.body.filename,
    contentType: req.body && req.body.contentType,
    folder: req.body && req.body.folder,
    fileBase64: req.body && req.body.fileBase64
  })
)

module.exports = {
  signUpload,
  uploadImage
}
