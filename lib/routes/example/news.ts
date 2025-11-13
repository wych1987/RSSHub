import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news/:category?',
    categories: ['other'],
    example: '/example/news/tech',
    parameters: {
        category: {
            description: '新闻分类',
            default: 'all',
            options: [
                { label: '全部', value: 'all' },
                { label: '科技', value: 'tech' },
                { label: '财经', value: 'finance' },
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
            source: ['example.com/news', 'example.com/news/:category'],
            target: '/news/:category',
        },
    ],
    name: '新闻列表',
    maintainers: ['your-github-username'],
    handler,
};

async function handler(ctx) {
    const { category = 'all' } = ctx.req.param();

    // 构建目标URL
    const baseUrl = 'https://example.com';
    const url = category === 'all' ? `${baseUrl}/news` : `${baseUrl}/news/${category}`;

    // 发送HTTP请求获取页面内容
    const response = await ofetch(url);

    // 使用Cheerio解析HTML
    const $ = load(response);

    // 提取文章列表数据
    const items = $('.article-item')
        .toArray()
        .map((item) => {
            const element = $(item);
            const title = element.find('.article-title').text().trim();
            const link = element.find('a').attr('href');
            const description = element.find('.article-summary').text().trim();
            const pubDateStr = element.find('.article-date').attr('data-timestamp');
            const author = element.find('.article-author').text().trim();

            return {
                title,
                link: link?.startsWith('http') ? link : `${baseUrl}${link}`,
                description,
                pubDate: pubDateStr ? parseDate(pubDateStr) : undefined,
                author,
            };
        })
        .filter((item) => item.title); // 过滤掉没有标题的项目

    return {
        title: `Example网站 - ${category === 'all' ? '全部新闻' : category}`,
        link: url,
        description: `Example网站${category === 'all' ? '全部' : category}新闻的RSS订阅`,
        item: items,
    };
}
