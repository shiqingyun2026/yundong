# lindong-cron

CloudBase scheduled function for calling protected internal APIs on `lindong-api`.

## Required environment variables

- `LINDONG_API_BASE_URL`
  - Example: `https://<your-lindong-api-domain>`
- `CRON_SECRET`
  - Must exactly match the `CRON_SECRET` configured on the CloudBase-hosted `lindong-api` service.

## Default behavior

If invoked without custom event payload, the function calls:

- `POST /api/internal/group-result-notifications/process`

## Diagnose

You can manually verify configuration with:

```js
wx.cloud.callFunction({
  name: 'lindong-cron',
  data: { type: 'diagnose' },
  success: res => console.log('lindong-cron diagnose:', res),
  fail: err => console.error('lindong-cron diagnose failed:', err)
})
```

## Custom targets

You can also run multiple internal jobs manually:

```js
wx.cloud.callFunction({
  name: 'lindong-cron',
  data: {
    targets: [
      '/api/internal/course-lifecycle/sync',
      '/api/internal/package-lifecycle/sync',
      '/api/internal/package-groups/cleanup-expired',
      '/api/internal/group-result-notifications/process'
    ]
  }
})
```
