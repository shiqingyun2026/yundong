const { paymentRecordsRepository } = require('../../repositories')

const markPaymentRecordRefunded = async ({ orderId, reason = '', now = new Date() }) => {
  const paymentRecord = await paymentRecordsRepository.findPaymentRecordByOrderId(orderId)
  if (!paymentRecord) {
    return null
  }

  const existingCallbackPayload =
    paymentRecord.callback_payload && typeof paymentRecord.callback_payload === 'object'
      ? paymentRecord.callback_payload
      : {}
  const timestamp = now.toISOString()

  return paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
    status: 'refunded',
    callback_status: 'REFUNDED',
    callback_payload: {
      ...existingCallbackPayload,
      refund: {
        reason: `${reason || ''}`.trim(),
        refunded_at: timestamp
      }
    },
    closed_at: paymentRecord.closed_at || timestamp,
    updated_at: timestamp
  })
}

module.exports = {
  markPaymentRecordRefunded
}
