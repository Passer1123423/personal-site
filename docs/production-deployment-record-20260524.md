# 生产服务器部署记录：2026-05-24

本文档记录个人网站首次正式服务器部署过程和当前运行状态。  
目标是便于后续维护、回滚、迁移和跨对话继续排查。

## 1. 当前部署结论

当前个人网站已经可以在正式服务器运行。

已验证：

```txt
http://8.163.23.150/
http://8.163.23.150/admin/login
http://8.163.23.150/admin/users
http://8.163.23.150/admin/comics
http://8.163.23.150/register
```

后端、前端、Nginx、systemd、SQLite 空库初始化和管理员登录均已跑通。

当前部署状态：

```txt
Nginx /            -> frontend/dist
Nginx /api/        -> FastAPI 127.0.0.1:18001
Nginx /health      -> FastAPI 127.0.0.1:18001/health
Nginx /uploads/    -> /var/www/personal-site/uploads
FastAPI            -> systemd: personal-site-backend
SQLite             -> backend/data/site.db
```

## 2. 服务器信息

```txt
IP: 8.163.23.150
系统: Ubuntu 24.04.4 LTS
CPU: 2 核
内存: 约 2GB
硬盘: 40GB
```

部署目标是个人小站稳定运行，不按高强度工业级公网系统设计。

当前继续使用：

```txt
FastAPI: 1 worker
SQLite: 继续使用
前端: 本地构建 dist 后上传
Nginx: 服务前端静态文件、uploads，并反代 API
```

## 3. 部署目录

当前生产目录结构：

```txt
/var/www/personal-site/
├── app/
│   └── personal-site/        # Git 项目代码
│       ├── backend/
│       │   ├── .venv/        # 后端虚拟环境
│       │   ├── app/          # FastAPI 应用
│       │   ├── data/site.db  # 生产 SQLite 数据库
│       │   └── backups/      # 当前备份脚本生成目录
│       └── frontend/
│           └── dist/         # 前端生产构建产物
├── uploads/                  # 生产上传资源目录
├── backups/                  # 预留的生产备份目录
└── logs/                     # 预留日志目录
```

当前实际项目根目录：

```txt
/var/www/personal-site/app/personal-site
```

后端目录：

```txt
/var/www/personal-site/app/personal-site/backend
```

前端生产构建目录：

```txt
/var/www/personal-site/app/personal-site/frontend/dist
```

生产上传目录：

```txt
/var/www/personal-site/uploads
```

## 4. Git 部署源

当前项目代码来自：

```txt
https://github.com/Passer1123423/personal-site
```

当前部署分支：

```txt
style-tokens
```

当前部署提交：

```txt
c0ee535 保守调整漫画后台上传服务
```

当前部署前标签：

```txt
deploy-prep-20260523
```

服务器 clone 位置：

```txt
/var/www/personal-site/app/personal-site
```

## 5. apt 源修正记录

服务器系统显示为 Ubuntu 24.04 Noble，但初始 apt 源错误配置为 Ubuntu 22.04 Jammy，导致安装 `python3-venv` 时出现依赖冲突。

系统版本：

```txt
Ubuntu 24.04.4 LTS
VERSION_CODENAME=noble
```

错误源曾为：

```txt
jammy
jammy-updates
jammy-backports
jammy-security
```

已修正为：

```txt
noble
noble-updates
noble-backports
noble-security
```

原 apt 源备份：

```txt
/etc/apt/sources.list.bak-jammy-20260524
```

修正后成功安装：

```txt
nginx 1.24.0
python3.12-venv
```

注意：

```txt
不要删除系统 Python。
不要混装 Python 3.10。
Ubuntu 24.04 默认 Python 3.12，当前项目已用 Python 3.12.3 跑通。
```

## 6. 后端 Python 环境

后端运行目录：

```txt
/var/www/personal-site/app/personal-site/backend
```

虚拟环境：

```txt
/var/www/personal-site/app/personal-site/backend/.venv
```

Python 版本：

```txt
Python 3.12.3
```

依赖安装命令：

```bash
cd /var/www/personal-site/app/personal-site/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

依赖检查命令：

```bash
cd /var/www/personal-site/app/personal-site/backend
source .venv/bin/activate
python -c "import fastapi, sqlmodel, uvicorn; print('backend deps ok')"
```

通过输出：

```txt
backend deps ok
```

## 7. 后端环境变量

生产环境变量文件：

```txt
/etc/personal-site/backend.env
```

权限：

```txt
-rw------- root root
```

当前变量：

```ini
SECRET_KEY=生产随机密钥，不写入文档
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ALLOW_ORIGINS=http://8.163.23.150
UPLOADS_DIR=/var/www/personal-site/uploads
```

注意：

```txt
UPLOADS_DIR 必须和 Nginx /uploads/ alias 指向同一个目录。
```

当前生产上传目录：

```txt
/var/www/personal-site/uploads
```

验证环境变量文件：

```bash
sudo bash -c 'set -a; source /etc/personal-site/backend.env; set +a; echo "UPLOADS_DIR=$UPLOADS_DIR"; echo "ACCESS_TOKEN_EXPIRE_MINUTES=$ACCESS_TOKEN_EXPIRE_MINUTES"; test -n "$SECRET_KEY" && echo "SECRET_KEY set"'
```

预期：

```txt
UPLOADS_DIR=/var/www/personal-site/uploads
ACCESS_TOKEN_EXPIRE_MINUTES=10080
SECRET_KEY set
```

## 8. systemd 后端服务

服务名：

```txt
personal-site-backend
```

服务文件：

```txt
/etc/systemd/system/personal-site-backend.service
```

内容：

```ini
[Unit]
Description=Personal Site FastAPI Backend
After=network.target

[Service]
Type=simple
User=passer
Group=passer
WorkingDirectory=/var/www/personal-site/app/personal-site/backend
EnvironmentFile=/etc/personal-site/backend.env
ExecStart=/var/www/personal-site/app/personal-site/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 18001 --workers 1
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用命令：

```bash
sudo systemctl daemon-reload
sudo systemctl enable personal-site-backend
sudo systemctl start personal-site-backend
```

当前状态：

```txt
personal-site-backend.service active running
FastAPI 监听 127.0.0.1:18001
```

检查命令：

```bash
systemctl status personal-site-backend --no-pager -l
journalctl -u personal-site-backend --no-pager -n 80
journalctl -u personal-site-backend -f
sudo systemctl restart personal-site-backend
sudo systemctl stop personal-site-backend
sudo systemctl start personal-site-backend
```

## 9. Nginx 配置

站点配置：

```txt
/etc/nginx/sites-available/personal-site
/etc/nginx/sites-enabled/personal-site
```

当前配置：

```nginx
server {
    listen 80;
    server_name 8.163.23.150;

    root /var/www/personal-site/app/personal-site/frontend/dist;
    index index.html;

    client_max_body_size 25M;

    location /uploads/ {
        alias /var/www/personal-site/uploads/;
        access_log off;
        expires 7d;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:18001/api/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:18001/health;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

已移除默认站点：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

检查配置：

```bash
sudo nginx -t
```

重载配置：

```bash
sudo systemctl reload nginx
```

Nginx 状态：

```bash
systemctl status nginx --no-pager -l
```

## 10. 端口状态

当前正常端口状态：

```txt
80       -> Nginx，对外开放
18001    -> FastAPI，只监听 127.0.0.1
22       -> SSH
```

检查命令：

```bash
ss -tulpen | grep -E '(:80|:443|:18001|:22)'
```

重点：

```txt
18001 必须只监听 127.0.0.1，不要暴露为 0.0.0.0。
```

## 11. 前端部署方式

服务器不安装 Node，不保留 `node_modules`。  
前端在本地 WSL 构建，然后上传 `dist`。

本地构建：

```bash
cd ~/personal-site/frontend
VITE_API_BASE_URL="" npm run build
```

说明：

```txt
生产同源部署时，VITE_API_BASE_URL 设置为空字符串，使前端请求 /api/...。
```

上传：

```bash
rsync -av --delete   ~/personal-site/frontend/dist/   passer@8.163.23.150:/var/www/personal-site/app/personal-site/frontend/dist/
```

清理 Windows 附加文件：

```bash
ssh passer@8.163.23.150   "find /var/www/personal-site/app/personal-site/frontend/dist -name '*:Zone.Identifier' -delete"
```

也可以在服务器执行：

```bash
find /var/www/personal-site/app/personal-site/frontend/dist -name '*:Zone.Identifier' -delete
```

## 12. 数据库初始化

本次选择从空库开始，不迁移本地 `site.db` 和 `uploads`。

生产数据库：

```txt
/var/www/personal-site/app/personal-site/backend/data/site.db
```

曾出现问题：

```txt
site.db 由 root 创建，导致 passer 用户写入时报：
sqlite3.OperationalError: attempt to write a readonly database
```

已修复权限：

```bash
sudo chown -R passer:passer /var/www/personal-site/app/personal-site/backend/data
chmod 755 /var/www/personal-site/app/personal-site/backend/data
chmod 664 /var/www/personal-site/app/personal-site/backend/data/site.db
```

检查权限：

```bash
cd /var/www/personal-site/app/personal-site/backend
ls -ld data
ls -lah data
```

预期：

```txt
data        passer passer
site.db     passer passer
```

## 13. 管理员初始化

已创建管理员：

```txt
username: passer
display_name: passer
role: admin
```

创建命令：

```bash
cd /var/www/personal-site/app/personal-site/backend
source .venv/bin/activate

set -a
sudo cat /etc/personal-site/backend.env >/tmp/personal-site-env-readable
source /tmp/personal-site-env-readable
rm /tmp/personal-site-env-readable
set +a

PYTHONPATH=. python scripts/create_user.py   --username passer   --display-name passer   --password 123456   --role admin
```

注意：

```txt
123456 是临时初始化密码。上线后应尽快改成强密码。
```

## 14. 已通过的 smoke test

后端健康检查：

```bash
curl --noproxy "*" http://127.0.0.1/health
```

返回：

```json
{"status":"ok"}
```

公开漫画列表：

```bash
curl --noproxy "*" http://127.0.0.1/api/comics
```

返回：

```json
[]
```

管理员登录：

```bash
curl --noproxy "*" -s -X POST "http://127.0.0.1/api/auth/login"   -H "Content-Type: application/json"   -d '{"username":"passer","password":"123456"}'   | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['tokenType']); print(data['user']['username'], data['user']['role'])"
```

返回：

```txt
bearer
passer admin
```

注册开关接口：

```bash
TOKEN=$(curl --noproxy "*" -s -X POST "http://127.0.0.1/api/auth/login"   -H "Content-Type: application/json"   -d '{"username":"passer","password":"123456"}'   | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])")

curl --noproxy "*" -s   -H "Authorization: Bearer $TOKEN"   http://127.0.0.1/api/admin/users/settings/registration
```

返回：

```json
{"enabled":true}
```

浏览器已确认：

```txt
http://8.163.23.150/
http://8.163.23.150/admin/login
http://8.163.23.150/admin/users
http://8.163.23.150/admin/comics
http://8.163.23.150/register
```

页面能看到对应响应。

## 15. 当前备份状态

已运行备份脚本：

```bash
cd /var/www/personal-site/app/personal-site/backend
source .venv/bin/activate
PYTHONPATH=. python scripts/backup_site_data.py
```

生成备份：

```txt
/var/www/personal-site/app/personal-site/backend/backups/backup-20260524-021048/site.db
```

当前备份脚本提示：

```txt
Uploads directory not found, skipped: /var/www/personal-site/app/personal-site/backend/uploads
```

原因：

```txt
backup_site_data.py 目前仍查找 backend/uploads。
但生产真实上传目录是 /var/www/personal-site/uploads。
```

当前空库阶段没有上传图片，所以当时备份有效。

后续状态更新：

```txt
backup_site_data.py 现在已支持 UPLOADS_DIR / --uploads-dir。
生产备份时应确保 UPLOADS_DIR=/var/www/personal-site/uploads，
或显式传 --uploads-dir /var/www/personal-site/uploads。
```

## 16. 当前待处理事项

部署已可运行，但仍建议尽快处理：

```txt
1. 将 passer 的临时密码 123456 改成强密码。
2. 生产备份命令确认带上 UPLOADS_DIR=/var/www/personal-site/uploads。
3. 之后如需正式开放注册，再确认注册开关状态。
4. 后续如绑定域名，再配置 HTTPS。
```

## 17. 常用运维命令

后端：

```bash
systemctl status personal-site-backend --no-pager -l
sudo systemctl restart personal-site-backend
sudo systemctl stop personal-site-backend
sudo systemctl start personal-site-backend
journalctl -u personal-site-backend --no-pager -n 80
journalctl -u personal-site-backend -f
```

Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart nginx
systemctl status nginx --no-pager -l
```

端口：

```bash
ss -tulpen | grep -E '(:80|:443|:18001|:22)'
```

前端更新：

```bash
cd ~/personal-site/frontend
VITE_API_BASE_URL="" npm run build

rsync -av --delete   ~/personal-site/frontend/dist/   passer@8.163.23.150:/var/www/personal-site/app/personal-site/frontend/dist/

ssh passer@8.163.23.150   "find /var/www/personal-site/app/personal-site/frontend/dist -name '*:Zone.Identifier' -delete"
```

后端更新：

```bash
cd /var/www/personal-site/app/personal-site
git pull

cd backend
source .venv/bin/activate
pip install -r requirements.txt

sudo systemctl restart personal-site-backend
curl --noproxy "*" http://127.0.0.1/health
```

## 18. 保守原则

当前部署阶段不做以下事项：

```txt
1. 不迁移到 Cookie 登录。
2. 不切换数据库。
3. 不增加多 worker。
4. 不做 author/admin 权限边界重构。
5. 不重构 comic_admin.py 事务。
6. 不在服务器安装前端 node_modules。
7. 不把生产数据库、uploads、backups、.venv、node_modules 放进 Git。
```

当前优先级：

```txt
稳定运行 > 可备份 > 可恢复 > 小步更新
```
