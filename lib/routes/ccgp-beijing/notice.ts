import { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';

export const route: Route = {
    path: '/notice/:type?',
    categories: ['government'],
    example: '/ccgp-beijing/notice/zhaobiao',
    parameters: {
        type: {
            description: '公告类型',
            default: 'zhaobiao',
            options: [
                { label: '招标公告', value: 'zhaobiao' },
                { label: '中标公告', value: 'zhongbiao' },
                { label: '合同公告', value: 'hetong' },
                { label: '更正公告', value: 'gengzheng' },
                { label: '废标公告', value: 'feibiao' },
            ],
        },
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['ccgp-beijing.gov.cn/xxgg/'],
            target: '/notice/zhaobiao',
        },
    ],
    name: '政府采购公告',
    maintainers: ['your-github-username'],
    handler,
};

async function handler(ctx) {
    const { type = 'zhaobiao' } = ctx.req.param();
    const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit')) : 20;
    const full = ctx.req.query('full') === 'true';

    const baseUrl = 'http://www.ccgp-beijing.gov.cn';
    const url = `${baseUrl}/xxgg/A002004index_1.htm?city=shi&name=${type}`;

    // 缓存15分钟
    const response = await cache.tryGet(
        `ccgp-beijing:list:${type}`,
        async () => {
            const res = await got(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    Referer: baseUrl,
                },
            });
            return res.data;
        },
        15 * 60
    );

    const $ = load(response);

    // 提取公告列表 - 北京政府采购网通常使用ul li结构
    const list = $('ul li, table tr, .list-item')
        .toArray()
        .map((item) => {
            const element = $(item);

            // 查找链接
            const anchor = element.find('a').first();
            if (anchor.length === 0) {
                return null;
            }

            const title = anchor.attr('title') || anchor.text().trim();
            const link = anchor.attr('href');

            // 提取日期
            let dateText = element.find('.date, span[class*="time"], span[class*="date"]').text().trim();
            if (!dateText) {
                // 尝试从文本中提取日期
                const textContent = element.text();
                const dateMatch = textContent.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/);
                dateText = dateMatch ? dateMatch[1].replaceAll(/[年月]/g, '-').replace(/日$/, '') : '';
            }

            if (!title || !link || title.length < 5) {
                return null;
            }

            return {
                title,
                link: link.startsWith('http') ? link : `${baseUrl}${link}`,
                pubDate: dateText ? parseDate(dateText) : undefined,
                description: '',
                author: '',
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .slice(0, limit);

    // 如果不需要全文，直接返回
    if (!full) {
        const simpleItems = list.map((item) => ({
            ...item,
            description: item.title,
        }));

        return {
            title: `北京市政府采购网 - ${getTypeName(type)}`,
            link: url,
            description: `北京市政府采购网${getTypeName(type)}`,
            item: simpleItems,
        };
    }

    // 获取详情（full=true时）
    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(
                item.link,
                async () => {
                    try {
                        const detailRes = await got(item.link, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                Referer: baseUrl,
                            },
                        });

                        const detail$ = load(detailRes.data);

                        // 提取正文内容
                        const content = detail$('.content, .article-content, .detail-content, #content').html() || detail$('article').html() || detail$('.main-content').html() || '暂无内容';

                        item.description = content;
                        item.author = detail$('.publisher, .author').text().trim() || '';

                        return item;
                    } catch {
                        item.description = item.title;
                        return item;
                    }
                },
                6 * 60 * 60 // 6小时缓存
            )
        )
    );

    return {
        title: `北京市政府采购网 - ${getTypeName(type)}`,
        link: url,
        description: `北京市政府采购网${getTypeName(type)}`,
        item: items,
    };
}

function getTypeName(type: string): string {
    const typeMap: Record<string, string> = {
        zhaobiao: '招标公告',
        zhongbiao: '中标公告',
        hetong: '合同公告',
        gengzheng: '更正公告',
        feibiao: '废标公告',
    };
    return typeMap[type] || type;
}
