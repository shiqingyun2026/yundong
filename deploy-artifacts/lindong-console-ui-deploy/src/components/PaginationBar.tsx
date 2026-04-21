type PaginationBarProps = {
  total: number
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

export function PaginationBar({ total, page, totalPages, onPrev, onNext }: PaginationBarProps) {
  return (
    <div className="pagination-bar">
      <div className="pagination-summary">
        <span>共 {total} 条</span>
        <strong>
          第 {page} / {totalPages} 页
        </strong>
      </div>

      <div className="pagination-actions">
        <button className="secondary-button pagination-button" type="button" disabled={page <= 1} onClick={onPrev}>
          上一页
        </button>
        <div className="pagination-current">{page}</div>
        <button
          className="secondary-button pagination-button"
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          下一页
        </button>
      </div>
    </div>
  )
}
