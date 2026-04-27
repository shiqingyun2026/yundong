const { withTransaction } = require('../../config/db')
const { userIdentitiesRepository, usersRepository } = require('../../repositories')

const reassignSimpleUserReference = async ({ table, column, fromUserId, toUserId }, transaction) => {
  await transaction.execute(
    `
      update ${table}
      set ${column} = ?
      where ${column} = ?
    `,
    [toUserId, fromUserId]
  )
}

const moveGroupMembers = async ({ fromUserId, toUserId }, transaction) => {
  await transaction.execute(
    `
      delete gm_from
      from group_members gm_from
      inner join group_members gm_to
        on gm_from.group_id = gm_to.group_id
       and gm_to.user_id = ?
      where gm_from.user_id = ?
    `,
    [toUserId, fromUserId]
  )

  await transaction.execute(
    `
      update group_members
      set user_id = ?
      where user_id = ?
    `,
    [toUserId, fromUserId]
  )
}

const mergeUserAccountsByPhone = async ({ phone, currentUserId, currentOpenId = '' }) => {
  const normalizedPhone = `${phone || ''}`.trim()
  const normalizedOpenId = `${currentOpenId || ''}`.trim()

  if (!normalizedPhone || !currentUserId) {
    throw new Error('phone and currentUserId are required')
  }

  const existingPhoneUser = await usersRepository.findUserByPhone(normalizedPhone)

  if (!existingPhoneUser || existingPhoneUser.id === currentUserId) {
    return {
      merged: false,
      userId: currentUserId
    }
  }

  await withTransaction(async transaction => {
    await reassignSimpleUserReference(
      {
        table: 'orders',
        column: 'user_id',
        fromUserId: currentUserId,
        toUserId: existingPhoneUser.id
      },
      transaction
    )

    await reassignSimpleUserReference(
      {
        table: 'payment_records',
        column: 'user_id',
        fromUserId: currentUserId,
        toUserId: existingPhoneUser.id
      },
      transaction
    )

    await reassignSimpleUserReference(
      {
        table: 'groups',
        column: 'creator_id',
        fromUserId: currentUserId,
        toUserId: existingPhoneUser.id
      },
      transaction
    )

    await reassignSimpleUserReference(
      {
        table: 'package_groups',
        column: 'creator_id',
        fromUserId: currentUserId,
        toUserId: existingPhoneUser.id
      },
      transaction
    )

    await moveGroupMembers(
      {
        fromUserId: currentUserId,
        toUserId: existingPhoneUser.id
      },
      transaction
    )

    await reassignSimpleUserReference(
      {
        table: 'group_result_subscriptions',
        column: 'user_id',
        fromUserId: currentUserId,
        toUserId: existingPhoneUser.id
      },
      transaction
    )

    await reassignSimpleUserReference(
      {
        table: 'group_result_notification_jobs',
        column: 'user_id',
        fromUserId: currentUserId,
        toUserId: existingPhoneUser.id
      },
      transaction
    )

    await transaction.execute(
      `
        update user_identities
        set user_id = ?,
            updated_at = ?,
            last_used_at = ?
        where user_id = ?
      `,
      [
        existingPhoneUser.id,
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        currentUserId
      ]
    )

    if (normalizedOpenId) {
      await userIdentitiesRepository.assignIdentityToUser(
        {
          userId: existingPhoneUser.id,
          identityType: 'wechat_openid',
          identityKey: normalizedOpenId
        },
        transaction.connection
      )
    }

    await transaction.execute('delete from users where id = ?', [currentUserId])
  })

  return {
    merged: true,
    userId: existingPhoneUser.id
  }
}

module.exports = {
  mergeUserAccountsByPhone
}
