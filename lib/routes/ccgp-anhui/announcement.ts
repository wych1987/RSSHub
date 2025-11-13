import { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';

export const route: Route = {
    path: '/announcement/:category?',
    categories: ['government'],
    example: '/ccgp-anhui/announcement/ZcyAnnouncement3012',
    parameters: {
        category: {
            description: '公告类别',
            default: 'ZcyAnnouncement3012',
            options: [
                { label: '政采云公告', value: 'ZcyAnnouncement3012' },
                { label: '采购公告', value: 'CaiGouGongGao' },
                { label: '中标公告', value: 'ZhongBiaoGongGao' },
                { label: '更正公告', value: 'GengZhengGongGao' },
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
            source: ['ccgp-anhui.gov.cn/site/category'],
            target: '/announcement',
        },
    ],
    name: '政府采购公告',
    maintainers: ['your-github-username'],
    handler,
};

async function handler(ctx) {
    const { category = 'ZcyAnnouncement3012' } = ctx.req.param();
    const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit')) : 20;
    const full = ctx.req.query('full') === 'true';

    const baseUrl = 'https://www.ccgp-anhui.gov.cn';
    const parentId = 'oJCosldFbaJFzmyFhz1c6Q%3D%3D'; // 从URL中提取的parentId
    const url = `${baseUrl}/site/category?parentId=${parentId}&childrenCode=${category}`;

    // 缓存15分钟
    const response = await cache.tryGet(
        `ccgp-anhui:list:${category}`,
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

    // 提取公告列表 - 尝试多种选择器
    const list = $('li, .notice-item, .list-item, tr')
        .toArray()
        .map((item) => {
            const element = $(item);

            // 查找链接
            let anchor = element.find('a[href*="/site/"]').first();
            if (anchor.length === 0) {
                anchor = element.find('a[href*="viewer"]').first();
            }
            if (anchor.length === 0) {
                anchor = element.find('a').first();
            }

            if (anchor.length === 0) {
                return null;
            }

            const title = anchor.attr('title') || anchor.text().trim();
            const link = anchor.attr('href');

            // 提取日期 - 尝试多种格式
            let dateText = element.find('.date, .time, span.time').text().trim();
            if (!dateText) {
                dateText = element.text().match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';
            }

            if (!title || !link) {
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
            title: `安徽省政府采购网 - ${getCategoryName(category)}`,
            link: url,
            description: `安徽省政府采购网${getCategoryName(category)}`,
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
                        const content = detail$('.content, .article-content, .detail-content, .contentContainer').html() || detail$('article').html() || '暂无内容';

                        item.description = content;
                        item.author = detail$('.publisher, .author, .inforMation').text().trim() || '';

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
        title: `安徽省政府采购网 - ${getCategoryName(category)}`,
        link: url,
        description: `安徽省政府采购网${getCategoryName(category)}`,
        item: items,
    };
}

function getCategoryName(category: string): string {
    const categoryMap: Record<string, string> = {
        ZcyAnnouncement3012: '政采云公告',
        CaiGouGongGao: '采购公告',
        ZhongBiaoGongGao: '中标公告',
        GengZhengGongGao: '更正公告',
    };
    return categoryMap[category] || category;
}
