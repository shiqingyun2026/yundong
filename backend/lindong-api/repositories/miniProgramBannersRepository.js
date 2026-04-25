const { execute, query, withTransaction } = require('../config/db')
const { toDbDateTime } = require('./_helpers')

const TABLE_NAME = 'mini_program_banners'

const toIsoString = value => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const mapBannerRow = row => ({
  id: row.id,
  image_url: row.image_url || '',
  title: row.title || '',
  jump_type: row.jump_type || 'none',
  jump_target: row.jump_target || '',
  sort: Number(row.sort || 0),
  online_time: toIsoString(row.online_time),
  offline_time: toIsoString(row.offline_time),
  status: row.status || '',
  created_at: toIsoString(row.created_at),
  updated_at: toIsoString(row.updated_at)
})

const listBanners = async () => {
  const rows = await query(
    `
      select
        id,
        image_url,
        title,
        jump_type,
        jump_target,
        sort,
        online_time,
        offline_time,
        status,
        created_at,
        updated_at
      from ${TABLE_NAME}
      order by sort asc, updated_at desc
    `
  )

  return rows.map(mapBannerRow)
}

const replaceBanners = async banners => {
  const normalized = Array.isArray(banners) ? banners : []

  await withTransaction(async tx => {
    await tx.execute(`delete from ${TABLE_NAME}`)

    for (const item of normalized) {
      await tx.execute(
        `
          insert into ${TABLE_NAME} (
            id,
            image_url,
            title,
            jump_type,
            jump_target,
            sort,
            online_time,
            offline_time,
            status,
            created_at,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          item.id,
          item.image_url || '',
          item.title || '',
          item.jump_type || 'none',
          item.jump_target || '',
          Number(item.sort || 0),
          toDbDateTime(item.online_time),
          toDbDateTime(item.offline_time),
          item.status || '',
          toDbDateTime(item.created_at) || toDbDateTime(new Date()),
          toDbDateTime(item.updated_at) || toDbDateTime(new Date())
        ]
      )
    }
  })

  return listBanners()
}

const upsertBanner = async item => {
  await execute(
    `
      insert into ${TABLE_NAME} (
        id,
        image_url,
        title,
        jump_type,
        jump_target,
        sort,
        online_time,
        offline_time,
        status,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on duplicate key update
        image_url = values(image_url),
        title = values(title),
        jump_type = values(jump_type),
        jump_target = values(jump_target),
        sort = values(sort),
        online_time = values(online_time),
        offline_time = values(offline_time),
        status = values(status),
        updated_at = values(updated_at)
    `,
    [
      item.id,
      item.image_url || '',
      item.title || '',
      item.jump_type || 'none',
      item.jump_target || '',
      Number(item.sort || 0),
      toDbDateTime(item.online_time),
      toDbDateTime(item.offline_time),
      item.status || '',
      toDbDateTime(item.created_at) || toDbDateTime(new Date()),
      toDbDateTime(item.updated_at) || toDbDateTime(new Date())
    ]
  )
}

module.exports = {
  listBanners,
  replaceBanners,
  upsertBanner
}
