# PasteGuard - AI脱敏助手

Chrome 浏览器扩展（Manifest V3），在用户粘贴文本到 AI 对话平台前，自动检测并替换敏感信息（API Key、密码、连接串等）。所有处理在本地完成，无网络请求。

## 开发

```bash
npm install
npm run dev
```

在 Chrome 中打开 `chrome://extensions/`，开启"开发者模式"，点击"加载已解压的扩展程序"，选择 `dist` 目录。

## 构建

```bash
npm run build
```

## 项目结构

```
src/
├── core/
│   ├── detector/          # 检测引擎
│   │   ├── regexRules.ts      # 正则规则（环境变量、API Key、连接串等）
│   │   ├── semanticRules.ts   # 语义过滤（关键词、去重）
│   │   ├── nerDetector.ts     # NER 模型检测（@xenova/transformers）
│   │   └── index.ts           # 检测入口（两阶段：正则→NER）
│   ├── replacer/          # 替换引擎
│   │   ├── placeholder.ts     # 占位符生成与解析
│   │   ├── mapping.ts         # 映射表管理
│   │   └── index.ts           # 替换入口
│   └── types/             # TypeScript 类型定义
├── components/            # Vue 组件
├── composables/           # Vue 组合式函数
├── stores/                # Pinia 状态管理
├── sidepanel/             # Side Panel 主界面
├── popup/                 # 弹出窗口
├── background/            # Service Worker
└── ui/                    # UI 基础组件（Reka UI）
```

## 测试案例

### 案例1：Docker Compose 配置

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: SuperSecret123!
      POSTGRES_DB: myapp
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass RedisP@ss2024

  app:
    image: myapp:latest
    environment:
      DATABASE_URL: postgres://admin:SuperSecret123!@postgres:5432/myapp
      REDIS_URL: redis://:RedisP@ss2024@redis:6379
      JWT_SECRET: jwt-secret-key-abc123def456
      AWS_ACCESS_KEY_ID: AKIAIOSFODNN7EXAMPLE
      AWS_SECRET_ACCESS_KEY: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
      OPENAI_API_KEY: sk-proj-1234567890abcdef1234567890abcdef
```

**预期识别**：
- `POSTGRES_PASSWORD: SuperSecret123!` → 环境变量密码
- `redis-server --requirepass RedisP@ss2024` → Redis 密码
- `postgres://admin:SuperSecret123!@postgres` → 连接串密码
- `redis://:RedisP@ss2024@redis` → 连接串密码
- `jwt-secret-key-abc123def456` → JWT 密钥
- `AKIAIOSFODNN7EXAMPLE` → AWS Access Key
- `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` → AWS Secret Key
- `sk-proj-1234567890abcdef1234567890abcdef` → OpenAI API Key

---

### 案例2：.env 文件

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=P@ssw0rd2024!
DB_NAME=myapp

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=r3d1s_s3cur3!

# API Keys
OPENAI_API_KEY=sk-proj-abcdef1234567890abcdef1234567890
STRIPE_SECRET_KEY=sk_live_51abc123def456ghi789

# JWT
JWT_SECRET=my-super-secret-jwt-key-2024
JWT_EXPIRES_IN=7d

# AWS
AWS_ACCESS_KEY_ID=AKIA4EXAMPLE12345678
AWS_SECRET_ACCESS_KEY=7c4a8d09ca3762af61e59520943dc26494f8941b

# Other
NODE_ENV=production
DEBUG=false
LOG_LEVEL=info
```

**预期识别**：
- `DB_PASSWORD=P@ssw0rd2024!` → 环境变量密码
- `REDIS_PASSWORD=r3d1s_s3cur3!` → 环境变量密码
- `OPENAI_API_KEY=sk-proj-abcdef...` → 环境变量 + API Key
- `STRIPE_SECRET_KEY=sk_live_51abc...` → 环境变量 + API Key
- `JWT_SECRET=my-super-secret-jwt-key-2024` → 环境变量密码
- `AWS_ACCESS_KEY_ID=AKIA4EXAMPLE...` → 环境变量 + API Key
- `AWS_SECRET_ACCESS_KEY=7c4a8d09...` → 环境变量 + API Key

**不识别**：
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` → 非敏感变量
- `REDIS_HOST`, `REDIS_PORT` → 非敏感变量
- `NODE_ENV`, `DEBUG`, `LOG_LEVEL` → 白名单变量

---

### 案例3：日志文件中的敏感信息

```
2024-01-15 10:30:22 [INFO] Application started
2024-01-15 10:30:23 [DEBUG] Connecting to database: postgres://admin:DbP@ss2024!@db-server:5432/app
2024-01-15 10:30:24 [ERROR] Connection failed: ECONNREFUSED 127.0.0.1:5432
2024-01-15 10:30:25 [INFO] Retrying connection with redis://default:r3d1s_k3y@redis-server:6379
2024-01-15 10:30:26 [WARN] Token expired: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U
2024-01-15 10:30:27 [INFO] User login successful: username=admin
```

**预期识别**：
- `postgres://admin:DbP@ss2024!@db-server` → 连接串密码
- `redis://default:r3d1s_k3y@redis-server` → 连接串密码
- `eyJhbGciOiJIUzI1NiIs...` → JWT Token

---

### 案例4：代码片段

```python
import os
import psycopg2

# 数据库连接
DATABASE_URL = "postgres://admin:MyS3cur3P@ss@localhost:5432/mydb"
REDIS_URL = "redis://default:wJalrXUtnFEMI@redis:6379"

def get_connection():
    # 使用环境变量
    password = os.getenv('DB_PASSWORD')
    if not password:
        raise ValueError("DB_PASSWORD not set")
    
    return psycopg2.connect(DATABASE_URL)

def get_redis_password():
    # 从配置文件读取
    config = {
        'host': 'redis',
        'port': 6379,
        'password': 'r3d1s_s3cur3_2024!'
    }
    return config['password']

# API 调用
import openai
openai.api_key = "sk-proj-abcdef1234567890abcdef1234567890"

# AWS 服务
aws_secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

**预期识别**：
- `DATABASE_URL = "postgres://admin:MyS3cur3P@ss@localhost..."` → 环境变量 + 连接串密码
- `REDIS_URL = "redis://default:wJalrXUtnFEMI@redis..."` → 环境变量 + 连接串密码
- `'password': 'r3d1s_s3cur3_2024!'` → 字典密码值
- `openai.api_key = "sk-proj-abcdef..."` → API Key
- `aws_secret = "wJalrXUtnFEMI..."` → AWS Secret Key

**不识别**：
- `os.getenv('DB_PASSWORD')` → 函数调用，不是变量赋值
- `password = os.getenv(...)` → 变量名 `password` 不在敏感关键词白名单中（它是临时变量）

---

### 案例5：Kubernetes Secret YAML

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: production
type: Opaque
data:
  # Base64 编码的值
  DB_PASSWORD: UEAzc3cwcmQyMDI0IQ==
  REDIS_PASSWORD: cjNkMXNfczNjdXJlIQ==
  API_KEY: c2stcHJvamMtYWJjZGVmZzEyMzQ1Njc4OTBhYmNkZWZm
  JWT_SECRET: bXktc3VwZXItc2VjcmV0LWp3dC1rZXktMjAyNA==
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_USER: "admin"
  LOG_LEVEL: "info"
```

**预期识别**：
- `DB_PASSWORD: UEAzc3cwcmQyMDI0IQ==` → Secret 中的密码（Base64）
- `REDIS_PASSWORD: cjNkMXNfczNjdXJlIQ==` → Secret 中的密码（Base64）
- `API_KEY: c2stcHJvamMt...` → Secret 中的 API Key（Base64）
- `JWT_SECRET: bXktc3VwZXIt...` → Secret 中的 JWT 密钥（Base64）

**不识别**：
- ConfigMap 中的 `DB_HOST`, `DB_PORT`, `DB_USER`, `LOG_LEVEL` → 非敏感配置

---

### 案例6：边界情况测试

```bash
# 1. 空值
EMPTY_PASSWORD=
EMPTY_KEY=

# 2. 特殊字符
SPECIAL_CHARS="p@ss!w0rd#$%^&*()"
SPECIAL_CHARS2="a]b[c{d}e(f)g"

# 3. 非常长的值
LONG_SECRET=Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4Oo5Pp6Qq7Rr8Ss9Tt0Uu1Vv2Ww3Xx4Yy5Zz6

# 4. 非常短的值
SHORT_PASS=ab
SHORT_PASS2=12

# 5. 纯数字
NUMERIC_SECRET=12345678901234567890

# 6. 重复值（同一值出现多次）
REPEATED_VALUE=abc123def456ghi789jkl0
SAME_VALUE_AGAIN=abc123def456ghi789jkl0
ONE_MORE_TIME=abc123def456ghi789jkl0

# 7. 常见密码模式
COMMON_PASSWORD=password123
WEAK_PASS=admin
DEFAULT_SECRET=secret

# 8. 看起来像但不是密码的
NOT_A_PASSWORD=hello_world
NOT_A_SECRET=foo_bar_baz
```

**预期识别**：
- `SPECIAL_CHARS="p@ss!w0rd#$%^&*()"` → 高熵字符串（包含特殊字符）
- `LONG_SECRET=Aa1Bb2Cc3...` → 高熵字符串（长度>25）
- `REPEATED_VALUE=abc123def456ghi789jkl0` → 合并为1条（相同值出现3次）

**预期不识别**：
- `EMPTY_PASSWORD=` → 空值不识别
- `SHORT_PASS=ab` → 太短，不识别
- `SHORT_PASS2=12` → 太短，不识别
- `NUMERIC_SECRET=12345678901234567890` → 纯数字，不识别
- `COMMON_PASSWORD=password123` → 虽然包含 `PASSWORD`，但值不像是真实密码（可配置是否识别）
- `WEAK_PASS=admin` → 太短，不识别
- `DEFAULT_SECRET=secret` → 太常见，不识别
- `NOT_A_PASSWORD=hello_world` → 不包含敏感关键词
- `NOT_A_SECRET=foo_bar_baz` → 不包含敏感关键词

---

## 检测类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `ENV_PASSWORD` | 环境变量中的密码 | `DB_PASSWORD=xxx` |
| `API_KEY` | API 密钥 | `sk-proj-xxx`, `AKIAxxx` |
| `DB_PASSWORD` | 数据库连接串密码 | `postgres://user:pass@host` |
| `JWT` | JSON Web Token | `eyJhbGciOi...` |
| `PRIVATE_KEY` | 私钥 | `-----BEGIN RSA PRIVATE KEY-----` |
| `HIGH_ENTROPY` | 高熵字符串（疑似密钥） | 长度>25的随机字符串 |

## 数据库支持

支持 50+ 种数据库连接串识别：

- **关系型**：PostgreSQL, MySQL, MariaDB, SQLite, MSSQL, Oracle, DB2, CockroachDB
- **NoSQL**：MongoDB, Redis, Memcached, CouchDB, Cassandra, DynamoDB
- **消息队列**：AMQP, RabbitMQ, Kafka, Nats, MQTT
- **其他**：Elasticsearch, InfluxDB, Neo4j, ArangoDB, RethinkDB, etcd

## 技术栈

- Vue 3 + Composition API
- TypeScript
- Vite + @crxjs/vite-plugin
- Tailwind CSS v4
- Reka UI
- @xenova/transformers（NER 模型）
