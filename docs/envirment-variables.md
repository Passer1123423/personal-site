# Environment Variables

本文档记录个人网站项目当前实际使用的环境变量。  
本地开发、服务器部署都应通过环境变量配置敏感信息和部署路径，避免把本地路径、密钥或生产配置写死在代码中。

## Backend

后端运行目录通常为：

```bash
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 18001
SECRET_KEY

用途：JWT 签名密钥。

必须设置。不能使用默认开发值。
生产环境应使用新的长随机字符串，不要复用本地开发密钥。

本地示例：

export SECRET_KEY="dev-local-secret-change-before-public-deploy"

生产示例：

export SECRET_KEY="replace-with-a-long-random-production-secret"
ACCESS_TOKEN_EXPIRE_MINUTES

用途：访问 token 有效期，单位为分钟。

当前默认值为 10080 分钟，即 7 天。
如果不设置，代码默认仍按 7 天处理。

本地示例：

export ACCESS_TOKEN_EXPIRE_MINUTES="10080"
CORS_ALLOW_ORIGINS

用途：允许访问后端 API 的前端来源，多个地址用英文逗号分隔。

本地示例：

export CORS_ALLOW_ORIGINS="http://127.0.0.1:18000,http://localhost:18000"

生产环境如果前后端同源部署，通常主要由 Nginx 反向代理处理 /api/，CORS 压力较小。
如果跨域部署，应只填写明确的 HTTPS 域名，例如：

export CORS_ALLOW_ORIGINS="https://example.com"
UPLOADS_DIR

用途：后端上传文件根目录。

如果不设置，默认使用：

backend/uploads

本地一般可以不设置。
如果希望显式指定：

export UPLOADS_DIR="$HOME/personal-site/backend/uploads"

生产环境建议指定到明确的数据目录，例如：

export UPLOADS_DIR="/var/www/personal-site/uploads"

注意：UPLOADS_DIR 必须和 Nginx 或 FastAPI 静态资源服务的 /uploads 目录保持一致。

Frontend

前端构建目录通常为：

cd frontend
npm run build
VITE_API_BASE_URL

用途：前端请求后端 API 的基础地址。

本地默认值已经在代码中保留为：

http://127.0.0.1:18001

所以本地开发可以不设置。

如果需要显式设置：

export VITE_API_BASE_URL="http://127.0.0.1:18001"

生产环境如果前后端同源部署，建议在构建前设置为空字符串，使前端请求 /api/...：

export VITE_API_BASE_URL=""
npm run build

如果前后端不同域名部署，则设置为后端 API 域名：

export VITE_API_BASE_URL="https://api.example.com"
npm run build
Local WSL Persistent Config

如果在个人 PC 的 WSL 中长期开发，可以写入：

nano ~/.bashrc

追加：

# personal-site backend dev env
export SECRET_KEY="dev-local-secret-change-before-public-deploy"
export ACCESS_TOKEN_EXPIRE_MINUTES="10080"
export CORS_ALLOW_ORIGINS="http://127.0.0.1:18000,http://localhost:18000"
export UPLOADS_DIR="$HOME/personal-site/backend/uploads"

# personal-site frontend dev env
export VITE_API_BASE_URL="http://127.0.0.1:18001"

保存后执行：

source ~/.bashrc
Safety Notes
不要把 .env、生产密钥、生产数据库或上传文件提交到 Git。
本地开发密钥和生产服务器密钥应分开。
修改 SECRET_KEY 会导致旧 token 失效，需要重新登录。
生产服务器上的 UPLOADS_DIR 和数据库文件应纳入备份流程.
