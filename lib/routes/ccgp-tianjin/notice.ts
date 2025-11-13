import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';

export const route: Route = {
    path: '/notice/:level?',
    categories: ['government'],
    example: '/ccgp-tianjin/notice/city',
    parameters: {
        level: {
            description: '公告级别',
            default: 'city',
            options: [
                { label: '市级', value: 'city' },
                { label: '区级', value: 'district' },
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
            source: ['ccgp-tianjin.gov.cn/portal/topicView.do'],
            target: '/notice/city',
        },
    ],
    name: '采购公告',
    maintainers: ['your-github-username'],
    handler,
};

async function handler(ctx) {
    const { level = 'city' } = ctx.req.param();

    // 根据级别选择不同的id参数
    // 市级: id=1665, 区级: id=1666
    const topicId = level === 'city' ? '1665' : '1666';

    const baseUrl = 'http://www.ccgp-tianjin.gov.cn';
    const url = `${baseUrl}/portal/topicView.do?method=view&view=Infor&id=${topicId}&ver=2&st=1`;

    // 发送HTTP请求获取页面内容
    const response = await ofetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
    });

    // 使用Cheerio解析HTML
    const $ = load(response);

    // 提取公告列表 - 直接查找li元素
    const list = $('li')
        .toArray()
        .map((item) => {
            const element = $(item);
            const anchor = element.find('a[href*="viewer.do"]');
            if (anchor.length === 0) {
                return null;
            }

            const title = anchor.attr('title') || anchor.text().trim();
            const link = anchor.attr('href');
            const timeSpan = element.find('span.time');
            const dateText = timeSpan.text().trim();

            if (!title || !link) {
                return null;
            }

            return {
                title,
                link: `${baseUrl}${link}`,
                pubDate: dateText ? parseDate(dateText) : undefined,
                description: '',
                author: '',
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

    // 获取每个公告的详细内容
    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                try {
                    const detailResponse = await ofetch(item.link, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        },
                    });

                    const detail$ = load(detailResponse);

                    // 提取正文内容
                    const content = detail$('.contentContainer').html() || detail$('.content').html() || '暂无内容';

                    // 提取发布单位和其他信息
                    const info = detail$('.inforMation').text();

                    item.description = content;
                    item.author = info.match(/发布单位：([^\s]+)/)?.[1] || '';

                    return item;
                } catch {
                    // 如果获取详情失败，返回基本信息
                    item.description = item.title;
                    return item;
                }
            })
        )
    );

    return {
        title: `天津市政府采购网 - ${level === 'city' ? '市级' : '区级'}采购公告`,
        link: url,
        description: `天津市政府采购网${level === 'city' ? '市级' : '区级'}采购公告`,
        item: items,
    };
}
