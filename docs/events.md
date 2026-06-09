# Event Outbox and Notification Plan

本文档记录 Event / OutboxEvent / Notification 地基的架构审计和开发规划。

当前状态：规划，未实现。

范围约束：

- 后端仍使用 FastAPI + SQLModel + SQLite。
- 不引入 Redis、Celery、RabbitMQ、Kafka。
- 不引入第二套认证。
- 普通用户不能访问 OutboxEvent。
- 前端不能决定通知 recipient。
- payload 和 metadata 不能记录密码、token、完整评论正文、完整小说正文、完整 buffer 正文。
- Notification 不做访问统计。

## 1. 总体结论

当前项目最适合采用：

```txt
service 层写 OutboxEvent，独立 worker / script 定时处理
```

理由：

- 当前项目是个人小站，SQLite + 数据库表模拟轻量 outbox 足够。
- 评论、小说、漫画、上传等业务写入已经主要落在 service 层。
- ActivityLog 目前多在 router 层补写，适合先冻结，不适合直接复用为通知源。
- 通知失败不应该影响主业务写入。
- 独立 processor 可以支持失败重试、dead event 排查和后续扩展。

第一版只接入 `comment.created`，后续再扩展小说、漫画、收藏和日志派生。

## 2. 推荐架构

推荐组件：

- `OutboxEvent`：业务事件表，记录“发生了什么”。
- `Notification`：用户通知表，记录“谁应该看到什么”。
- `outbox service`：负责创建事件、claim 事件、标记成功或失败。
- `notification service`：负责创建通知、序列化通知、去重。
- `event processor`：独立 Python 脚本或 service 函数，定时处理 pending events。
- `notification router`：只暴露当前登录用户自己的通知接口。

推荐事件流：

```txt
业务 service 成功创建业务数据
-> 同事务或同业务流程写 OutboxEvent
-> worker claim pending event
-> handler 根据 event_type 处理
-> Notification service 创建通知
-> OutboxEvent 标记 processed / failed / dead
```

第一版的事件源位置：

```txt
app.services.interactions.create_comment
```

原因：

- 当前评论创建逻辑在该 service 内完成目标校验、回复关系校验、评论入库、图片保存和提交。
- 这里最接近“评论已创建”这个业务事实。
- router 只是 HTTP 入口，不适合作为业务事件源。

## 3. 不推荐方案及原因

不推荐 router 直接调用 notification service：

- router 会越来越厚。
- 同一业务动作如果未来有多个入口，容易漏通知。
- router 更适合处理请求参数、认证依赖和 HTTP 错误，不适合作为业务事实源。

不推荐当前请求内同步完整处理通知：

- 通知失败可能拖慢评论请求。
- 通知规则后续变复杂后，请求路径会变脆。
- 主业务和派生副作用应该解耦。

不推荐 ORM event / SQLAlchemy hook：

- hook 很难表达业务语义。
- `reply_to_id`、`parent_id`、用户页留言 recipient、自己回复自己跳过等规则不适合放 hook。
- 隐式触发会增加排查成本。

不推荐 SQLite trigger：

- trigger 不适合查复杂业务对象、构造 URL、去重、重试和记录错误。
- 业务逻辑分散到数据库层后可维护性差。

不推荐 Redis/Celery/RabbitMQ/Kafka：

- 对当前个人网站过重。
- 会增加部署、监控、连接、重试和运维复杂度。

不建议从 ActivityLog 反推通知：

- ActivityLog 是审计日志，不是业务事件源。
- 它记录 admin 操作、失败日志、上传日志等，语义不等于“用户应该收到通知”。
- 反推通知会依赖日志字段细节，后续演进脆弱。

service 层产生业务事件更合适：

- service 已经掌握业务动作是否真正成功。
- service 能拿到规范化后的业务对象和关系。
- service 可以被 router、脚本、后台任务复用。

## 4. OutboxEvent 模型建议

第一版建议字段：

- `id`
- `event_type`
- `aggregate_type`
- `aggregate_id`
- `actor_user_id`
- `payload_json`
- `event_version`
- `status`
- `retry_count`
- `max_retries`
- `available_at`
- `locked_at`
- `locked_by`
- `created_at`
- `processed_at`
- `last_error`
- `last_error_at`
- `dedupe_key`

建议状态：

```txt
pending
processing
processed
failed
dead
```

字段判断：

- `payload_json` 用 `Text` 足够，当前 ActivityLog 也使用 Text 存 JSON。
- `event_version` 第一版就建议加入，默认 `1`，便于以后 payload 演进。
- `dedupe_key` 建议第一版就加入，并设置唯一约束。
- `locked_at` / `locked_by` 在 SQLite 下仍建议保留，用于 worker 崩溃后恢复 `processing`。
- `priority` 第一版不需要。
- `correlation_id` / `source` 有价值，但第一版可以暂缓；如需来源信息可先放 payload。
- `last_error` 建议存 Text，但写入时截断到 2000-4000 字。

建议索引：

- `(status, available_at, created_at)`
- `dedupe_key` unique
- `(event_type, created_at)`
- `(aggregate_type, aggregate_id)`

示例 dedupe key：

```txt
comment.created:{comment_id}
```

## 5. Notification 模型建议

第一版建议字段：

- `id`
- `recipient_user_id`
- `actor_user_id`
- `actor_username`
- `actor_display_name`
- `type`
- `title`
- `body`
- `target_type`
- `target_id`
- `target_url`
- `is_read`
- `created_at`
- `read_at`
- `metadata_json`
- `dedupe_key`

字段判断：

- `recipient_user_id` 必须由后端 handler 计算，不能信任前端传入。
- `dedupe_key` 建议必须有，并设置唯一约束，保证 worker 重试不重复创建通知。
- 应保存 actor 快照：`actor_username`、`actor_display_name`。
- 删除目标对象后通知建议保留，点击时提示目标可能已删除。
- 第一版不需要软删除通知，后续可加 `deleted_at`。
- notification preference / 设置表第一版暂缓。

建议索引：

- `(recipient_user_id, created_at)`
- `(recipient_user_id, is_read, created_at)`
- `dedupe_key` unique

## 6. 第一版 comment.created 事件 payload 建议

建议 payload：

```json
{
  "comment_id": "...",
  "actor_user_id": "...",
  "target_type": "user_page",
  "target_id": "...",
  "parent_id": null,
  "reply_to_id": null,
  "root_comment_id": null,
  "content_preview": "...",
  "image_count": 0,
  "created_at": "..."
}
```

字段判断：

- 这些字段足够生成 `comment.reply` 和 `comment.user_page`。
- 建议补充 `root_comment_id`，虽然可由 `parent_id` 推导，但显式保存更清晰。
- `target_url` 建议由 handler 计算，不建议事件源提前硬编码。
- 不建议 payload 只保存 id；如果评论之后被软删或硬删，handler 仍需要最小快照。
- 不应保存完整评论内容，只保存短 `content_preview`，例如 80-120 字。
- `image_count` 可以用于通知文案，例如“并附带图片”。

## 7. event processor 处理流程

建议提供函数：

```txt
process_outbox_events_once(limit=50)
claim_pending_events(limit, locked_by)
handle_event(event)
mark_processed(event)
mark_failed_or_dead(event, exc)
```

处理流程：

1. 恢复超时的 `processing` 事件，例如 `locked_at < now - 10 minutes`。
2. claim 一批 `pending` 或可重试的 `failed` 事件。
3. 将事件标记为 `processing`，写入 `locked_at` 和 `locked_by`。
4. 按 `event_type` 分发 handler。
5. 成功后标记 `processed`，写入 `processed_at`。
6. 失败后 `retry_count += 1`，写入 `last_error`、`last_error_at`。
7. 如果未超过 `max_retries`，设置新的 `available_at`，进入 `failed` 或回到 `pending`。
8. 超过 `max_retries` 后进入 `dead`。

SQLite 并发建议：

- 第一版只允许单 worker。
- claim 阶段使用短事务，避免长时间占用 SQLite 写锁。
- 即使单 worker，也保留 `locked_at` / `locked_by`，便于恢复异常状态。

失败处理建议：

- 简单 backoff 即可，例如 1 分钟、5 分钟、30 分钟。
- `last_error` 截断到 2000-4000 字。
- 通知处理失败不影响已经成功写入的业务数据。
- 第一版不需要把 event 处理过程写入 ActivityLog，先靠 OutboxEvent 状态和后端 logger 排查。

## 8. 通知规则

第一版只做评论相关。

### comment.reply

规则：

- A 回复 B 的评论，通知 B。
- A 回复自己，不通知。
- 回复子评论时通知 `reply_to_id` 对应评论的作者，不通知 root comment 作者。

依据：

- 当前 Comment 模型中 `parent_id` 表示归属的一级评论。
- `reply_to_id` 表示实际点击回复的评论。

dedupe key：

```txt
comment.reply:{comment_id}:{recipient_user_id}
```

### comment.user_page

规则：

- `target_type == "user_page"` 时，`target_id` 是被留言用户的 user id。
- A 在 B 的用户页留言，通知 B。
- A 在自己主页留言，不通知。

dedupe key：

```txt
comment.user_page:{comment_id}:{recipient_user_id}
```

### 冲突规则

如果一个动作同时满足 `comment.reply` 和 `comment.user_page`：

```txt
只生成 comment.reply
```

原因：

- 回复已有明确 recipient。
- 避免同一个动作给同一个用户生成两条通知。

### target_url

第一版可以先跳评论所在页面：

- 用户页留言：`/users/{username}`
- 无法精确跳转评论时，先跳页面即可。

作品评论通知第一版暂缓。

## 9. API 规划

通知接口：

```txt
GET  /api/notifications
GET  /api/notifications/unread-count
POST /api/notifications/{notification_id}/read
POST /api/notifications/read-all
```

`GET /api/notifications` 参数：

- `limit`，默认 20，建议最大 100。
- `offset`，默认 0。
- `unread_only`，默认 false。

返回字段建议使用 camelCase：

```json
{
  "items": [
    {
      "id": "...",
      "type": "comment.reply",
      "title": "...",
      "body": "...",
      "actorUserId": "...",
      "actorUsername": "...",
      "actorDisplayName": "...",
      "targetType": "comment",
      "targetId": "...",
      "targetUrl": "/users/name",
      "isRead": false,
      "createdAt": "...",
      "readAt": null,
      "metadata": {}
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

权限要求：

- 所有接口使用现有 `require_current_user`。
- 用户只能读取自己的 Notification。
- 用户只能标记自己的通知已读。
- `read-all` 只影响当前用户。
- 第一版暂缓 DELETE 通知。

## 10. 前端规划

第一版前端工作：

- 新增 `api/notifications.ts`。
- 新增 `/notifications` 页面。
- Navbar 显示未读红点或数字 badge。
- 通知列表展示 title、body、actor、time、read 状态。
- 点击通知后标记已读，再跳转 `targetUrl`。
- 提供全部已读按钮。

未读数刷新：

- 第一版只在页面加载、登录态变化、打开用户菜单或 Navbar 初始化时请求 `unread-count`。
- 后续再考虑 60-120 秒轻量轮询。

target_url 失效处理：

- 前端跳转后如果目标页 404，显示目标可能已删除。
- 第一版不需要为失效通知做特殊后端修复。

## 11. 与 ActivityLog 的关系

明确边界：

- Notification 不等于 ActivityLog。
- Notification 不从 ActivityLog 反推。
- OutboxEvent 是未来统一地基。
- 现有 ActivityLog v1 保持冻结，不立即重构。
- 未来新功能可以从 OutboxEvent 同时派生 ActivityLog 和 Notification。
- 后续有空可逐步迁移旧日志点到 event handler。

当前 ActivityLog 继续作为审计日志：

- 记录重要业务写操作。
- 不记录普通页面访问。
- 不作为通知源。

## 12. 分阶段实施计划

### 阶段 1：建地基

- 新增 `OutboxEvent` 模型。
- 新增 `Notification` 模型。
- 新增 outbox service。
- 新增 notification service。
- 新增 notification router。
- 新增 event processor 脚本或 service。
- 在 `main.py` include notification router。

### 阶段 2：接 comment.created

- 在 `create_comment` 成功后写 OutboxEvent。
- handler 生成 `comment.reply` / `comment.user_page` 通知。
- 跳过自己通知。
- 加 dedupe。

### 阶段 3：前端通知

- 新增 `api/notifications.ts`。
- 新增 `NotificationsPage`。
- Navbar 接入 unread badge。

### 阶段 4：验证与补强

- 验证去重。
- 验证重试。
- 验证 dead event 检查。
- 优化 target_url。
- 增加必要的 smoke test 文档或测试脚本。

### 阶段 5：未来扩展

- 作品评论通知。
- 收藏更新通知。
- 章节创建 / 发布通知。
- ActivityLog 逐步迁移到 event handler。

## 13. 需要补充确认的文件或信息

进入实施前建议确认：

- 是否要引入数据库迁移流程；当前项目没有迁移系统，`create_all` 不能给已有表自动加字段。
- 前端登录态 / AuthContext 的具体文件，用于 Navbar unread-count 接入。
- 小说、漫画详情页和章节页的最终 URL 规范。
- event processor 是放 repo 内 Python module，还是额外提供 systemd timer 示例。

## 14. 风险清单和验证清单

风险：

- 当前多个 service 内部直接 `commit()`，OutboxEvent 与业务写入的事务边界需要谨慎。
- SQLite 不适合多 worker 高并发，第一版应按单 worker 设计。
- 评论硬删除后，handler 如果只查数据库可能找不到评论。
- payload_json 可能误放敏感信息，需要明确过滤规则。
- 前端不能决定 recipient，否则会形成越权通知。
- OutboxEvent 不能暴露给普通用户。

验证清单：

- A 回复 B，B 收到一条 `comment.reply`。
- A 回复自己，不生成通知。
- A 在 B 用户页留言，B 收到一条 `comment.user_page`。
- A 在自己用户页留言，不生成通知。
- user_page 中回复评论时只生成 `comment.reply`。
- 重跑同一个 event 不重复创建通知。
- worker 崩溃后，超时 `processing` event 能恢复处理。
- 超过最大重试后 event 进入 `dead`。
- 用户不能读取别人的通知。
- 用户不能标记别人的通知已读。
- 普通用户没有 OutboxEvent 访问入口。
