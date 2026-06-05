# 临时审计报告：评论区 Target 删除后的孤儿评论清理

日期：2026-06-05

## 目的

当前评论区以复用组件形式挂载在不同目标对象上，后端通过 `comment.target_type + comment.target_id` 建索引。若目标对象被删除，而对应评论未同步清理，`comment`、`comment_image`、图片 `asset` 记录以及磁盘图片文件会变成孤儿数据。

本报告只读审计现状，评估后续修改范围、方向和风险，不包含业务代码修改。

## 审计范围

本次查阅了以下文件：

- `backend/app/models.py`
- `backend/app/services/interactions.py`
- `backend/app/routers/interactions.py`
- `backend/app/routers/interaction_admin.py`
- `backend/app/services/comic_admin.py`
- `backend/app/services/novel_admin.py`
- `backend/app/routers/user_admin.py`
- `frontend/src/components/CommentPanel.tsx`
- `frontend/src/pages/UserPage.tsx`
- `frontend/src/pages/NovelDetailPage.tsx`
- `frontend/src/pages/NovelReaderPage.tsx`
- `frontend/src/pages/ComicPartPage.tsx`
- `frontend/src/pages/ComicReaderPage.tsx`
- `docs/data-model.md`

## 当前挂载点

后端当前允许的评论目标类型定义在 `backend/app/services/interactions.py`：

- `user_page`
- `novel`
- `novel_chapter`
- `comic_part`
- `comic_chapter`

前端实际挂载点如下：

- 用户页留言：`UserPage` 使用 `targetType="user_page"`，`targetId=profile.id`。
- 小说详情页评论：`NovelDetailPage` 使用 `targetType="novel"`，`targetId=novel.id`。
- 小说章节小评：`NovelReaderPage` 使用 `targetType="novel_chapter"`，`targetId=readerData.chapter.id`。
- 漫画 Part 评论：`ComicPartPage` 使用 `targetType="comic_part"`，`targetId=part.id`。
- 漫画章节小评：`ComicReaderPage` 使用 `targetType="comic_chapter"`，`targetId=readerData.chapter.id`。

结论：需要按这五类 target 设计清理能力，不能只覆盖小说或漫画章节。

## 现有评论删除能力

`Comment` 表是通用评论表，已经通过 `target_type + target_id` 建索引。`CommentImage` 表记录评论图片关系，模型注释明确写了硬删除评论时需要同步删除关系记录、对应 `Asset` 和磁盘文件。

`backend/app/services/interactions.py` 中已经存在 `delete_comment_images()`：

- 查询指定 `comment_id` 的 `CommentImage`。
- 获取对应 `Asset`。
- 通过 `asset.url` 反推上传文件路径。
- 删除磁盘文件。
- 删除 `Asset` 记录。
- 删除 `CommentImage` 记录。

管理端已有 `admin_hard_delete_comment()`，但它只支持硬删除单条无子回复评论：如果该评论下还有回复，会直接报错要求先处理子评论。

结论：图片清理的底层能力已经存在，但还缺少“按 target 批量递归硬删除整棵评论区”的服务函数。

## 当前缺口

### 用户删除

`backend/app/routers/user_admin.py` 的用户删除逻辑直接 `session.delete(user)` 后提交。

缺口：

- 没有删除目标为 `user_page` 且 `target_id=user.id` 的留言。
- 也没有处理该用户自己发布在其他目标下的评论。这个问题不完全等同于 target 孤儿评论，但会影响 `comment.user_id -> user.id` 外键关系。

判断：

- 本次设计缺陷的直接修复应至少清理 `user_page` target。
- 是否同步处理“被删除用户发表过的所有评论”需要单独定产品语义：可硬删、软删、匿名化，或禁止删除有历史内容的用户。

### 小说删除

`backend/app/services/novel_admin.py` 中：

- `delete_chapter()` 删除 `NovelChapter` 后重排章节顺序。
- `delete_novel()` 删除所有章节、owner link、小说本体和封面。

缺口：

- 删除小说章节时没有清理 `target_type="novel_chapter"` 的评论区。
- 删除小说时没有清理 `target_type="novel"` 的评论区。
- 删除小说时虽然会删除章节，但没有同步清理各章节的 `novel_chapter` 评论区。
- `NovelTextBuffer` 中可能存在指向小说或章节的草稿缓冲，当前删除小说时未见统一清理；这不是评论孤儿问题，但属于相邻数据完整性风险。

### 漫画删除

`backend/app/services/comic_admin.py` 中：

- `delete_chapter()` 删除漫画页、页图片 asset、章节目录、章节本体，并重排。
- `delete_part()` 逐个删除章节，再删除 part 封面和 part。
- `delete_series()` 逐个删除 part，再删除 series 封面和 series。

缺口：

- 删除漫画章节时没有清理 `target_type="comic_chapter"` 的评论区。
- 删除漫画 Part 时没有清理 `target_type="comic_part"` 的评论区。
- 删除漫画 Part 时虽然会删除章节，但没有同步清理各章节的 `comic_chapter` 评论区。
- 删除漫画 Series 时通过 Part 级联删除，因此也需要确保 Part/Chapter 清理函数覆盖评论。
- `ComicPartUserLink` 在 `delete_part()` 中未见显式删除；这不是评论孤儿问题，但删除 part 时会留下 owner link 风险。

## 推荐修改方向

### 1. 在 interactions service 增加 target 级硬删除函数

建议新增共享服务函数，例如：

```py
def hard_delete_comments_for_target(
    session: Session,
    *,
    target_type: str,
    target_id: str,
    commit: bool = False,
) -> int:
    ...
```

职责：

- 查询该 target 下所有评论。
- 按回复树从叶子到根删除，避免自引用外键约束问题。
- 对每条评论调用现有 `delete_comment_images()`，复用当前图片关系、图片 asset、磁盘文件删除逻辑。
- 删除 `Comment` 本体。
- 返回删除评论数量，便于日志和测试断言。

不建议直接复用 `admin_hard_delete_comment()`，因为它的产品语义是“管理员单条硬删”，遇到子回复会拒绝；target 删除场景需要整棵评论区物理清理。

### 2. 支持批量 target 清理

删除小说、漫画 Part、漫画 Series 时，通常会同时删多个子目标。建议再提供一个轻量批量包装：

```py
def hard_delete_comments_for_targets(
    session: Session,
    targets: list[tuple[str, str]],
    *,
    commit: bool = False,
) -> int:
    ...
```

这样可以先收集 target id，再统一清理，减少每个业务服务重复写查询和循环。

### 3. 接入现有 target 删除流程

建议接入点：

- 用户删除成功前：清理 `("user_page", user.id)`。
- 小说章节删除前：清理 `("novel_chapter", chapter.id)`。
- 小说删除前：收集 `("novel", novel.id)` 和所有 `("novel_chapter", chapter.id)`。
- 漫画章节删除前：清理 `("comic_chapter", chapter.id)`。
- 漫画 Part 删除前：收集 `("comic_part", part.id)` 和所有章节的 `("comic_chapter", chapter.id)`。
- 漫画 Series 删除：如果 `delete_part()` 已完整处理 Part 和 Chapter 评论，Series 层无需重复清理；否则 Series 层必须先收集所有 Part/Chapter target。

推荐“删除 target 前先清理评论”。原因是目标对象删除后，虽然仍可凭之前拿到的 id 清理评论，但错误恢复、日志和调试都会更差。

### 4. 调整事务边界

当前漫画删除流程存在多次 `session.commit()`，小说删除流程也在章节删除、小说删除和封面删除间分段提交。评论清理加入后，风险会变高：

- target 已删除但评论清理失败。
- 评论数据库记录已删除但图片文件删除失败。
- 图片文件已删除但数据库提交失败。
- 父流程中途失败，留下部分章节或部分评论被清理。

建议至少做到：

- 新增评论清理函数默认不提交，由外层删除流程统一提交。
- 业务删除函数尽量减少中间 `commit`，优先使用 `flush` 和最终一次 `commit`。
- 文件删除失败要明确策略：当前既有代码倾向直接执行 `unlink()`，可延续此策略，但应在测试里覆盖“文件不存在不报错”。

如果短期不重构全部删除流程，也应避免在 `hard_delete_comments_for_target()` 内强制提交，否则会进一步放大半完成状态。

## 风险评估

### 自引用评论树删除顺序

`Comment.parent_id` 和 `Comment.reply_to_id` 都指向 `comment.id`。批量硬删时如果先删父评论，SQLite/SQLModel 可能因外键关系失败，或留下不可预期顺序问题。

建议按深度倒序删除：

- 先删回复。
- 再删一级评论。
- 对 `reply_to_id` 指向同 target 内其他评论的情况也要覆盖。

### 用户删除的语义更复杂

target 删除清理只解决 `user_page` 留言区。用户被删除后，其在小说、漫画、其他用户页发表的评论仍然带有 `user_id`。

这不属于本次“target 被删除”缺陷的最小修复，但它是同一数据域里的完整性风险。后续应单独决定：

- 禁止删除存在评论历史的用户。
- 将用户改为停用而不是物理删除。
- 软删该用户所有评论。
- 硬删该用户所有评论和图片。
- 保留评论但匿名化作者。

### 文件系统和数据库无法天然原子化

评论图片文件删除和数据库事务无法做到真正原子。若数据库回滚，已删除文件不会自动恢复。

可接受的短期方案是沿用现状：删除时先删文件再删记录，失败则抛出。更稳妥的长期方案是引入后台清理任务或“待删除文件队列”，但这超出本次缺陷的最小范围。

### 删除函数被作者端和管理端复用

漫画章节删除同时被 admin 与 author 路由调用，小说章节/小说删除也一样。把评论清理放在 service 层比放在 router 层更安全，避免只修管理端而漏掉作者端。

### 可能缺少测试基础设施

项目当前未见明显测试目录。实现时建议至少增加针对 service 层的轻量测试，或提供可重复的手工验证脚本。重点覆盖：

- 有父评论、子回复、图片的 target 被删除。
- 目标删除后 `comment`、`comment_image`、`asset` 均无残留。
- 对应评论图片文件被删除。
- 删除小说/漫画上层对象时，子章节评论也被删除。

## 建议落地顺序

1. 在 `interactions.py` 中新增 target 级硬删除函数，复用 `delete_comment_images()`。
2. 为该函数补最小测试或临时验证脚本，先验证评论树和图片清理。
3. 接入小说章节、小说、漫画章节、漫画 Part 删除服务。
4. 接入用户删除中的 `user_page` target 清理。
5. 回头处理相邻完整性问题：`ComicPartUserLink`、`NovelTextBuffer`、被删除用户发表过的评论。
6. 根据实际测试结果，再决定是否重构漫画/小说删除流程中过多的中间 `commit`。

## 临时结论

这项优化的核心不在前端，也不需要改数据库结构。最小有效修改范围集中在后端：

- `backend/app/services/interactions.py`：新增按 target 递归硬删除评论区的共享能力。
- `backend/app/services/novel_admin.py`：在小说和小说章节删除流程中调用。
- `backend/app/services/comic_admin.py`：在漫画 Part 和章节删除流程中调用。
- `backend/app/routers/user_admin.py` 或更合适的用户 service：在用户页 target 删除时调用。

主要风险是事务边界和评论树删除顺序。只要共享函数默认不提交、按叶子到根删除，并放在业务 service 层统一接入，就可以在不改变当前评论软删除语义的前提下，解决 target 删除后的孤儿评论区问题。
