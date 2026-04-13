# yundong

这个仓库采用双分支结构：

- `main`：只保留仓库说明文件。
- `preview`：保存完整项目代码，并作为实际开发分支。

## 如何查看源码

如果你刚克隆仓库，可以直接切到 `preview`：

```bash
git switch preview
```

如果你准备首次拉取代码，也可以直接拉 `preview` 分支：

```bash
git clone -b preview git@github.com:shiqingyun2026/yundong.git
```

## 说明

当前 `main` 分支不放业务代码，目的是让仓库首页保持清晰，方便先展示项目说明，再进入实际开发分支查看源码。
