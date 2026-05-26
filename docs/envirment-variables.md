# Environment Variables

本文档记录当前代码实际读取的环境变量。本地开发和生产部署都应通过环境变量配置敏感信息、API 地址和上传路径。

## Backend

后端运行目录通常为：

```bash
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 18001
```

### SECRET_KEY

用途：JWT 签名密钥。

必须设置。`backend/app/core/security.py` 会在 `SECRET_KEY` 缺失或等于 `dev-secret-key-change-me` 时直接让后端启动失败。

本地示例：

```bash
export SECRET_KEY="dev-local-secret-change-before-public-deploy"
```

生产示例：

```bash
export SECRET_KEY="replace-with-a-long-random-production-secret"
```

### ACCESS_TOKEN_EXPIRE_MINUTES

用途：访问 token 有效期，单位为分钟。

默认值是 `10080`，即 7 天。

```bash
export ACCESS_TOKEN_EXPIRE_MINUTES="10080"
```

### CORS_ALLOW_ORIGINS

用途：允许访问后端 API 的前端来源，多个地址用英文逗号分隔。

本地示例：

```bash
export CORS_ALLOW_ORIGINS="http://127.0.0.1:18000,http://localhost:18000"
```

生产如果前后端同源部署，通常由 Nginx 反向代理 `/api/`。如果跨域部署，应只填写明确域名：

```bash
export CORS_ALLOW_ORIGINS="https://example.com"
```

### UPLOADS_DIR

用途：后端上传文件根目录。

不设置时默认：

```txt
backend/uploads
```

本地显式指定示例：

```bash
export UPLOADS_DIR="$HOME/personal-site/backend/uploads"
```

生产示例：

```bash
export UPLOADS_DIR="/var/www/personal-site/uploads"
```

注意：`UPLOADS_DIR` 必须和 Nginx `/uploads/` alias 指向同一个目录。

### DB_PATH

用途：备份脚本读取的 SQLite 数据库路径。

代码中的后端运行时数据库路径仍由 `backend/app/database.py` 固定为 `backend/data/site.db`；`DB_PATH` 目前用于 `backend/scripts/backup_site_data.py`。

默认值：

```txt
backend/data/site.db
```

示例：

```bash
export DB_PATH="$HOME/personal-site/backend/data/site.db"
```

### BACKUPS_DIR

用途：备份脚本输出目录。

默认值：

```txt
backend/backups
```

示例：

```bash
export BACKUPS_DIR="$HOME/personal-site/backend/backups"
```

### BACKUP_KEEP_LOCAL

用途：备份脚本保留本地 `.tar.gz` 归档数量。

默认值：

```txt
7
```

### Remote Backup Variables

用途：让 `backend/scripts/backup_site_data.py` 备份后把归档复制到远程主机。

当前支持：

```txt
BACKUP_REMOTE_DEST
BACKUP_REMOTE_PORT
BACKUP_REMOTE_IDENTITY_FILE
BACKUP_REMOTE_PLATFORM
BACKUP_REMOTE_LATEST_NAME
```

示例：

```bash
export BACKUP_REMOTE_DEST="user@example.com:/home/user/personal-site-backups"
export BACKUP_REMOTE_PORT="22"
export BACKUP_REMOTE_PLATFORM="posix"
export BACKUP_REMOTE_LATEST_NAME="personal-site-latest.tar.gz"
```

## Frontend

前端构建目录通常为：

```bash
cd frontend
npm run build
```

### VITE_API_BASE_URL

用途：前端请求后端 API 的基础地址。

读取位置：

```txt
frontend/src/api/config.ts
```

本地默认值：

```txt
http://127.0.0.1:18001
```

本地显式指定：

```bash
export VITE_API_BASE_URL="http://127.0.0.1:18001"
```

生产同源部署时，构建前设置为空字符串，使前端请求 `/api/...`：

```bash
VITE_API_BASE_URL="" npm run build
```

前后端不同域名部署时，设置为后端 API 域名：

```bash
VITE_API_BASE_URL="https://api.example.com" npm run build
```

## Local WSL Persistent Config

如果在个人 PC 的 WSL 中长期开发，可以写入 `~/.bashrc`：

```bash
# personal-site backend dev env
export SECRET_KEY="dev-local-secret-change-before-public-deploy"
export ACCESS_TOKEN_EXPIRE_MINUTES="10080"
export CORS_ALLOW_ORIGINS="http://127.0.0.1:18000,http://localhost:18000"
export UPLOADS_DIR="$HOME/personal-site/backend/uploads"
export DB_PATH="$HOME/personal-site/backend/data/site.db"
export BACKUPS_DIR="$HOME/personal-site/backend/backups"

# personal-site frontend dev env
export VITE_API_BASE_URL="http://127.0.0.1:18001"
```

保存后执行：

```bash
source ~/.bashrc
```

## Safety Notes

- 不要把 `.env`、生产密钥、生产数据库或上传文件提交到 Git。
- 本地开发密钥和生产服务器密钥应分开。
- 修改 `SECRET_KEY` 会导致旧 token 失效，需要重新登录。
- 生产服务器上的 `UPLOADS_DIR` 和数据库文件应纳入备份流程。
