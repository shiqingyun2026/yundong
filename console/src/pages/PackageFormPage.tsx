import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageBackButton } from '../components/PageBackButton'
import { api, uploadImage } from '../lib/api'
import type { PackageDetail } from '../types'

type PackagePageMode = 'create' | 'edit' | 'view'

const RequiredMark = () => <span className="required-mark">*</span>

const emptyPackage: PackageDetail = {
  id: '',
  name: '',
  cover: '',
  total_price_fen: 0,
  total_price_text: '',
  package_category: '体适能',
  supported_people: [],
  location_text: '',
  location_district: '',
  location_community: '',
  location_detail: '',
  coach_name: '',
  status: 'active',
  deadline_hours: 48,
  create_time: '',
  update_time: '',
  images: [],
  longitude: null,
  latitude: null,
  coach_intro: '',
  coach_certificates: [],
  description: ''
}

const splitLines = (value: string) =>
  value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)

const parseSupportedPeople = (value: string) => {
  const values = value
    .split(/[，,\s]+/)
    .map(item => Number(item.trim()))
    .filter(item => Number.isInteger(item) && item > 0)

  return [...new Set(values)].sort((a, b) => a - b)
}

const formatSupportedPeopleInput = (supportedPeople: number[]) => supportedPeople.join(', ')

const buildPayload = (form: PackageDetail) => ({
  name: form.name.trim(),
  package_category: form.package_category,
  cover: form.cover.trim(),
  images: form.images.filter(Boolean),
  total_price_fen: Number(form.total_price_fen) || 0,
  supported_people: form.supported_people,
  location_district: form.location_district.trim(),
  location_community: form.location_community.trim(),
  location_detail: form.location_detail.trim(),
  longitude: form.longitude,
  latitude: form.latitude,
  coach_name: form.coach_name.trim(),
  coach_intro: form.coach_intro.trim(),
  coach_certificates: form.coach_certificates.filter(Boolean),
  description: form.description.trim(),
  status: form.status,
  deadline_hours: Number(form.deadline_hours) || 48
})

export function PackageFormPage({ mode }: { mode: PackagePageMode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [form, setForm] = useState<PackageDetail>(emptyPackage)
  const [supportedPeopleInput, setSupportedPeopleInput] = useState('')
  const [loading, setLoading] = useState(mode !== 'create')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode === 'create' || !id) {
      setSupportedPeopleInput(formatSupportedPeopleInput(emptyPackage.supported_people))
      return
    }

    void (async () => {
      try {
        const data = await api.get<PackageDetail>(`/packages/${id}`)
        setForm(data)
        setSupportedPeopleInput(formatSupportedPeopleInput(data.supported_people || []))
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '获取课包详情失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, mode])

  const isReadOnly = mode === 'view'
  const pageTitle = mode === 'create' ? '新建课包' : mode === 'edit' ? '编辑课包' : '课包详情'
  const supportedPeopleText = useMemo(
    () => (form.supported_people.length ? form.supported_people.map(item => `${item}人团`).join(' / ') : '-'),
    [form.supported_people]
  )

  const updateField = <K extends keyof PackageDetail>(key: K, value: PackageDetail[K]) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const supportedPeople = parseSupportedPeople(supportedPeopleInput)
    if (!supportedPeople.length) {
      setError('请至少填写一个支持人数，例如 2,3,4')
      setSaving(false)
      return
    }

    try {
      const payload = buildPayload({
        ...form,
        supported_people: supportedPeople
      })

      if (mode === 'edit' && id) {
        await api.put(`/packages/${id}`, payload)
      } else {
        await api.post('/packages', payload)
      }
      navigate('/packages')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存课包失败')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadSingle = async (
    event: ChangeEvent<HTMLInputElement>,
    field: 'cover',
    folder: 'course-cover'
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploading('上传图片中...')
    setError('')

    try {
      const url = await uploadImage(file, folder)
      updateField(field, url)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败')
    } finally {
      setUploading('')
      event.target.value = ''
    }
  }

  const handleUploadMultiple = async (
    event: ChangeEvent<HTMLInputElement>,
    field: 'images' | 'coach_certificates',
    folder: 'course-gallery' | 'coach-cert'
  ) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) {
      return
    }

    setUploading('上传图片中...')
    setError('')

    try {
      const urls = []
      for (const file of files) {
        urls.push(await uploadImage(file, folder))
      }
      updateField(field, [...form[field], ...urls] as PackageDetail[typeof field])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败')
    } finally {
      setUploading('')
      event.target.value = ''
    }
  }

  const removeArrayItem = (field: 'images' | 'coach_certificates', index: number) => {
    updateField(
      field,
      form[field].filter((_, currentIndex) => currentIndex !== index) as PackageDetail[typeof field]
    )
  }

  return (
    <section className="panel stack">
      <div className="stack compact-stack">
        <PageBackButton fallback="/packages" />
        <div className="page-actions">
          <div>
            <p className="section-kicker">Package Editor</p>
            <h3>{pageTitle}</h3>
          </div>
          {mode !== 'create' && id ? (
            <div className="button-row">
              {mode === 'view' ? (
                <Link className="secondary-button" to={`/packages/${id}/edit`}>
                  编辑
                </Link>
              ) : null}
              <Link className="secondary-button" to={`/package-groups?package_id=${id}`}>
                查看拼团
              </Link>
              <Link className="secondary-button" to={`/package-orders?package_id=${id}`}>
                查看订单
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {loading ? <p className="muted-text">加载中...</p> : null}

      {!loading ? (
        <form className="stack" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              <span>课包名称<RequiredMark /></span>
              <input value={form.name} onChange={event => updateField('name', event.target.value)} disabled={isReadOnly} />
            </label>
            <label>
              <span>课包类型<RequiredMark /></span>
              <select
                value={form.package_category}
                onChange={event => updateField('package_category', event.target.value as PackageDetail['package_category'])}
                disabled={isReadOnly}
              >
                <option value="体适能">体适能</option>
                <option value="跳绳">跳绳</option>
              </select>
            </label>
            <label>
              <span>总价（分）<RequiredMark /></span>
              <input
                type="number"
                min="1"
                value={form.total_price_fen}
                onChange={event => updateField('total_price_fen', Number(event.target.value))}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>支持人数<RequiredMark /></span>
              <input
                placeholder="例如：2, 3, 4"
                value={supportedPeopleInput}
                onChange={event => {
                  setSupportedPeopleInput(event.target.value)
                  updateField('supported_people', parseSupportedPeople(event.target.value))
                }}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>开团截止时长（小时）</span>
              <input
                type="number"
                min="1"
                value={form.deadline_hours}
                onChange={event => updateField('deadline_hours', Number(event.target.value))}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>所在区域<RequiredMark /></span>
              <input
                value={form.location_district}
                onChange={event => updateField('location_district', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>小区 / 场地名称<RequiredMark /></span>
              <input
                value={form.location_community}
                onChange={event => updateField('location_community', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>详细地点<RequiredMark /></span>
              <input
                value={form.location_detail}
                onChange={event => updateField('location_detail', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>状态<RequiredMark /></span>
              <select
                value={form.status}
                onChange={event => updateField('status', event.target.value as PackageDetail['status'])}
                disabled={isReadOnly}
              >
                <option value="active">上架中</option>
                <option value="inactive">已下架</option>
              </select>
            </label>
            <label>
              <span>经度</span>
              <input
                type="number"
                value={form.longitude ?? ''}
                onChange={event => updateField('longitude', event.target.value ? Number(event.target.value) : null)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>纬度</span>
              <input
                type="number"
                value={form.latitude ?? ''}
                onChange={event => updateField('latitude', event.target.value ? Number(event.target.value) : null)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>教练姓名<RequiredMark /></span>
              <input
                value={form.coach_name}
                onChange={event => updateField('coach_name', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
          </div>

          <div className="stack">
            <label>
              <span>封面图 URL<RequiredMark /></span>
              <input value={form.cover} onChange={event => updateField('cover', event.target.value)} disabled={isReadOnly} />
            </label>
            {!isReadOnly ? (
              <div className="button-row">
                <label className="file-button">
                  点击上传封面图
                  <input type="file" accept="image/*" onChange={event => void handleUploadSingle(event, 'cover', 'course-cover')} />
                </label>
                {uploading ? <span className="muted-text">{uploading}</span> : null}
              </div>
            ) : null}
            {form.cover ? (
              <div className="image-preview-grid single">
                <img className="image-preview" src={form.cover} alt="课包封面" />
              </div>
            ) : null}
          </div>

          <div className="stack">
            <div className="page-actions">
              <div>
                <p className="section-kicker">Gallery</p>
                <h4>课包轮播图</h4>
              </div>
              {!isReadOnly ? (
                <label className="file-button">
                  上传轮播图
                  <input type="file" accept="image/*" multiple onChange={event => void handleUploadMultiple(event, 'images', 'course-gallery')} />
                </label>
              ) : null}
            </div>
            <textarea
              rows={4}
              value={form.images.join('\n')}
              onChange={event => updateField('images', splitLines(event.target.value))}
              disabled={isReadOnly}
            />
            <div className="image-preview-grid">
              {form.images.map((url, index) => (
                <div key={`${url}-${index}`} className="image-tile">
                  <img className="image-preview" src={url} alt={`轮播图${index + 1}`} />
                  {!isReadOnly ? (
                    <button className="ghost-button compact-button" type="button" onClick={() => removeArrayItem('images', index)}>
                      删除
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <label>
            <span>教练简介<RequiredMark /></span>
            <textarea
              rows={4}
              value={form.coach_intro}
              onChange={event => updateField('coach_intro', event.target.value)}
              disabled={isReadOnly}
            />
          </label>

          <div className="stack">
            <div className="page-actions">
              <div>
                <p className="section-kicker">Certificates</p>
                <h4>教练证书</h4>
              </div>
              {!isReadOnly ? (
                <label className="file-button">
                  上传教练证书
                  <input type="file" accept="image/*" multiple onChange={event => void handleUploadMultiple(event, 'coach_certificates', 'coach-cert')} />
                </label>
              ) : null}
            </div>
            <textarea
              rows={4}
              value={form.coach_certificates.join('\n')}
              onChange={event => updateField('coach_certificates', splitLines(event.target.value))}
              disabled={isReadOnly}
            />
            <div className="image-preview-grid">
              {form.coach_certificates.map((url, index) => (
                <div key={`${url}-${index}`} className="image-tile">
                  <img className="image-preview" src={url} alt={`教练证书${index + 1}`} />
                  {!isReadOnly ? (
                    <button
                      className="ghost-button compact-button"
                      type="button"
                      onClick={() => removeArrayItem('coach_certificates', index)}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <label>
            <span>课包介绍<RequiredMark /></span>
            <textarea
              rows={8}
              value={form.description}
              onChange={event => updateField('description', event.target.value)}
              disabled={isReadOnly}
            />
          </label>

          <section className="panel subtle-panel stack">
            <div>
              <p className="section-kicker">Snapshot</p>
              <h4>当前配置摘要</h4>
            </div>
            <div className="detail-grid">
              <div className="detail-card">
                <strong>课包信息</strong>
                <p>课包类型：{form.package_category || '-'}</p>
                <p>支持人数：{supportedPeopleText}</p>
                <p>总价：¥{(Number(form.total_price_fen || 0) / 100).toFixed(2)}</p>
                <p>状态：{form.status === 'active' ? '上架中' : '已下架'}</p>
                <p>截止时长：{form.deadline_hours || 48} 小时</p>
              </div>
              <div className="detail-card">
                <strong>地点信息</strong>
                <p>所在区域：{form.location_district || '-'}</p>
                <p>小区 / 场地：{form.location_community || '-'}</p>
                <p>详细地点：{form.location_detail || '-'}</p>
              </div>
              <div className="detail-card">
                <strong>维护信息</strong>
                <p>创建时间：{form.create_time || '-'}</p>
                <p>更新时间：{form.update_time || '-'}</p>
                <p>教练姓名：{form.coach_name || '-'}</p>
              </div>
            </div>
          </section>

          {error ? <p className="error-text">{error}</p> : null}

          {!isReadOnly ? (
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? '保存中...' : mode === 'create' ? '创建课包' : '保存课包'}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  )
}
