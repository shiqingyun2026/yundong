import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api, uploadImage } from '../lib/api'
import type { CourseDetail } from '../types'

const emptyCourse: CourseDetail = {
  title: '',
  cover: '',
  description: '',
  age_range: '',
  original_price: 0,
  group_price: 0,
  target_count: 2,
  max_groups: 1,
  publish_time: '',
  unpublish_time: '',
  start_time: '',
  end_time: '',
  location_district: '',
  location_detail: '',
  longitude: null,
  latitude: null,
  deadline: '',
  coach_name: '',
  coach_intro: '',
  coach_cert: [],
  rules: ''
}

const toDateTimeLocal = (value: string) => (value ? value.slice(0, 16).replace(' ', 'T') : '')

export function CourseFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [form, setForm] = useState<CourseDetail>(emptyCourse)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const [resolvingGeo, setResolvingGeo] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'edit' || !id) {
      return
    }

    void (async () => {
      try {
        const data = await api.get<CourseDetail>(`/courses/${id}`)
        setForm({
          ...data,
          start_time: toDateTimeLocal(data.start_time),
          end_time: toDateTimeLocal(data.end_time),
          deadline: toDateTimeLocal(data.deadline),
          publish_time: toDateTimeLocal(data.publish_time),
          unpublish_time: toDateTimeLocal(data.unpublish_time)
        })
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '获取课程失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, mode])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (mode === 'edit' && id) {
        await api.put(`/courses/${id}`, form)
      } else {
        await api.post('/courses', form)
      }
      navigate('/courses')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const updateField = <K extends keyof CourseDetail>(key: K, value: CourseDetail[K]) => {
    setForm(current => ({ ...current, [key]: value }))
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

  const handleDescriptionImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploading('上传课程介绍图片中...')
    setError('')

    try {
      const url = await uploadImage(file, 'course-detail')
      const imageMarkup = `<p><img src="${url}" alt="课程介绍图" /></p>`
      updateField('description', `${form.description}\n${imageMarkup}`.trim())
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败')
    } finally {
      setUploading('')
      event.target.value = ''
    }
  }

  const handleUploadMultiple = async (event: ChangeEvent<HTMLInputElement>, field: 'coach_cert', folder: 'coach-cert') => {
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
      updateField(field, [...form[field], ...urls] as CourseDetail[typeof field])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败')
    } finally {
      setUploading('')
      event.target.value = ''
    }
  }

  const splitLines = (value: string) =>
    value
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)

  const removeArrayItem = (field: 'coach_cert', index: number) => {
    updateField(
      field,
      form[field].filter((_, currentIndex) => currentIndex !== index) as CourseDetail[typeof field]
    )
  }

  const resolveCoordinates = async () => {
    setResolvingGeo(true)
    setError('')

    try {
      const data = await api.post<{ formatted_address: string; longitude: number; latitude: number }>(
        '/courses/geocode',
        {
          district: form.location_district,
          detail: form.location_detail
        }
      )

      setForm(current => ({
        ...current,
        longitude: data.longitude,
        latitude: data.latitude
      }))
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : '解析坐标失败')
    } finally {
      setResolvingGeo(false)
    }
  }

  return (
    <section className="panel stack">
      <div>
        <p className="section-kicker">Course Editor</p>
        <h3>{mode === 'edit' ? '编辑课程' : '新建课程'}</h3>
      </div>

      {loading ? <p className="muted-text">加载中...</p> : null}

      {!loading ? (
        <form className="stack" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              课程名称
              <input value={form.title} onChange={event => updateField('title', event.target.value)} />
            </label>
            <label>
              适龄范围
              <input value={form.age_range} onChange={event => updateField('age_range', event.target.value)} />
            </label>
            <label>
              拼团价
              <input
                type="number"
                value={form.group_price}
                onChange={event => updateField('group_price', Number(event.target.value))}
              />
            </label>
            <label>
              原价
              <input
                type="number"
                value={form.original_price}
                onChange={event => updateField('original_price', Number(event.target.value))}
              />
            </label>
            <label>
              成团人数
              <input
                type="number"
                value={form.target_count}
                onChange={event => updateField('target_count', Number(event.target.value))}
              />
            </label>
            <label>
              最大成团次数
              <input
                type="number"
                value={form.max_groups}
                onChange={event => updateField('max_groups', Number(event.target.value))}
              />
            </label>
            <label>
              上架时间
              <input
                type="datetime-local"
                value={form.publish_time}
                onChange={event => updateField('publish_time', event.target.value)}
              />
            </label>
            <label>
              下架时间
              <input
                type="datetime-local"
                value={form.unpublish_time}
                onChange={event => updateField('unpublish_time', event.target.value)}
              />
            </label>
            <label>
              开课时间
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={event => updateField('start_time', event.target.value)}
              />
            </label>
            <label>
              结束时间
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={event => updateField('end_time', event.target.value)}
              />
            </label>
            <label>
              报名截止时间
              <input
                type="datetime-local"
                value={form.deadline}
                onChange={event => updateField('deadline', event.target.value)}
              />
            </label>
            <label>
              所在区域
              <input
                value={form.location_district}
                onChange={event => updateField('location_district', event.target.value)}
              />
            </label>
            <label>
              详细地点
              <input
                value={form.location_detail}
                onChange={event => updateField('location_detail', event.target.value)}
              />
            </label>
            <label>
              经度
              <input
                type="number"
                value={form.longitude ?? ''}
                onChange={event => updateField('longitude', event.target.value ? Number(event.target.value) : null)}
              />
            </label>
            <label>
              纬度
              <input
                type="number"
                value={form.latitude ?? ''}
                onChange={event => updateField('latitude', event.target.value ? Number(event.target.value) : null)}
              />
            </label>
            <label>
              教练姓名
              <input
                value={form.coach_name}
                onChange={event => updateField('coach_name', event.target.value)}
              />
            </label>
          </div>

          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => void resolveCoordinates()} disabled={resolvingGeo}>
              {resolvingGeo ? '解析中...' : '根据详细地点解析坐标'}
            </button>
            <span className="muted-text">支持先自动解析，再手动微调经纬度</span>
          </div>

          <div className="stack">
            <label>
              封面图 URL
              <input value={form.cover} onChange={event => updateField('cover', event.target.value)} />
            </label>
            <div className="button-row">
              <label className="file-button">
                点击上传封面图
                <input type="file" accept="image/*" onChange={event => void handleUploadSingle(event, 'cover', 'course-cover')} />
              </label>
              {uploading ? <span className="muted-text">{uploading}</span> : null}
            </div>
            {form.cover ? (
              <div className="image-preview-grid single">
                <img className="image-preview" src={form.cover} alt="封面图预览" />
              </div>
            ) : null}
          </div>

          <label>
            教练简介
            <textarea
              rows={4}
              value={form.coach_intro}
              onChange={event => updateField('coach_intro', event.target.value)}
            />
          </label>

          <div className="stack">
            <div className="page-actions">
              <div>
                <p className="section-kicker">Certificates</p>
                <h4>教练证书</h4>
              </div>
              <label className="file-button">
                上传教练证书
                <input type="file" accept="image/*" multiple onChange={event => void handleUploadMultiple(event, 'coach_cert', 'coach-cert')} />
              </label>
            </div>
            <textarea
              rows={4}
              value={form.coach_cert.join('\n')}
              onChange={event => updateField('coach_cert', splitLines(event.target.value))}
            />
            <div className="image-preview-grid">
              {form.coach_cert.map((url, index) => (
                <div key={`${url}-${index}`} className="image-tile">
                  <img className="image-preview" src={url} alt={`教练证书${index + 1}`} />
                  <button className="ghost-button compact-button" type="button" onClick={() => removeArrayItem('coach_cert', index)}>
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label>
            课程介绍
            <textarea
              rows={8}
              value={form.description}
              onChange={event => updateField('description', event.target.value)}
            />
          </label>

          <div className="button-row">
            <label className="file-button">
              上传课程介绍图片
              <input type="file" accept="image/*" onChange={event => void handleDescriptionImageUpload(event)} />
            </label>
            <span className="muted-text">上传后会把图片标签直接插入课程介绍内容</span>
          </div>

          <div className="description-preview">
            <p className="section-kicker">Description Preview</p>
            <div
              className="rich-preview"
              dangerouslySetInnerHTML={{ __html: form.description || '<p class="muted-text">暂无内容</p>' }}
            />
          </div>

          <label>
            拼团规则
            <textarea
              rows={3}
              value={form.rules || ''}
              onChange={event => updateField('rules', event.target.value)}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="button-row">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存课程'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
