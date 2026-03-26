import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageBackButton } from '../components/PageBackButton'
import { api, uploadImage } from '../lib/api'
import type { CourseDetail, CourseGroupRecord } from '../types'

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

const getGroupStatusText = (status: CourseGroupRecord['status']) => {
  if (status === 'success') return '已成团'
  if (status === 'failed') return '已失败'
  return '进行中'
}

const REGION_OPTIONS = [
  {
    label: '广东省',
    value: '广东省',
    cities: [
      {
        label: '深圳市',
        value: '深圳市',
        districts: [
          '福田区',
          '罗湖区',
          '南山区',
          '宝安区',
          '龙岗区',
          '龙华区',
          '盐田区',
          '坪山区',
          '光明区'
        ]
      }
    ]
  }
]

const RequiredMark = () => <span className="required-mark">*</span>

type CoursePageMode = 'create' | 'edit' | 'view'

export function CourseFormPage({ mode }: { mode: CoursePageMode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [form, setForm] = useState<CourseDetail>(emptyCourse)
  const [loading, setLoading] = useState(mode !== 'create')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const [resolvingGeo, setResolvingGeo] = useState(false)
  const [error, setError] = useState('')
  const [groupItems, setGroupItems] = useState<CourseGroupRecord[]>([])
  const [groupsLoading, setGroupsLoading] = useState(mode !== 'create')
  const [groupsError, setGroupsError] = useState('')
  const [province, setProvince] = useState('广东省')
  const [city, setCity] = useState('深圳市')
  const [district, setDistrict] = useState('')

  useEffect(() => {
    if (mode === 'create' || !id) {
      return
    }

    void (async () => {
      try {
        const data = await api.get<CourseDetail>(`/courses/${id}`)
        const districtParts = `${data.location_district || ''}`
          .split(/[\/\s-]+/)
          .map(item => item.trim())
          .filter(Boolean)
        setProvince(districtParts[0] || '广东省')
        setCity(districtParts[1] || '深圳市')
        setDistrict(districtParts[2] || districtParts[1] || '')
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

  useEffect(() => {
    if (mode === 'create' || !id) {
      setGroupsLoading(false)
      return
    }

    void (async () => {
      setGroupsLoading(true)
      setGroupsError('')

      try {
        const data = await api.get<CourseGroupRecord[]>(`/courses/${id}/groups`)
        setGroupItems(data || [])
      } catch (fetchError) {
        setGroupsError(fetchError instanceof Error ? fetchError.message : '获取课程拼团记录失败')
      } finally {
        setGroupsLoading(false)
      }
    })()
  }, [id, mode])

  const canEditCourse = form.status === 0 || form.status === 2
  const canOfflineCourse = form.status === 0 || form.status === 2 || form.status === 5
  const canEdit = mode === 'create' || (mode === 'edit' && canEditCourse)
  const isReadOnly = mode === 'view' || !canEdit
  const cityOptions = REGION_OPTIONS.find(item => item.value === province)?.cities || []
  const districtOptions = cityOptions.find(item => item.value === city)?.districts || []

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    if (mode === 'create' && (!province || !city || !district)) {
      setError('新建课程时，请先完成省 / 市 / 区三级选择')
      setSaving(false)
      return
    }

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

  const updateRegionField = (nextProvince: string, nextCity: string, nextDistrict: string) => {
    setProvince(nextProvince)
    setCity(nextCity)
    setDistrict(nextDistrict)
    updateField(
      'location_district',
      [nextProvince, nextCity, nextDistrict].filter(Boolean).join(' / ')
    )
  }

  const offlineCourse = async () => {
    if (!id || !canOfflineCourse) {
      return
    }

    if (!window.confirm('确认下架该课程吗？')) {
      return
    }

    setError('')

    try {
      await api.put(`/courses/${id}/offline`)
      navigate('/courses')
    } catch (offlineError) {
      setError(offlineError instanceof Error ? offlineError.message : '下架课程失败')
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

  const groupSummary = groupItems.reduce(
    (result, item) => {
      result.total += 1
      if (item.status === 'active') result.active += 1
      if (item.status === 'success') result.success += 1
      if (item.status === 'failed') result.failed += 1
      return result
    },
    { total: 0, active: 0, success: 0, failed: 0 }
  )

  return (
    <section className="panel stack">
      <div className="stack compact-stack">
        <PageBackButton fallback="/courses" />
        <div className="page-actions">
          <div>
            <p className="section-kicker">Course Editor</p>
            <h3>{mode === 'create' ? '新建课程' : mode === 'view' ? '课程详情' : '编辑课程'}</h3>
          </div>
          {mode !== 'create' && id ? (
            <div className="button-row">
              {canEditCourse ? (
                <Link className="secondary-button" to={`/courses/${id}/edit`}>
                  编辑
                </Link>
              ) : null}
              <Link className="secondary-button" to={`/groups?course_id=${id}`}>
                查看拼团
              </Link>
              {canOfflineCourse ? (
                <button className="ghost-button" type="button" onClick={() => void offlineCourse()}>
                  下架
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? <p className="muted-text">加载中...</p> : null}

      {!loading ? (
        <form className="stack" onSubmit={handleSubmit}>
          {mode === 'edit' && !canEdit ? (
            <p className="muted-text">当前课程状态仅支持查看，不允许编辑。只有待上架和拼团失败状态可编辑。</p>
          ) : null}
          <div className="form-grid">
            <label>
              <span>课程名称<RequiredMark /></span>
              <input value={form.title} onChange={event => updateField('title', event.target.value)} disabled={isReadOnly} />
            </label>
            <label>
              <span>适龄范围<RequiredMark /></span>
              <input value={form.age_range} onChange={event => updateField('age_range', event.target.value)} disabled={isReadOnly} />
            </label>
            <label>
              <span>拼团价<RequiredMark /></span>
              <input
                type="number"
                value={form.group_price}
                onChange={event => updateField('group_price', Number(event.target.value))}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>原价<RequiredMark /></span>
              <input
                type="number"
                value={form.original_price}
                onChange={event => updateField('original_price', Number(event.target.value))}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>成团人数要求<RequiredMark /></span>
              <input
                type="number"
                value={form.target_count}
                onChange={event => updateField('target_count', Number(event.target.value))}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>最大成团数量<RequiredMark /></span>
              <input
                type="number"
                value={form.max_groups}
                onChange={event => updateField('max_groups', Number(event.target.value))}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>上架时间<RequiredMark /></span>
              <input
                type="datetime-local"
                value={form.publish_time}
                onChange={event => updateField('publish_time', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              下架时间
              <input
                type="datetime-local"
                value={form.unpublish_time}
                onChange={event => updateField('unpublish_time', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>上课时间<RequiredMark /></span>
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={event => updateField('start_time', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>下课时间<RequiredMark /></span>
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={event => updateField('end_time', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              <span>报名截止时间<RequiredMark /></span>
              <input
                type="datetime-local"
                value={form.deadline}
                onChange={event => updateField('deadline', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
            {mode === 'create' ? (
              <>
                <label>
                  <span>省<RequiredMark /></span>
                  <select
                    value={province}
                    onChange={event => {
                      const nextProvince = event.target.value
                      const nextCity = REGION_OPTIONS.find(item => item.value === nextProvince)?.cities[0]?.value || ''
                      updateRegionField(nextProvince, nextCity, '')
                    }}
                    disabled={isReadOnly}
                  >
                    {REGION_OPTIONS.map(item => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>市<RequiredMark /></span>
                  <select
                    value={city}
                    onChange={event => updateRegionField(province, event.target.value, '')}
                    disabled={isReadOnly}
                  >
                    {cityOptions.map(item => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>区<RequiredMark /></span>
                  <select
                    value={district}
                    onChange={event => updateRegionField(province, city, event.target.value)}
                    disabled={isReadOnly}
                  >
                    <option value="">请选择区</option>
                    {districtOptions.map(item => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label>
                所在区域
                <input
                  value={form.location_district}
                  onChange={event => updateField('location_district', event.target.value)}
                  disabled={isReadOnly}
                />
              </label>
            )}
            <label>
              <span>详细地点<RequiredMark /></span>
              <input
                value={form.location_detail}
                onChange={event => updateField('location_detail', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              经度
              <input
                type="number"
                value={form.longitude ?? ''}
                onChange={event => updateField('longitude', event.target.value ? Number(event.target.value) : null)}
                disabled={isReadOnly}
              />
            </label>
            <label>
              纬度
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

          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => void resolveCoordinates()} disabled={resolvingGeo || isReadOnly}>
              {resolvingGeo ? '解析中...' : '根据详细地点解析坐标'}
            </button>
            <span className="muted-text">支持先自动解析，再手动微调经纬度</span>
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
                <img className="image-preview" src={form.cover} alt="封面图预览" />
              </div>
            ) : null}
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
                  <input type="file" accept="image/*" multiple onChange={event => void handleUploadMultiple(event, 'coach_cert', 'coach-cert')} />
                </label>
              ) : null}
            </div>
            <textarea
              rows={4}
              value={form.coach_cert.join('\n')}
              onChange={event => updateField('coach_cert', splitLines(event.target.value))}
              disabled={isReadOnly}
            />
            <div className="image-preview-grid">
              {form.coach_cert.map((url, index) => (
                <div key={`${url}-${index}`} className="image-tile">
                  <img className="image-preview" src={url} alt={`教练证书${index + 1}`} />
                  {!isReadOnly ? (
                    <button className="ghost-button compact-button" type="button" onClick={() => removeArrayItem('coach_cert', index)}>
                      删除
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <label>
            <span>课程介绍<RequiredMark /></span>
            <textarea
              rows={8}
              value={form.description}
              onChange={event => updateField('description', event.target.value)}
              disabled={isReadOnly}
            />
          </label>

          {!isReadOnly ? (
            <div className="button-row">
              <label className="file-button">
                上传课程介绍图片
                <input type="file" accept="image/*" onChange={event => void handleDescriptionImageUpload(event)} />
              </label>
              <span className="muted-text">上传后会把图片标签直接插入课程介绍内容</span>
            </div>
          ) : null}

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
              disabled={isReadOnly}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          {!isReadOnly ? (
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? '保存中...' : '保存课程'}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}

      {mode !== 'create' && id ? (
        <section className="panel subtle-panel stack">
          <div>
            <p className="section-kicker">Course Groups</p>
            <h3>拼团记录</h3>
          </div>

          {groupsLoading ? <p className="muted-text">加载拼团记录中...</p> : null}
          {groupsError ? <p className="error-text">{groupsError}</p> : null}

          {!groupsLoading && !groupsError ? (
            <>
              <section className="stats-grid">
                <article className="stat-card">
                  <span>累计开团</span>
                  <strong>{groupSummary.total}</strong>
                </article>
                <article className="stat-card">
                  <span>进行中</span>
                  <strong>{groupSummary.active}</strong>
                </article>
                <article className="stat-card">
                  <span>已成团</span>
                  <strong>{groupSummary.success}</strong>
                </article>
                <article className="stat-card">
                  <span>已失败</span>
                  <strong>{groupSummary.failed}</strong>
                </article>
              </section>

              {groupItems.length ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>拼团ID</th>
                      <th>状态</th>
                      <th>当前人数</th>
                      <th>成团人数要求</th>
                      <th>开团人</th>
                      <th>团截止时间</th>
                      <th>创建时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{getGroupStatusText(item.status)}</td>
                        <td>{item.current_count}</td>
                        <td>{item.target_count}</td>
                        <td>{item.creator_name || '-'}</td>
                        <td>{item.expire_time || '-'}</td>
                        <td>{item.create_time || '-'}</td>
                        <td>
                          <Link className="table-link" to={`/groups/${item.id}`}>
                            查看详情
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted-text">当前课程还没有产生拼团记录，后续开团后会在这里展示历史团和进行中团。</p>
              )}
            </>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}
