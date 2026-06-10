# Event Outbox and Notification Current State

本文档记录 Event / OutboxEvent / Notification 的当前实现、设计边界和后续补强项。

当前状态：基础链路已实现，消息通知系统已经接入评论事件。

实现范围：

- 后端仍使用 FastAPI + SQLModel + SQLite。
- 不引入 Redis、Celery、RabbitMQ、Kafka。
- 不引入第二套认证。
- 普通用户不能访问 OutboxEvent。
- 前端不能决定通知 recipient。
- payload 和 metadata 不能记录密码、token、完整评论正文、完整小说正文、完整 buffer 正文。
- Notification 不做访问统计。

## 1. 当前结论

项目已经采用：

```txt
service 层写 OutboxEvent，独立 worker / script 处理事件并派生 Notification
```

当前已完成：

- `OutboxEvent` 模型。
- `Notification` 模型。
- `outbox service`：创建事件、claim pending/failed 事件、恢复超时 processing、标记 processed/failed/dead。
- `notification service`：创建通知、序列化通知、分页查询、未读计数、标记已读、全部已读。
- `event processor`：`process_outbox_events_once()`。
- CLI 脚本：`backend/scripts/process_outbox_events.py`。
- `notification router`：`/api/notifications`。
- `comment.created` 事件源：`app.services.interactions.create_comment`。
- 前端通知 API：`frontend/src/api/notifications.ts`。
- 前端通知页：`/notifications`。
- Navbar 未读 badge 和通知入口。

当前事件流：

```txt
评论创建成功
-> 同一业务事务写入 OutboxEvent(comment.created)
-> 运行 process_outbox_events.py
-> claim pending / failed events
-> event handler 根据 comment.created 生成 Notification
-> 标记 OutboxEvent 为 processed / failed / dead
-> 前端通过通知接口展示、标记已读和跳转
```

## 2. 后端实现

### 2.1 OutboxEvent

模型位置：`backend/app/models.py`

当前字段：

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

当前状态：

```txt
pending
processing
processed
failed
dead
```

当前索引：

- `(status, available_at, created_at)`
- `(event_type, created_at)`
- `(aggregate_type, aggregate_id)`
- `dedupe_key` unique

当前 dedupe key 示例：

```txt
comment.created:{comment_id}
```

### 2.2 Notification

模型位置：`backend/app/models.py`

当前字段：

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

当前索引：

- `(recipient_user_id, created_at)`
- `(recipient_user_id, is_read, created_at)`
- `dedupe_key` unique

设计判断：

- `recipient_user_id` 由后端 handler 计算，不能由前端传入。
- 通知保存 actor 快照：`actor_username`、`actor_display_name`。
- 通知创建使用 `dedupe_key` 防止 worker 重试时重复生成。
- 删除目标对象后通知保留；点击后的目标不存在由目标页处理。
- 第一版仍不做软删除通知和 notification preference。

### 2.3 comment.created payload

事件源位置：`backend/app/services/interactions.py`

当前 payload：

```json
{
  "comment_id": "...",
  "actor_user_id": "...",
  "target_type": "user_page",
  "target_id": "...",
  "parent_id": null,
  "reply_to_id": null,
  "root_comment_id": "...",
  "content_preview": "...",
  "image_count": 0,
  "created_at": "..."
}
```

说明：

- `content_preview` 是短预览，不保存完整评论正文。
- `image_count` 用于前端展示“图片 N 张”。
- `target_url` 由 handler 根据目标对象计算，不在事件源中硬编码。
- OutboxEvent 与评论创建处于同一业务提交路径；事件创建失败会回滚评论创建。

## 3. Event Processor

核心函数位置：`backend/app/services/event_processor.py`

CLI 脚本位置：`backend/scripts/process_outbox_events.py`

当前流程：

1. 恢复超时 `processing` 事件，默认阈值 10 分钟。
2. claim 一批 `pending` 或到期的 `failed` 事件。
3. 将事件标记为 `processing`，写入 `locked_at` 和 `locked_by`。
4. 按 `event_type` 分发 handler。
5. 成功后标记 `processed`，写入 `processed_at`。
6. 失败后 `retry_count += 1`，写入 `last_error`、`last_error_at`。
7. 未超过 `max_retries` 时进入 `failed`，并设置 backoff 后的 `available_at`。
8. 达到 `max_retries` 后进入 `dead`。

当前 backoff：

```txt
第 1 次失败：1 分钟
第 2 次失败：5 分钟
第 3 次及以后：30 分钟
```

运行示例：

```bash
cd backend
python scripts/process_outbox_events.py --limit 50 --json
```

可用环境变量：

- `OUTBOX_PROCESS_LIMIT`
- `OUTBOX_LOCKED_BY`
- `OUTBOX_PROCESS_JSON`

部署建议：

- 第一版按单 worker 运行。
- 可由手动命令、cron、systemd timer 或现有部署脚本周期性触发。
- 目前仓库内只有脚本，没有提交 systemd timer 示例。

## 4. 通知规则

当前只由 `comment.created` 派生通知，但覆盖范围已经包括用户页、回复、小说和漫画作品评论。

### 4.1 comment.reply

规则：

- A 回复 B 的评论，通知 B。
- A 回复自己，不通知。
- 回复子评论时通知 `reply_to_id` 对应评论的作者，不通知 root comment 作者。
- 如果同一个动作同时满足用户页留言或作品评论，回复通知优先，只生成 `comment.reply`。

dedupe key：

```txt
comment.reply:{comment_id}:{recipient_user_id}
```

target：

- `target_type = "comment"`
- `target_id = comment_id`
- `target_url` 指向评论所在页面，暂不带评论锚点。

### 4.2 comment.user_page

规则：

- `target_type == "user_page"` 时，`target_id` 是被留言用户的 user id。
- A 在 B 的用户页一级留言，通知 B。
- A 在自己主页留言，不通知。
- 用户页回复不生成 `comment.user_page`，由 `comment.reply` 处理。

dedupe key：

```txt
comment.user_page:{comment_id}:{recipient_user_id}
```

target：

- `target_type = "user_page"`
- `target_id = recipient_user_id`
- `target_url = /users/{username}`

### 4.3 作品评论 owner 通知

当前已实现，原计划中的“作品评论通知第一版暂缓”已经过期。

支持目标：

- `novel` -> `comment.novel`
- `novel_chapter` -> `comment.novel_chapter`
- `comic_part` -> `comment.comic_part`
- `comic_chapter` -> `comment.comic_chapter`

规则：

- 只处理一级评论；回复仍由 `comment.reply` 处理。
- 查找作品 owner，给所有 owner 生成通知。
- 评论者本人如果也是 owner，不给自己发通知。
- 多 owner 时每个 recipient 各有一条通知。

dedupe key：

```txt
{notification_type}:{comment_id}:{recipient_user_id}
```

target：

- `target_type` 保持作品目标类型。
- `target_id` 保持作品目标 id。
- `target_url` 指向小说、小说章节、漫画分部或漫画章节页面。

## 5. API

Router 位置：`backend/app/routers/notifications.py`

当前接口：

```txt
GET  /api/notifications
GET  /api/notifications/unread-count
POST /api/notifications/{notification_id}/read
POST /api/notifications/read-all
```

`GET /api/notifications` 参数：

- `limit`，默认 20，范围 1-100。
- `offset`，默认 0。
- `unread_only`，默认 false。

返回字段使用 camelCase：

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
- 当前没有 DELETE 通知接口。

## 6. 前端实现

已完成：

- `frontend/src/api/notifications.ts`
- `frontend/src/pages/NotificationsPage.tsx`
- `frontend/src/components/NavbarUserMenu.tsx` 未读 badge 和通知入口
- `frontend/src/App.tsx` 注册 `/notifications`

通知页当前能力：

- 拉取最近 12 条通知。
- 展示通知类型、标题、正文预览、actor、时间、未读状态和图片数量。
- 本地搜索标题、正文、发送者和类型。
- 本地按类型筛选。
- 本地按已读/未读筛选。
- 全部标记已读。
- 点击通知时先标记已读，再跳转 `targetUrl`。

Navbar 当前能力：

- 登录后请求 `unread-count`。
- 展示未读 badge，超过 99 显示 `99+`。
- 监听 `notifications-changed` 事件刷新未读数。
- 登录态变化后重新加载用户和未读数。

当前限制：

- 通知页只加载第一页 12 条，没有“加载更多”或分页控件。
- 前端筛选只作用于已加载的 12 条，不是服务端全量筛选。
- 没有轮询或 SSE；未读数只在初始化、登录态变化和通知变更事件后刷新。
- 通知页空状态文案仍偏向“评论回复或主页留言”，还没有覆盖作品评论。

## 7. 与 ActivityLog 的关系

当前边界保持不变：

- Notification 不等于 ActivityLog。
- Notification 不从 ActivityLog 反推。
- OutboxEvent 是未来统一地基。
- 现有 ActivityLog v1 保持冻结，不立即重构。
- 当前 ActivityLog 继续作为审计日志。
- 后续新功能可以从 OutboxEvent 同时派生 ActivityLog 和 Notification。

## 8. 功能评价

整体功能已经具备可用的消息通知闭环：

- 事件源在 service 层，位置合理。
- 通知 recipient 由后端计算，权限边界正确。
- OutboxEvent 和 Notification 都有 dedupe key，具备重试幂等基础。
- worker 有 claim、失败重试、dead event 和 processing 恢复，满足 SQLite 单 worker 场景。
- 前端有入口、未读数、列表、筛选、全部已读和点击跳转，用户可直接使用。

需要优先补强的点：

- 补测试，尤其是 recipient、跳过自己、去重、重试和权限。
- 给 event processor 增加部署调度说明或 systemd timer 示例。
- 通知页增加分页或加载更多，否则超过 12 条后无法继续查看。
- 修正通知页空状态文案，让作品评论也被准确说明。
- 评估 `create_notification()` 和 `create_outbox_event()` 中 `IntegrityError` 后 `session.rollback()` 对调用事务的影响；当前可能回滚同一 session 内已经处理的其他通知或事件状态，尤其是多 owner 通知和 worker 处理路径。

## 9. 后续计划

短期：

- 增加后端测试或 smoke test，覆盖验证清单。
- 增加通知页分页 / 加载更多。
- 更新通知页空状态文案。
- 补 processor 调度文档。
- 检查并调整 IntegrityError 幂等处理，避免在 helper 内直接 rollback 外层事务。

中期：

- target_url 增加评论锚点或 query，点击后尽量定位到具体评论。
- 增加轻量刷新策略，例如进入菜单时刷新或 60-120 秒轮询。
- 增加管理侧 dead event 检查或运维命令说明。

未来扩展：

- 收藏更新通知。
- 章节创建 / 发布通知。
- 关注 / 被关注通知。
- ActivityLog 逐步迁移到 event handler。

## 10. 风险和验证清单

风险：

- 当前多个 service 内部直接 `commit()`，OutboxEvent 与业务写入的事务边界需要持续谨慎。
- SQLite 不适合多 worker 高并发，第一版应按单 worker 设计。
- 评论或目标对象硬删除后，handler 可能无法计算 recipient 或 target_url。
- payload_json 和 metadata_json 需要持续避免保存敏感信息和完整正文。
- OutboxEvent 不能暴露给普通用户。
- `session.rollback()` 出现在幂等 helper 内，后续补测试时需要重点验证。

验证清单：

- A 回复 B，B 收到一条 `comment.reply`。
- A 回复自己，不生成通知。
- A 在 B 用户页一级留言，B 收到一条 `comment.user_page`。
- A 在自己用户页留言，不生成通知。
- user_page 中回复评论时只生成 `comment.reply`。
- A 评论 B 拥有的小说，B 收到 `comment.novel`。
- A 评论 B 拥有的小说章节，B 收到 `comment.novel_chapter`。
- A 评论 B 拥有的漫画分部，B 收到 `comment.comic_part`。
- A 评论 B 拥有的漫画章节，B 收到 `comment.comic_chapter`。
- 作品 owner 评论自己的作品，不生成给自己的通知。
- 多 owner 作品只给非评论者 owner 各生成一条通知。
- 重跑同一个 event 不重复创建通知。
- worker 崩溃后，超时 `processing` event 能恢复处理。
- 超过最大重试后 event 进入 `dead`。
- 用户不能读取别人的通知。
- 用户不能标记别人的通知已读。
- `read-all` 只影响当前用户。
- 普通用户没有 OutboxEvent 访问入口。
