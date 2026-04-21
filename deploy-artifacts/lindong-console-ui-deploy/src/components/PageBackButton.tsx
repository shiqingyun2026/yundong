import { useNavigate } from 'react-router-dom'

export function PageBackButton({ fallback = '/dashboard', label = '返回上一级' }: { fallback?: string; label?: string }) {
  const navigate = useNavigate()

  return (
    <button
      className="back-button"
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          navigate(-1)
          return
        }

        navigate(fallback)
      }}
    >
      <span aria-hidden="true">←</span>
      {label}
    </button>
  )
}
