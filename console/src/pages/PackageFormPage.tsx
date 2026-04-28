import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { PageBackButton } from '../components/PageBackButton'
import { api, uploadImage } from '../lib/api'
import { sanitizeRichHtml } from '../lib/html'
import type { CourseLocationSuggestion, PackageDetail, PackageGroupLessonItem, PackageGroupListItem, PackageGroupListResponse } from '../types'
import { REGION_OPTIONS, toDateTimeLocal } from './courseFormHelpers'

type PackagePageMode = 'create' | 'edit' | 'view'
type PackageLocationSuggestionResponse = {
  list: CourseLocationSuggestion[]
}
type PackageGeocodeResponse = {
  formatted_address: string
  longitude: number
  latitude: number
  province?: string
  city?: string
  district?: string
}
type GroupPriceConfigRow = PackageDetail['group_price_config'][number] & {
  _rowId: string
}

const RequiredMark = () => <span className="required-mark">*</span>
const FIXED_PACKAGE_DEADLINE_HOURS = 48

const createGroupPriceRow = (value?: Partial<GroupPriceConfigRow>): GroupPriceConfigRow => ({
  _rowId: value?._rowId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  target_count: Number(value?.target_count) || 0,
  price_fen: Number(value?.price_fen) || 0
})

const emptyPackage: PackageDetail = {
  id: '',
  name: '',
  cover: '',
  package_category: '体适能',
  age_range: '',
  class_count: 0,
  class_duration_minutes: 0,
  group_price_config: [],
  supported_people: [],
  location_text: '',
  location_district: '',
  location_community: '',
  location_detail: '',
  coach_name: '',
  publish_time: '',
  unpublish_time: '',
  status: 'pending',
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

const normalizeGroupPriceConfig = (value: PackageDetail['group_price_config']) =>
  [...(value || [])]
    .map(item => ({
      target_count: Number(item.target_count) || 0,
      price_fen: Number(item.price_fen) || 0
    }))
    .filter(item => item.target_count > 0 || item.price_fen > 0)
    .sort((a, b) => a.target_count - b.target_count)

const normalizeGroupPriceConfigRows = (value: PackageDetail['group_price_config'] | GroupPriceConfigRow[]) =>
  [...(value || [])]
    .map(item => createGroupPriceRow(item))
    .filter(item => item.target_count > 0 || item.price_fen > 0)

const deriveSupportedPeople = (config: PackageDetail['group_price_config']) =>
  [...new Set(normalizeGroupPriceConfig(config).map(item => item.target_count).filter(item => item > 0))]

const formatSupportedPeople = (supportedPeople: number[]) =>
  supportedPeople.length ? supportedPeople.map(item => `${item}人团`).join(' / ') : '-'

const getStatusText = (status: PackageDetail['status']) => {
  if (status === 'pending') return '待上架'
  if (status === 'active') return '已上架'
  return '已下架'
}

const canEditPackage = (status: PackageDetail['status']) => status === 'pending' || status === 'inactive'

const getPackageGroupStatusText = (status: PackageGroupListItem['status']) => {
  if (status === 'success') return '已成团'
  if (status === 'failed') return '已失败'
  return '进行中'
}

const formatScheduleList = (scheduleList: PackageGroupLessonItem[]) =>
  scheduleList.map(item => `第${item.index}节 ${item.display_text || item.class_time} ${item.coach_name.trim() || '教练待定'}`)

const buildPayload = (form: PackageDetail) => {
  const groupPriceConfig = normalizeGroupPriceConfig(form.group_price_config)

  return {
    name: form.name.trim(),
    package_category: form.package_category,
    age_range: form.age_range.trim(),
    cover: form.cover.trim(),
    images: form.cover.trim() ? [form.cover.trim()] : [],
    class_count: Number(form.class_count) || 0,
    class_duration_minutes: Number(form.class_duration_minutes) || 0,
    group_price_config: groupPriceConfig,
    supported_people: deriveSupportedPeople(groupPriceConfig),
    location_district: form.location_district.trim(),
    location_community: form.location_community.trim(),
    location_detail: form.location_detail.trim(),
    longitude: form.longitude,
    latitude: form.latitude,
    coach_intro: form.coach_intro.trim(),
    coach_certificates: form.coach_certificates.filter(Boolean),
    description: form.description.trim(),
    publish_time: form.publish_time,
    unpublish_time: form.unpublish_time || '',
    deadline_hours: FIXED_PACKAGE_DEADLINE_HOURS
  }
}

export function PackageFormPage({ mode }: { mode: PackagePageMode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<PackageDetail>(emptyPackage)
  const [loading, setLoading] = useState(mode !== 'create')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const [resolvingGeo, setResolvingGeo] = useState(false)
  const [error, setError] = useState('')
  const [province, setProvince] = useState('广东省')
  const [city, setCity] = useState('深圳市')
  const [district, setDistrict] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<CourseLocationSuggestion[]>([])
  const [searchingLocations, setSearchingLocations] = useState(false)
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [packageGroupsLoading, setPackageGroupsLoading] = useState(false)
  const [packageGroupsError, setPackageGroupsError] = useState('')
  const [packageGroups, setPackageGroups] = useState<PackageGroupListItem[]>([])

  const copyFrom = searchParams.get('copyFrom') || ''

  useEffect(() => {
    const targetId = mode === 'create' && copyFrom ? copyFrom : id
    if (!targetId) {
      setLoading(false)
      return
    }

    void (async () => {
      try {
        const data = await api.get<PackageDetail>(`/packages/${targetId}`)
        const normalizedConfig = normalizeGroupPriceConfigRows(data.group_price_config || [])
        const districtParts = `${data.location_district || ''}`
          .split(/[\/\s-]+/)
          .map(item => item.trim())
          .filter(Boolean)

        setProvince(districtParts[0] || '广东省')
        setCity(districtParts[1] || '深圳市')
        setDistrict(districtParts[2] || districtParts[1] || '')

        if (mode === 'create' && copyFrom) {
          setForm({
            ...data,
            id: '',
            name: data.name ? `${data.name} - 副本` : '',
            status: 'pending',
            group_price_config: normalizedConfig,
            supported_people: deriveSupportedPeople(normalizedConfig),
            publish_time: '',
            unpublish_time: '',
            images: data.images?.length ? data.images : data.cover ? [data.cover] : []
          })
          return
        }

        setForm({
          ...data,
          group_price_config: normalizedConfig,
          supported_people: deriveSupportedPeople(normalizedConfig),
          publish_time: toDateTimeLocal(data.publish_time),
          unpublish_time: toDateTimeLocal(data.unpublish_time),
          images: data.images?.length ? data.images : data.cover ? [data.cover] : []
        })
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '获取课包详情失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [copyFrom, id, mode])

  useEffect(() => {
    if (!id || mode === 'create') {
      setPackageGroups([])
      setPackageGroupsError('')
      setPackageGroupsLoading(false)
      return
    }

    void (async () => {
      setPackageGroupsLoading(true)
      setPackageGroupsError('')

      try {
        const params = new URLSearchParams({
          package_id: id,
          page: '1',
          size: '100'
        })
        const data = await api.get<PackageGroupListResponse>(`/package-groups?${params.toString()}`)
        setPackageGroups(data.list || [])
      } catch (fetchError) {
        setPackageGroupsError(fetchError instanceof Error ? fetchError.message : '获取课包拼团记录失败')
      } finally {
        setPackageGroupsLoading(false)
      }
    })()
  }, [id, mode])

  const updateField = <K extends keyof PackageDetail>(key: K, value: PackageDetail[K]) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const canOfflinePackage = mode !== 'create' && form.status === 'active'
  const isReadOnly = mode === 'view'
  const isEditable = !isReadOnly && (mode === 'create' || canEditPackage(form.status))
  const pageTitle = mode === 'create' ? '新建课包' : mode === 'edit' ? '编辑课包' : '课包详情'
  const cityOptions = REGION_OPTIONS.find(item => item.value === province)?.cities || []
  const districtOptions = cityOptions.find(item => item.value === city)?.districts || []
  const locationSearchDistrict =
    mode === 'create' ? [province, city, district].filter(Boolean).join(' / ') : form.location_district

  useEffect(() => {
    if (isReadOnly) {
      setLocationSuggestions([])
      setShowLocationSuggestions(false)
      setSearchingLocations(false)
      return
    }

    const keyword = form.location_detail.trim()
    if (!keyword) {
      setLocationSuggestions([])
      setShowLocationSuggestions(false)
      setSearchingLocations(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearchingLocations(true)

        try {
          const params = new URLSearchParams({
            keyword,
            district: locationSearchDistrict || ''
          })
          const data = await api.get<PackageLocationSuggestionResponse>(`/packages/location-suggestions?${params.toString()}`)

          if (cancelled) {
            return
          }

          setLocationSuggestions(data.list || [])
          setShowLocationSuggestions(true)
        } catch (searchError) {
          if (cancelled) {
            return
          }

          setLocationSuggestions([])
          setError(searchError instanceof Error ? searchError.message : '查询地点失败')
        } finally {
          if (!cancelled) {
            setSearchingLocations(false)
          }
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [form.location_detail, isReadOnly, locationSearchDistrict])

  const updateRegionField = (nextProvince: string, nextCity: string, nextDistrict: string) => {
    setProvince(nextProvince)
    setCity(nextCity)
    setDistrict(nextDistrict)
    updateField('location_district', [nextProvince, nextCity, nextDistrict].filter(Boolean).join(' / '))
  }

  const syncResolvedRegion = (nextProvince?: string, nextCity?: string, nextDistrict?: string) => {
    const provinceValue = (nextProvince || province || '广东省').trim()
    const cityValue = (nextCity || city || '').trim()
    const districtValue = (nextDistrict || district || '').trim()

    if (mode === 'create') {
      updateRegionField(provinceValue, cityValue, districtValue)
      return
    }

    updateField('location_district', [provinceValue, cityValue, districtValue].filter(Boolean).join(' / '))
  }

  const setGroupPriceConfig = (nextConfig: PackageDetail['group_price_config']) => {
    const normalizedConfig = normalizeGroupPriceConfigRows(nextConfig)
    setForm(current => ({
      ...current,
      group_price_config: normalizedConfig,
      supported_people: deriveSupportedPeople(normalizedConfig)
    }))
  }

  const handleGroupConfigChange = (
    index: number,
    key: keyof PackageDetail['group_price_config'][number],
    value: number
  ) => {
    const nextConfig = [...form.group_price_config]
    nextConfig[index] = {
      ...nextConfig[index],
      [key]: value
    }
    setGroupPriceConfig(nextConfig)
  }

  const addGroupPriceRow = () => {
    setForm(current => ({
      ...current,
      group_price_config: [...current.group_price_config, createGroupPriceRow()]
    }))
  }

  const removeGroupPriceRow = (index: number) => {
    setGroupPriceConfig(form.group_price_config.filter((_, currentIndex) => currentIndex !== index))
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
      updateField('images', [url])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败')
    } finally {
      setUploading('')
      event.target.value = ''
    }
  }

  const handleRichTextImageUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    field: 'description' | 'coach_intro',
    altText: string
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploading('上传图片中...')
    setError('')

    try {
      const url = await uploadImage(file, 'course-detail')
      const imageMarkup = `<p><img src="${url}" alt="${altText}" /></p>`
      updateField(field, `${form[field]}\n${imageMarkup}`.trim())
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败')
    } finally {
      setUploading('')
      event.target.value = ''
    }
  }

  const handleUploadMultiple = async (
    event: ChangeEvent<HTMLInputElement>,
    field: 'coach_certificates',
    folder: 'coach-cert'
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

  const removeArrayItem = (field: 'coach_certificates', index: number) => {
    updateField(
      field,
      form[field].filter((_, currentIndex) => currentIndex !== index) as PackageDetail[typeof field]
    )
  }

  const applyLocationSuggestion = (suggestion: CourseLocationSuggestion) => {
    setForm(current => ({
      ...current,
      location_community: suggestion.title || current.location_community,
      location_detail: suggestion.address || suggestion.title,
      longitude: suggestion.longitude,
      latitude: suggestion.latitude
    }))
    syncResolvedRegion(suggestion.province, suggestion.city, suggestion.district)
    setLocationSuggestions([])
    setShowLocationSuggestions(false)
  }

  const resolveCoordinates = async () => {
    setResolvingGeo(true)
    setError('')

    try {
      const data = await api.post<PackageGeocodeResponse>('/packages/geocode', {
        district: mode === 'create' ? [province, city, district].filter(Boolean).join(' / ') : form.location_district,
        detail: form.location_detail
      })

      setForm(current => ({
        ...current,
        longitude: data.longitude,
        latitude: data.latitude
      }))
      syncResolvedRegion(data.province, data.city, data.district)
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : '解析坐标失败')
    } finally {
      setResolvingGeo(false)
    }
  }

  const offlinePackage = async () => {
    if (!id || !canOfflinePackage) {
      return
    }

    if (
      !window.confirm(
        '确认下架该课包吗？\n下架后，该课包将不会继续在小程序首页展示。\n如有进行中的拼团，将自动扭转拼团状态为失败，并退款。'
      )
    ) {
      return
    }

    setError('')

    try {
      await api.put(`/packages/${id}/offline`)
      navigate('/packages')
    } catch (offlineError) {
      setError(offlineError instanceof Error ? offlineError.message : '下架课包失败')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const normalizedConfig = normalizeGroupPriceConfig(form.group_price_config)

    if (!normalizedConfig.length) {
      setError('请至少配置一个团型售价')
      setSaving(false)
      return
    }

    if (normalizedConfig.some(item => item.target_count <= 0 || item.price_fen <= 0)) {
      setError('团型人数和人均售价都必须大于 0')
      setSaving(false)
      return
    }

    if (new Set(normalizedConfig.map(item => item.target_count)).size !== normalizedConfig.length) {
      setError('团型人数不能重复')
      setSaving(false)
      return
    }

    if (!form.age_range.trim()) {
      setError('请填写适用年龄')
      setSaving(false)
      return
    }

    if (!form.publish_time) {
      setError('请填写上架时间')
      setSaving(false)
      return
    }

    if (mode === 'create' && (!province || !city || !district)) {
      setError('新建课包时，请先完成省 / 市 / 区三级选择')
      setSaving(false)
      return
    }

    try {
      const payload = buildPayload({
        ...form,
        group_price_config: normalizedConfig,
        supported_people: deriveSupportedPeople(normalizedConfig)
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

  const supportedPeopleText = useMemo(
    () => formatSupportedPeople(deriveSupportedPeople(form.group_price_config)),
    [form.group_price_config]
  )

  const maxGroupConfig = useMemo(() => {
    if (!form.group_price_config.length) {
      return null
    }

    return [...form.group_price_config].sort((a, b) => b.target_count - a.target_count)[0]
  }, [form.group_price_config])

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
              {mode === 'view' && canEditPackage(form.status) ? (
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
              {canOfflinePackage ? (
                <button className="ghost-button" type="button" onClick={() => void offlinePackage()}>
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
          <div className="form-grid">
            {mode !== 'create' ? (
              <label>
                <span>课包ID</span>
                <input value={form.id || id || ''} disabled />
              </label>
            ) : null}
            <label>
              <span>课包名称<RequiredMark /></span>
              <input value={form.name} onChange={event => updateField('name', event.target.value)} disabled={!isEditable} />
            </label>
            <label>
              <span>课包类型<RequiredMark /></span>
              <select
                value={form.package_category}
                onChange={event => updateField('package_category', event.target.value as PackageDetail['package_category'])}
                disabled={!isEditable}
              >
                <option value="体适能">体适能</option>
                <option value="跳绳">跳绳</option>
              </select>
            </label>
            <label>
              <span>适用年龄<RequiredMark /></span>
              <input
                value={form.age_range}
                onChange={event => updateField('age_range', event.target.value)}
                placeholder="如：4-8岁"
                disabled={!isEditable}
              />
            </label>
            <label>
              <span>课程节数<RequiredMark /></span>
              <input
                type="number"
                min="1"
                value={form.class_count}
                onChange={event => updateField('class_count', Number(event.target.value))}
                disabled={!isEditable}
              />
            </label>
            <label>
              <span>单节课时长（分钟）<RequiredMark /></span>
              <input
                type="number"
                min="1"
                value={form.class_duration_minutes}
                onChange={event => updateField('class_duration_minutes', Number(event.target.value))}
                disabled={!isEditable}
              />
            </label>
            <label>
              <span>开团截止时长（小时）</span>
              <input
                type="number"
                value={FIXED_PACKAGE_DEADLINE_HOURS}
                disabled
              />
            </label>
            <label>
              <span>上架时间<RequiredMark /></span>
              <input
                type="datetime-local"
                value={form.publish_time}
                onChange={event => updateField('publish_time', event.target.value)}
                disabled={!isEditable}
              />
            </label>
            <label>
              <span>下架时间</span>
              <input
                type="datetime-local"
                value={form.unpublish_time}
                onChange={event => updateField('unpublish_time', event.target.value)}
                disabled={!isEditable}
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
                    disabled={!isEditable}
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
                    disabled={!isEditable}
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
                    disabled={!isEditable}
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
                <span>所在区域<RequiredMark /></span>
                <input
                  value={form.location_district}
                  onChange={event => updateField('location_district', event.target.value)}
                  disabled={!isEditable}
                />
              </label>
            )}
            <label>
              <span>小区 / 场地名称<RequiredMark /></span>
              <input
                value={form.location_community}
                onChange={event => updateField('location_community', event.target.value)}
                disabled={!isEditable}
              />
            </label>
            <label>
              <span>详细地点<RequiredMark /></span>
              <div
                className="location-autocomplete"
                onBlur={() => {
                  window.setTimeout(() => {
                    setShowLocationSuggestions(false)
                  }, 120)
                }}
              >
                <input
                  value={form.location_detail}
                  onChange={event => {
                    updateField('location_detail', event.target.value)
                    setShowLocationSuggestions(true)
                  }}
                  onFocus={() => {
                    if (locationSuggestions.length) {
                      setShowLocationSuggestions(true)
                    }
                  }}
                  placeholder="输入场馆名、小区名或详细地址后联想搜索"
                  disabled={!isEditable}
                />
                {showLocationSuggestions && isEditable ? (
                  <div className="location-suggestion-panel">
                    {searchingLocations ? <p className="location-suggestion-empty">地点搜索中...</p> : null}
                    {!searchingLocations && !locationSuggestions.length ? (
                      <p className="location-suggestion-empty">未找到匹配地点，继续输入后可手动解析坐标</p>
                    ) : null}
                    {!searchingLocations
                      ? locationSuggestions.map(item => (
                          <button
                            key={item.id}
                            className="location-suggestion-item"
                            type="button"
                            onMouseDown={event => {
                              event.preventDefault()
                              applyLocationSuggestion(item)
                            }}
                          >
                            <strong>{item.title || item.address}</strong>
                            <span>{item.address || '暂无地址描述'}</span>
                          </button>
                        ))
                      : null}
                  </div>
                ) : null}
              </div>
            </label>
            <label>
              <span>经度</span>
              <input
                type="number"
                value={form.longitude ?? ''}
                onChange={event => updateField('longitude', event.target.value ? Number(event.target.value) : null)}
                disabled={!isEditable}
              />
            </label>
            <label>
              <span>纬度</span>
              <input
                type="number"
                value={form.latitude ?? ''}
                onChange={event => updateField('latitude', event.target.value ? Number(event.target.value) : null)}
                disabled={!isEditable}
              />
            </label>
          </div>

          {isEditable ? (
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => void resolveCoordinates()} disabled={resolvingGeo}>
                {resolvingGeo ? '解析中...' : '解析经纬度'}
              </button>
              {uploading ? <span className="muted-text">{uploading}</span> : null}
            </div>
          ) : null}

          <section className="panel subtle-panel stack">
            <div className="page-actions">
              <div>
                <p className="section-kicker">Pricing</p>
                <h4>团型售价配置</h4>
              </div>
              {isEditable ? (
                <button className="secondary-button" type="button" onClick={addGroupPriceRow}>
                  新增团型
                </button>
              ) : null}
            </div>
            {form.group_price_config.length ? (
              <div className="group-price-stack">
                {form.group_price_config.map((item, index) => (
                  <div key={(item as GroupPriceConfigRow)._rowId || `group-price-${index}`} className="group-price-row">
                    <label>
                      <span>团型人数<RequiredMark /></span>
                      <input
                        type="number"
                        min="1"
                        value={item.target_count}
                        onChange={event => handleGroupConfigChange(index, 'target_count', Number(event.target.value))}
                        disabled={!isEditable}
                      />
                    </label>
                    <label>
                      <span>人均售价（分）<RequiredMark /></span>
                      <input
                        type="number"
                        min="1"
                        value={item.price_fen}
                        onChange={event => handleGroupConfigChange(index, 'price_fen', Number(event.target.value))}
                        disabled={!isEditable}
                      />
                    </label>
                    {isEditable ? (
                      <button className="ghost-button compact-button" type="button" onClick={() => removeGroupPriceRow(index)}>
                        删除
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-text">还没有配置团型，请至少添加一行人均售价。</p>
            )}
            <div className="detail-card">
              <strong>派生结果</strong>
              <p>支持团型：{supportedPeopleText}</p>
              <p>最大团型人均价：{maxGroupConfig ? `¥${(maxGroupConfig.price_fen / 100).toFixed(2)} / ${maxGroupConfig.target_count}人团` : '-'}</p>
            </div>
          </section>

          <div className="stack">
            <label>
              <span>封面图 URL<RequiredMark /></span>
              <input value={form.cover} onChange={event => updateField('cover', event.target.value)} disabled={!isEditable} />
            </label>
            {isEditable ? (
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
                <p className="section-kicker">Coach Intro</p>
                <h4>教练简介</h4>
              </div>
              {isEditable ? (
                <label className="file-button">
                  上传图片并插入简介
                  <input
                    type="file"
                    accept="image/*"
                    onChange={event => void handleRichTextImageUpload(event, 'coach_intro', '教练简介图')}
                  />
                </label>
              ) : null}
            </div>
            <textarea
              rows={8}
              value={form.coach_intro}
              onChange={event => updateField('coach_intro', event.target.value)}
              disabled={!isEditable}
            />
            {form.coach_intro ? (
              <div
                className="description-preview rich-preview"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(form.coach_intro) }}
              />
            ) : null}
          </div>

          <div className="stack">
            <div className="page-actions">
              <div>
                <p className="section-kicker">Certificates</p>
                <h4>教练证书</h4>
              </div>
              {isEditable ? (
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
              disabled={!isEditable}
            />
            <div className="image-preview-grid">
              {form.coach_certificates.map((url, index) => (
                <div key={`${url}-${index}`} className="image-tile">
                  <img className="image-preview" src={url} alt={`教练证书${index + 1}`} />
                  {isEditable ? (
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

          <div className="stack">
            <div className="page-actions">
              <div>
                <p className="section-kicker">Package Intro</p>
                <h4>课包介绍</h4>
              </div>
              {isEditable ? (
                <label className="file-button">
                  上传图片并插入介绍
                  <input
                    type="file"
                    accept="image/*"
                    onChange={event => void handleRichTextImageUpload(event, 'description', '课包介绍图')}
                  />
                </label>
              ) : null}
            </div>
            <textarea
              rows={10}
              value={form.description}
              onChange={event => updateField('description', event.target.value)}
              disabled={!isEditable}
            />
            {form.description ? (
              <div
                className="description-preview rich-preview"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(form.description) }}
              />
            ) : null}
          </div>

          <section className="panel subtle-panel stack">
            <div>
              <p className="section-kicker">Snapshot</p>
              <h4>当前配置摘要</h4>
            </div>
            <div className="detail-grid">
              <div className="detail-card">
                <strong>课包信息</strong>
                <p>课包ID：{form.id || id || '-'}</p>
                <p>课包类型：{form.package_category || '-'}</p>
                <p>课程节数：{form.class_count || '-'} 节</p>
                <p>单节时长：{form.class_duration_minutes || '-'} 分钟</p>
                <p>支持团型：{supportedPeopleText}</p>
                <p>状态：{getStatusText(form.status)}</p>
              </div>
              <div className="detail-card">
                <strong>地点与上架</strong>
                <p>上架时间：{form.publish_time || '-'}</p>
                <p>下架时间：{form.unpublish_time || '-'}</p>
                <p>所在区域：{form.location_district || '-'}</p>
                <p>小区 / 场地：{form.location_community || '-'}</p>
                <p>详细地点：{form.location_detail || '-'}</p>
              </div>
              <div className="detail-card">
                <strong>维护信息</strong>
                <p>创建时间：{form.create_time || '-'}</p>
                <p>更新时间：{form.update_time || '-'}</p>
                <p>经纬度：{form.longitude && form.latitude ? `${form.longitude}, ${form.latitude}` : '-'}</p>
              </div>
            </div>
          </section>

          {mode !== 'create' && id ? (
            <section className="panel subtle-panel stack">
              <div className="page-actions">
                <div>
                  <p className="section-kicker">Package Groups</p>
                  <h4>拼团记录</h4>
                </div>
                <Link className="secondary-button" to={`/package-groups?package_id=${id}`}>
                  查看全部拼团
                </Link>
              </div>

              {packageGroupsLoading ? <p className="muted-text">加载拼团记录中...</p> : null}
              {packageGroupsError ? <p className="error-text">{packageGroupsError}</p> : null}

              {!packageGroupsLoading && !packageGroupsError ? (
                packageGroups.length ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>拼团编号</th>
                        <th>状态</th>
                        <th>进度</th>
                        <th>排课信息</th>
                        <th>截止时间</th>
                        <th>成团时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packageGroups.map(item => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{getPackageGroupStatusText(item.status)}</td>
                          <td>
                            {item.current_count}/{item.target_count}
                            <p className="table-subtext">{item.member_amount_text || '-'}</p>
                          </td>
                          <td>
                            <div>
                              <span>{item.schedule_text || '-'}</span>
                              {item.schedule_list.length ? (
                                <p className="table-subtext">{formatScheduleList(item.schedule_list).join(' / ')}</p>
                              ) : null}
                            </div>
                          </td>
                          <td>{item.deadline || '-'}</td>
                          <td>{item.success_time || '-'}</td>
                          <td>
                            <div className="button-row">
                              <Link className="table-link" to={`/package-groups/${item.id}`}>
                                查看详情
                              </Link>
                              <Link className="table-link" to={`/package-orders?package_group_id=${item.id}`}>
                                查看订单
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted-text">当前课包还没有产生拼团记录，后续开团后会在这里展示历史团和进行中团。</p>
                )
              ) : null}
            </section>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}

          {isEditable ? (
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
