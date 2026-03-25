import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../lib/api'
import type { CourseDetail } from '../types'

const emptyCourse: CourseDetail = {
  title: '',
  cover: '',
  images: [],
  description: '',
  age_range: '',
  original_price: 0,
  group_price: 0,
  target_count: 0,
  max_groups: 1,
  start_time: '',
  end_time: '',
  location_district: '',
  location_community: '',
  location_detail: '',
  longitude: null,
  latitude: null,
  deadline: '',
  coach_name: '',
  coach_intro: '',
  coach_cert: [],
  rules: ''
}

export function CourseFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [form, setForm] = useState<CourseDetail>(emptyCourse)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'edit' || !id) {
      return
    }

    void (async () => {
      try {
        const data = await api.get<CourseDetail>(`/courses/${id}`)
        setForm(data)
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
              封面图
              <input value={form.cover} onChange={event => updateField('cover', event.target.value)} />
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
              开课时间
              <input
                value={form.start_time}
                onChange={event => updateField('start_time', event.target.value)}
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
              适龄范围
              <input
                value={form.age_range}
                onChange={event => updateField('age_range', event.target.value)}
              />
            </label>
            <label>
              上课地点
              <input
                value={form.location_detail}
                onChange={event => updateField('location_detail', event.target.value)}
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

          <label>
            教练简介
            <textarea
              rows={4}
              value={form.coach_intro}
              onChange={event => updateField('coach_intro', event.target.value)}
            />
          </label>

          <label>
            课程介绍
            <textarea
              rows={8}
              value={form.description}
              onChange={event => updateField('description', event.target.value)}
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
