const { execute, query, withTransaction } = require('../config/db')

const padSerial = (value, width) => `${Number(value) || 0}`.padStart(width, '0')

const formatBizDate = value => {
  const date = value instanceof Date ? value : new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) {
    throw new Error('invalid serial date')
  }

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
    .formatToParts(date)
    .reduce((result, part) => {
      if (part.type !== 'literal') {
        result[part.type] = part.value
      }

      return result
    }, {})

  return `${parts.year}${parts.month}${parts.day}`
}

const ensureBizSerialCountersTable = async executor => {
  await execute(
    `
      create table if not exists biz_serial_counters (
        biz_type varchar(32) not null,
        biz_date varchar(8) not null,
        current_seq int not null default 0,
        created_at datetime not null default current_timestamp,
        updated_at datetime not null default current_timestamp on update current_timestamp,
        primary key (biz_type, biz_date)
      )
    `,
    [],
    executor
  )
}

const nextSerial = async ({ bizType, bizDate = new Date(), executor = null }) => {
  if (!bizType) {
    throw new Error('bizType is required')
  }

  const resolvedDate = formatBizDate(bizDate)

  const run = async transaction => {
    await ensureBizSerialCountersTable(transaction.connection)

    await transaction.execute(
      `
        insert into biz_serial_counters (biz_type, biz_date, current_seq)
        values (?, ?, 1)
        on duplicate key update current_seq = last_insert_id(current_seq + 1)
      `,
      [bizType, resolvedDate]
    )

    const rows = await transaction.query('select last_insert_id() as current_seq')
    return {
      biz_type: bizType,
      biz_date: resolvedDate,
      current_seq: Number(rows[0] && rows[0].current_seq) || 0
    }
  }

  if (executor && executor.connection && executor.execute && executor.query) {
    return run(executor)
  }

  return withTransaction(run)
}

const buildPackageId = async (now = new Date(), executor = null) => {
  const result = await nextSerial({ bizType: 'PKG', bizDate: now, executor })
  return `PKG-${result.biz_date}-${padSerial(result.current_seq, 4)}`
}

const buildPackageGroupId = async (now = new Date(), executor = null) => {
  const result = await nextSerial({ bizType: 'PG', bizDate: now, executor })
  return `PG-${result.biz_date}-${padSerial(result.current_seq, 5)}`
}

const buildPackageOrderNo = async (now = new Date(), executor = null) => {
  const result = await nextSerial({ bizType: 'LDPKG', bizDate: now, executor })
  return `LDPKG-${result.biz_date}-${padSerial(result.current_seq, 6)}`
}

module.exports = {
  buildPackageGroupId,
  buildPackageId,
  buildPackageOrderNo,
  ensureBizSerialCountersTable,
  formatBizDate,
  nextSerial
}
