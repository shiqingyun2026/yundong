const { createOkHandler } = require('./_helpers')
const { createUploadSignature } = require('../services/uploadService')

const signUpload = createOkHandler('生成上传签名失败', req =>
  createUploadSignature({
    filename: req.body && req.body.filename,
    contentType: req.body && req.body.contentType,
    folder: req.body && req.body.folder
  })
)

module.exports = {
  signUpload
}
