1. 新增 User 模型
2. 新增 create_user.py 脚本
3. 新增密码哈希工具
4. 新增注册接口 POST /api/auth/register
5. 新增登录接口 POST /api/auth/login
6. 新增当前用户接口 GET /api/auth/me
7. 新增公开用户接口 GET /api/users/{username}
8. 新增用户后台接口 /api/admin/users
9. 改 require_admin_user，从固定返回改为校验 token + role
10. 前端新增 auth.ts、users.ts、adminUsers.ts
11. 前端新增 /admin/login、/register、/users/:username、/admin、/admin/users
12. adminComics.ts 和 adminUsers.ts 请求带 Authorization

User 模型目标

username
稳定登录名，也作为账号号码使用。用于登录和长期识别，不建议随便改。

display_name
显示名。用于页面展示，可以以后修改。

password_hash
密码哈希。只保存加密后的密码，不保存明文密码。

role
用户权限。先保留 reader / author / admin。

avatar_url 或 avatar_asset_id
头像字段。第一阶段可以为空，后续再接头像上传。

bio
简洁个人简介或占位简介。第一阶段可以为空字符串。

is_active
账号是否可用。先简单保留，方便以后临时停用账号。

created_at
创建时间。

updated_at
更新时间。可选但建议有。

class User(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)

    username: str = Field(index=True, unique=True)
    display_name: str

    password_hash: str

    role: str = "reader"
    is_active: bool = True

    avatar_asset_id: str | None = Field(default=None, foreign_key="asset.id")
    bio: str = ""

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

---

当前实现补充

以下内容是项目当前实现相对上方设计目标的实际新增和差异点，用于后续对接时保持字段、命名、调用方式一致。

后端文件与挂载

当前认证相关后端文件：

backend/app/core/security.py
backend/app/dependencies/auth.py
backend/app/routers/auth.py
backend/scripts/create_user.py

当前 `backend/app/main.py` 已挂载：

app.include_router(auth_router)
app.include_router(comic_admin_router)

因此认证接口路径来自 `backend/app/routers/auth.py` 中的：

router = APIRouter(prefix="/api/auth", tags=["auth"])

当前后端认证流程

POST /api/auth/register

请求体字段：

username
displayName
password
bio（后端支持，当前前端注册表单不提交）

处理流程：

1. `username = payload.username.strip()`。
2. `display_name = payload.displayName.strip()`。
3. 用户名为空返回 400，detail 为 `用户名不能为空`。
4. 显示名为空返回 400，detail 为 `显示名不能为空`。
5. 密码少于 6 位返回 400，detail 为 `密码至少需要 6 位`。
6. 用户名已存在返回 400，detail 为 `用户名已存在`。
7. 创建 `User`，其中 `role="reader"`。
8. 使用 `create_access_token({"sub": user.username})` 生成 token。
9. 返回 `accessToken`、`tokenType`、`user`。

POST /api/auth/login

请求体字段：

username
password

处理流程：

1. 用 `username` 查询 `User.username`。
2. 用户不存在时返回 401，detail 为 `用户名或密码错误`。
3. `user.is_active` 为 false 时返回 403，detail 为 `账号不可用`。
4. 使用 `verify_password(payload.password, user.password_hash)` 校验密码。
5. 密码错误时返回 401，detail 为 `用户名或密码错误`。
6. 使用 `create_access_token({"sub": user.username})` 生成 token。
7. 返回 `accessToken`、`tokenType`、`user`。

返回体字段：

accessToken
字符串。前端保存到 localStorage，后续请求放进 `Authorization: Bearer ${token}`。

tokenType
当前固定返回 `"bearer"`。

user
由 `user_to_public(user)` 转换后的公开用户对象。

GET /api/auth/me

依赖：

current_user: User = Depends(require_current_user)

返回：

user_to_public(current_user)

当前公开用户对象字段

`backend/app/routers/auth.py` 的 `user_to_public(user)` 当前返回：

id
username
displayName
role
isActive
avatarUrl
bio
createdAt

字段命名注意：

后端数据库字段 `display_name` 返回给前端时转换为 `displayName`。
后端数据库字段 `is_active` 返回给前端时转换为 `isActive`。
后端数据库字段 `created_at` 返回给前端时转换为 `createdAt`。
当前公开返回没有 `updatedAt`。
当前公开返回的 `avatarUrl` 固定为 `None`，没有从 `avatar_asset_id` 转换。

当前 User 模型差异

`backend/app/models.py` 中当前 `User.display_name` 是：

display_name: str | None = Field(default=None)

这与上方目标里的必填 `display_name: str` 不完全一致。当前创建用户脚本仍要求传入 `--display-name`，但模型层允许为空。

当前 `User` 模型字段为：

id
username
display_name
password_hash
role
is_active
avatar_asset_id
bio
created_at
updated_at

当前密码与 token 实现

`backend/app/core/security.py` 中当前使用 passlib 的 bcrypt：

hash_password(password: str) -> str
verify_password(plain_password: str, password_hash: str) -> bool

JWT token 当前实现：

SECRET_KEY = "dev-secret-key-change-me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

`create_access_token(data: dict, expires_delta: timedelta | None = None)` 会复制传入 data，追加 `exp`，再用 HS256 编码。

`decode_access_token(token: str)` 解码失败时抛出 `ValueError("Invalid token")`。

当前用户依赖

`backend/app/dependencies/auth.py` 中当前使用：

bearer_scheme = HTTPBearer(auto_error=False)

require_current_user 的流程：

1. 没有 credentials：401，detail 为 `未登录`。
2. credentials scheme 不是 bearer：401，detail 为 `认证格式错误`。
3. token 解码失败：401，detail 为 `登录已失效`。
4. token payload 中没有 `sub`：401，detail 为 `登录信息无效`。
5. 用 `sub` 作为 username 查询用户。
6. 用户不存在：401，detail 为 `用户不存在`。
7. 用户不可用：403，detail 为 `账号不可用`。
8. 成功时返回 `User` 模型对象。

require_admin_user 的流程：

1. 依赖 `require_current_user`。
2. `current_user.role != "admin"` 时返回 403，detail 为 `没有管理员权限`。
3. 成功时返回当前 `User` 模型对象。

漫画后台鉴权方式

`backend/app/routers/comic_admin.py` 的 router 当前使用：

dependencies=[Depends(require_admin_user)]

因此 `/api/admin/comics` 下所有接口都要求请求带有效 bearer token，且当前用户 `role` 必须是 `"admin"`。

前端认证 API

当前文件：

frontend/src/api/auth.ts

常量：

API_BASE_URL = "http://127.0.0.1:18001"
TOKEN_KEY = "personal_site_access_token"

前端类型 `AuthUser` 当前字段：

id: string
username: string
displayName: string
role: string
isActive: boolean
avatarUrl: string | null
bio: string
createdAt: string

前端类型 `LoginResponse` 当前字段：

accessToken: string
tokenType: string
user: AuthUser

前端类型 `RegisterParams` 当前字段：

username: string
displayName: string
password: string

函数：

login(username: string, password: string): Promise<LoginResponse>
调用 `POST /api/auth/login`，请求 JSON 为 `{ username, password }`。失败时优先使用后端 `detail`，否则抛出 `登录失败`。

getMe(): Promise<AuthUser>
先读取 localStorage token；没有 token 时直接抛出 `未登录`。有 token 时调用 `GET /api/auth/me`，请求头为 `Authorization: Bearer ${token}`。失败时优先使用后端 `detail`，否则抛出 `获取当前用户失败`。

saveAccessToken(token: string)
写入 localStorage 的 `personal_site_access_token`，然后派发 `window.dispatchEvent(new Event("auth-changed"))`。

getAccessToken(): string | null
读取 localStorage 的 `personal_site_access_token`。

clearAccessToken()
删除 localStorage 的 `personal_site_access_token`，然后派发 `auth-changed` 事件。

register(params: RegisterParams): Promise<LoginResponse>
调用 `POST /api/auth/register`，请求 JSON 为 `{ username, displayName, password }`。失败时优先使用后端 `detail`，否则抛出 `注册失败`。

前端登录页

当前文件：

frontend/src/pages/AdminLoginPage.tsx

当前路由：

/admin/login

`frontend/src/App.tsx` 中注册：

<Route path="/admin/login" element={<AdminLoginPage />} />

页面状态：

username
password
errorMessage
isSubmitting

页面加载时会调用 `getMe()`：

1. 如果当前 token 有效，跳转 `/users/${user.username}`，并使用 `{ replace: true }`。
2. 如果失败，调用 `clearAccessToken()`。

提交登录时：

1. `event.preventDefault()`。
2. 调用 `login(username.trim(), password)`。
3. 成功后调用 `saveAccessToken(result.accessToken)`。
4. 跳转 `/users/${result.user.username}`。
5. 捕获异常时显示异常 message，兜底为 `登录失败`。

前端注册页

当前文件：

frontend/src/pages/RegisterPage.tsx

当前路由：

/register

页面状态：

username
displayName
password
confirmPassword
errorMessage
isSubmitting

提交注册时：

1. 如果两次密码不一致，显示 `两次输入的密码不一致`。
2. 调用 `register({ username: username.trim(), displayName: displayName.trim(), password })`。
3. 成功后调用 `saveAccessToken(result.accessToken)`。
4. 跳转 `/users/${result.user.username}`。

漫画后台页面进入校验

当前文件：

frontend/src/pages/AdminComicsPage.tsx

页面进入时会先执行 `checkLogin()`：

1. 调用 `getMe()`。
2. 如果 `user.role !== "admin"`，跳转 `/admin/login`。
3. 如果成功且是 admin，设置 `isAuthReady` 为 true。
4. 如果失败，调用 `clearAccessToken()` 并跳转 `/admin/login`。

漫画树加载被 `isAuthReady` 控制：

只有 `isAuthReady` 为 true 后才调用 `loadTree()`。

adminComics 请求头

当前文件：

frontend/src/api/adminComics.ts

该文件从 `./auth` 引入：

getAccessToken

当前通过 `getAdminHeaders(extraHeaders?: HeadersInit)` 给所有 admin comics 请求补充 token：

1. 读取 `getAccessToken()`。
2. 返回 `extraHeaders`。
3. 如果 token 存在，追加 `Authorization: Bearer ${token}`。

当前已带 Authorization 的请求包括：

fetchAdminComicsTree
uploadAdminComicChapter
deleteAdminComicChapter
deleteAdminComicPart
deleteAdminComicSeries
moveAdminComicChapter
renameAdminComicSeries
renameAdminComicPart
renameAdminComicChapter
fetchAdminComicOwnerCandidates
setAdminComicPartOwner

用户后台请求头

当前文件：

frontend/src/api/adminUsers.ts

该文件从 `./auth` 引入：

getAccessToken

通过 `getAdminHeaders(extraHeaders?: HeadersInit)` 给用户后台请求补充 token。当前已带 Authorization 的请求包括：

fetchAdminUsers
createAdminUser
updateAdminUser
resetAdminUserPassword
deleteAdminUser

Navbar 登录状态

当前文件：

frontend/src/components/Navbar.tsx

Navbar 当前会调用 `getMe()` 判断登录状态：

1. 成功时 `setIsLoggedIn(true)`。
2. 失败时 `setIsLoggedIn(false)`。
3. 监听 `window` 上的 `auth-changed` 事件，token 保存或清除后会重新检查登录状态。

未登录时显示前往 `/admin/login` 的“登录”入口。

已登录时显示当前用户显示名，链接到 `/users/${currentUser.username}`，并显示“退出登录”按钮。

退出登录流程：

1. 调用 `clearAccessToken()`。
2. `setIsLoggedIn(false)`。
3. 跳转 `/`。

公开用户页

当前文件：

frontend/src/pages/UserPage.tsx

当前路由：

/users/:username

前端调用：

getUserProfile(username)

后端接口：

GET /api/users/{username}

页面展示：

username
displayName
bio
role

当前作品、收藏、动态区域是占位内容，公开用户 API 的 `series` 字段固定为空数组。

用户后台页面

当前文件：

frontend/src/pages/AdminUsersPage.tsx

当前路由：

/admin/users

进入页面时先调用 `getMe()`：

1. 如果不是 admin，跳转 `/admin/login`。
2. 如果失败，调用 `clearAccessToken()` 并跳转 `/admin/login`。
3. 成功后保存当前登录用户名，用于禁止修改或删除当前用户。

当前功能：

- 获取用户列表。
- 创建用户。
- 修改用户显示名。
- 修改用户角色。
- 启用或停用用户。
- 重置密码。
- 删除用户。

用户后台接口全部要求当前用户是 `admin`。

创建用户脚本

当前文件：

backend/scripts/create_user.py

允许角色：

reader
author
admin

命令行参数：

--username
--display-name
--password
--role
--bio

`create_user(...)` 会先检查 role 是否在 `VALID_ROLES` 中，再检查 username 是否已存在。不存在时创建 `User`，其中：

username 来自参数
display_name 来自参数
password_hash 来自 `hash_password(password)`
role 来自参数
bio 来自参数，默认空字符串

`is_active`、`created_at`、`updated_at` 使用模型默认值。
