# 📚 管理多个自定义RSS源 - 最佳实践

## 🗂️ 项目结构

### 按网站分组（推荐）

```
lib/routes/
├── ccgp-tianjin/           # 天津政府采购网
│   ├── namespace.ts        # 网站信息
│   ├── notice.ts          # 采购公告路由
│   ├── result.ts          # 采购结果路由（可添加）
│   └── utils.ts           # 共用工具（可选）
│
├── ccgp-shanghai/          # 上海政府采购网
│   ├── namespace.ts        # 网站信息
│   └── announcement.ts    # 公告路由
│
└── your-site/              # 你的其他网站
    ├── namespace.ts
    └── main.ts
```

## ✅ 已创建的RSS源

### 1. 天津市政府采购网
```bash
# 市级采购公告（轻量模式）
http://localhost:1200/ccgp-tianjin/notice/city

# 区级采购公告
http://localhost:1200/ccgp-tianjin/notice/district

# 获取全文（limit=10条）
http://localhost:1200/ccgp-tianjin/notice/city?full=true&limit=10
```

**文件位置**: `/lib/routes/ccgp-tianjin/notice.ts`

### 2. 上海市政府采购网
```bash
# 政采云公告（默认）
http://localhost:1200/ccgp-shanghai/announcement

# 采购公告
http://localhost:1200/ccgp-shanghai/announcement/CaiGouGongGao

# 中标公告
http://localhost:1200/ccgp-shanghai/announcement/ZhongBiaoGongGao

# 更正公告
http://localhost:1200/ccgp-shanghai/announcement/GengZhengGongGao

# 限制数量
http://localhost:1200/ccgp-shanghai/announcement?limit=10
```

**文件位置**: `/lib/routes/ccgp-shanghai/announcement.ts`

## 🚀 添加新网站的步骤

### 步骤1: 创建命名空间
```bash
# 在 lib/routes/ 下创建新文件夹
mkdir lib/routes/网站名称

# 创建 namespace.ts
```

```typescript
import type { Namespace } from '@/types';

export const namespace: Namespace = {
    name: '网站中文名',
    url: 'example.com',
    description: '网站描述',
    lang: 'zh-CN',
};
```

### 步骤2: 创建路由文件
```typescript
import { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';

export const route: Route = {
    path: '/your-path/:param?',
    categories: ['category'],
    example: '/网站名称/your-path',
    parameters: {
        param: '参数说明',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '路由名称',
    maintainers: ['your-github-username'],
    handler,
};

async function handler(ctx) {
    // 你的代码逻辑
}
```

### 步骤3: 重启开发服务器
```bash
# 停止当前服务
Ctrl + C

# 重新启动
pnpm dev
```

### 步骤4: 测试
```bash
curl http://localhost:1200/网站名称/your-path
```

## 💡 复用代码技巧

### 创建共用工具函数

如果多个路由有相同的逻辑，创建 `utils.ts`:

```typescript
// lib/routes/ccgp-tianjin/utils.ts
import { load } from 'cheerio';

export function parseNoticeList($: any, baseUrl: string) {
    return $('li')
        .toArray()
        .map((item) => {
            // 共用的解析逻辑
        });
}

export function getCategoryName(code: string): string {
    const map = {
        city: '市级',
        district: '区级',
    };
    return map[code] || code;
}
```

在路由中使用：
```typescript
import { parseNoticeList, getCategoryName } from './utils';
```

## 📋 快速参考表

| 网站 | 命名空间 | 路由示例 | 状态 |
|------|---------|---------|------|
| 天津政府采购网 | ccgp-tianjin | /ccgp-tianjin/notice/city | ✅ |
| 上海政府采购网 | ccgp-shanghai | /ccgp-shanghai/announcement | ✅ |
| 你的网站1 | your-site-1 | /your-site-1/path | 待添加 |
| 你的网站2 | your-site-2 | /your-site-2/path | 待添加 |

## 🔧 本地开发工作流

```bash
# 1. 创建新路由文件
# 2. 编辑代码
# 3. 保存（开发服务器会自动重启）
# 4. 测试 curl http://localhost:1200/your-route
# 5. 在RSS阅读器中订阅测试
```

## 📝 常见模式

### 模式1: 列表页 + 详情页
```typescript
// 1. 获取列表页
const list = $('.item').map(...)

// 2. 遍历获取详情
const items = await Promise.all(
    list.map(item => cache.tryGet(item.link, async () => {
        // 获取详情
    }))
)
```

### 模式2: 只有列表页（推荐，性能好）
```typescript
const items = $('.item').map((item) => ({
    title: ...,
    link: ...,
    description: title, // 直接用标题作为描述
    pubDate: ...
}))
```

### 模式3: API数据
```typescript
const response = await got(apiUrl, {
    headers: {
        'Content-Type': 'application/json',
    },
});
const data = JSON.parse(response.data);
```

## 🎯 下一步

现在你已经有2个政府采购网的RSS源了！

如果还想添加更多网站，把网站URL发给我，我帮你快速创建！

常见的政府采购网：
- 北京市: ccgp-beijing.gov.cn
- 广东省: gdgpo.czt.gd.gov.cn
- 深圳市: zfcg.sz.gov.cn
- 等等...
