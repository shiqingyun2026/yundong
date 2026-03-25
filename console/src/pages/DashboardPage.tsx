export function DashboardPage() {
  return (
    <section className="panel stack">
      <div>
        <p className="section-kicker">Project Status</p>
        <h3>后台骨架已就位</h3>
      </div>
      <p className="muted-text">
        当前版本已经拆出独立的 `console/` 前端项目，并在 `backend/` 中新增了
        `/api/admin/*` 路由。接下来可以围绕真实数据库迁移结果，逐步补齐课程状态、退款、上传签名和管理员持久化账号能力。
      </p>

      <div className="stats-grid">
        <article className="stat-card">
          <span>管理端登录</span>
          <strong>已接通</strong>
        </article>
        <article className="stat-card">
          <span>课程管理</span>
          <strong>骨架可用</strong>
        </article>
        <article className="stat-card">
          <span>订单管理</span>
          <strong>列表可查</strong>
        </article>
        <article className="stat-card">
          <span>账号管理</span>
          <strong>等待表迁移</strong>
        </article>
      </div>
    </section>
  )
}
