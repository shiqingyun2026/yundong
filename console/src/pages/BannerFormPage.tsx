import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { PageBackButton } from '../components/PageBackButton'
import { api, uploadImage } from '../lib/api'
import type { BannerDetail, BannerJumpType } from '../types'
import { toDateTimeLocal } from './courseFormHelpers'

type BannerPageMode = 'create' | 'edit' | 'view'

const emptyBanner: BannerDetail = {
  id: '',
  image_url: '',
  title: '',
  jump_type: 'none',
  jump_target: '',
  sort: 0,
  online_time: '',
  offline_time: '',
  status: 'pending'
}

const buildPayload = (form: BannerDetail) => ({
  image_url: form.image_url.trim(),
  title: form.title.trim(),
  jump_type: form.jump_type,
  jump_target: form.jump_target.trim(),
  sort: Number(form.sort) || 0,
  online_time: form.online_time || '',
  offline_time: form.offline_time || ''
})

const getNowLocalInputValue = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
}

export function BannerFormPage({ mode }: { mode: BannerPageMode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<BannerDetail>(emptyBanner)
  const [loading, setLoading] = useState(mode !== 'create')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [localPreviewUrl, setLocalPreviewUrl] = useState('')

  const pageTitle = mode === 'create' ? '新建 Banner' : mode === 'edit' ? '编辑 Banner' : 'Banner 详情'
  const copyFrom = searchParams.get('copyFrom') || ''
  const isReadOnly = mode === 'view'
  const isEditable = !isReadOnly && (mode === 'create' || form.status !== 'active')

  useEffect(() => {
    void (async () => {
      try {
        if (mode === 'create' && copyFrom) {
          const data = await api.get<BannerDetail>(`/banners/${copyFrom}`)
          setForm({
            ...data,
            id: '',
            title: data.title ? `${data.title} - 副本` : '',
            online_time: '',
            offline_time: '',
            status: 'pending'
          })
          setLoading(false)
          return
        }

        if (mode === 'create' || !id) {
          setLoading(false)
          return
        }

        const data = await api.get<BannerDetail>(`/banners/${id}`)
        setForm({
          ...data,
          online_time: toDateTimeLocal(data.online_time),
          offline_time: toDateTimeLocal(data.offline_time)
        })
        setLocalPreviewUrl('')
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '获取 Banner 详情失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [copyFrom, id, mode])

  const updateField = <K extends keyof BannerDetail>(key: K, value: BannerDetail[K]) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const nextPreviewUrl = URL.createObjectURL(file)

    try {
      setUploading(true)
      setError('')
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
      }
      setLocalPreviewUrl(nextPreviewUrl)
      const imageUrl = await uploadImage(file, 'course-cover')
      updateField('image_url', imageUrl)
    } catch (uploadError) {
      URL.revokeObjectURL(nextPreviewUrl)
      setLocalPreviewUrl('')
      setError(uploadError instanceof Error ? uploadError.message : '上传 Banner 图片失败')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
      }
    }
  }, [localPreviewUrl])

  const validateBeforeSubmit = () => {
    if (!form.image_url.trim()) {
      return '请先上传 Banner 图片'
    }

    if (!form.title.trim()) {
      return 'Banner 标题不能为空'
    }

    if (!form.online_time) {
      return '请选择上线时间'
    }

    const onlineTime = new Date(form.online_time)
    if (Number.isNaN(onlineTime.getTime())) {
      return '上线时间格式不正确'
    }

    if (mode === 'create' && onlineTime.getTime() <= Date.now()) {
      return '上线时间必须晚于当前时间'
    }

    if (form.offline_time) {
      const offlineTime = new Date(form.offline_time)
      if (Number.isNaN(offlineTime.getTime())) {
        return '下线时间格式不正确'
      }

      if (offlineTime.getTime() <= onlineTime.getTime()) {
        return '下线时间必须晚于上线时间'
      }
    }

    return ''
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!isEditable) {
      return
    }

    const validationMessage = validateBeforeSubmit()
    if (validationMessage) {
      setError(validationMessage)
      return
    }

    try {
      setSaving(true)
      setError('')
      const payload = buildPayload(form)

      if (mode === 'create') {
        const created = await api.post<BannerDetail>('/banners', payload)
        navigate(`/banners/${created.id}`)
        return
      }

      if (!id) {
        throw new Error('缺少 Banner ID')
      }

      const updated = await api.put<BannerDetail>(`/banners/${id}`, payload)
      navigate(`/banners/${updated.id}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存 Banner 失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="stack">
      <section className="panel">
        <div className="page-actions">
          <PageBackButton fallback="/banners" />
          <div className="page-actions">
            {isReadOnly && id && form.status !== 'active' ? (
              <Link className="secondary-button link-button compact-action-button" to={`/banners/${id}/edit`}>
                编辑 Banner
              </Link>
            ) : null}
            {isReadOnly && id ? (
              <Link className="secondary-button link-button compact-action-button" to={`/banners/new?copyFrom=${id}`}>
                复制 Banner
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <form className="stack" onSubmit={handleSubmit}>
        <section className="panel">
          <div className="search-panel-head">
            <div>
              <p className="section-kicker">Banner Editor</p>
              <h3>{pageTitle}</h3>
            </div>
          </div>

          {loading ? <p className="muted-text">加载中...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {!loading && form.status === 'active' && mode === 'edit' ? <p className="error-text">已上线 Banner 不可编辑，请先返回列表执行下线。</p> : null}

          {!loading ? (
            <div className="form-grid">
              <label className="filter-field">
                <span>Banner 标题</span>
                <input value={form.title} disabled={!isEditable} onChange={event => updateField('title', event.target.value)} />
              </label>
              <label className="filter-field">
                <span>跳转类型</span>
                <select value={form.jump_type} disabled={!isEditable} onChange={event => updateField('jump_type', event.target.value as BannerJumpType)}>
                  <option value="none">不跳转</option>
                  <option value="packageDetail">课程详情</option>
                  <option value="customUrl">外部链接</option>
                  <option value="miniprogramPage">站内页面</option>
                </select>
              </label>
              <label className="filter-field">
                <span>跳转目标</span>
                <input value={form.jump_target} disabled={!isEditable} onChange={event => updateField('jump_target', event.target.value)} />
              </label>
              <label className="filter-field">
                <span>排序（数字越小，越靠前）</span>
                <input type="number" value={form.sort} disabled={!isEditable} onChange={event => updateField('sort', Number(event.target.value) || 0)} />
              </label>
              <label className="filter-field">
                <span>上线时间</span>
                <input
                  type="datetime-local"
                  min={mode === 'create' ? getNowLocalInputValue() : undefined}
                  value={form.online_time}
                  disabled={!isEditable}
                  onChange={event => updateField('online_time', event.target.value)}
                />
              </label>
              <label className="filter-field">
                <span>下线时间</span>
                <input
                  type="datetime-local"
                  value={form.offline_time}
                  disabled={!isEditable}
                  onChange={event => updateField('offline_time', event.target.value)}
                />
              </label>
              <div className="filter-field filter-field-full">
                <span>Banner 图片</span>
                {localPreviewUrl || form.image_url ? (
                  <img className="image-preview" src={localPreviewUrl || form.image_url} alt="Banner" />
                ) : (
                  <div className="upload-placeholder">暂未上传图片</div>
                )}
                {isEditable ? (
                  <label className="secondary-button link-button compact-action-button" style={{ width: 'fit-content' }}>
                    {uploading ? '上传中...' : '上传图片'}
                    <input type="file" accept="image/*" hidden onChange={event => void handleImageUpload(event)} />
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {isEditable ? (
          <section className="panel">
            <div className="page-actions page-actions-end">
              <button className="primary-button compact-action-button" type="submit" disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </section>
        ) : null}
      </form>
    </section>
  )
}
