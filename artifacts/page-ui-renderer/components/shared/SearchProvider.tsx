'use client';

import { KBarSearchProvider } from '@shipixen/pliny/search/KBar';
import { useRouter } from 'next/navigation';
import { CoreContent } from '@shipixen/pliny/utils/contentlayer';
import { Blog } from 'shipixen-contentlayer/generated';
import { formatDate } from '@shipixen/pliny/utils/formatDate';
import { searchLinks } from '@/data/config/searchLinks';

export const SearchProvider = ({ children }) => {
  const router = useRouter();

  const makeRootPath = (path: string) => {
    if (!path.startsWith('/')) {
      return `/${path}`;
    }

    return path;
  };

  return (
    <KBarSearchProvider
      kbarConfig={{
        searchDocumentsPath: 'search.json',
        onSearchDocumentsLoad(json) {
          // 容错处理：确保 json 是数组格式
          let posts: CoreContent<Blog>[] = [];

          try {
            if (Array.isArray(json)) {
              posts = json;
            } else if (json && typeof json === 'object') {
              // 如果是对象，尝试提取数组值
              const values = Object.values(json);
              posts = values.filter(
                (item): item is CoreContent<Blog> =>
                  item &&
                  typeof item === 'object' &&
                  'path' in item &&
                  'title' in item,
              );
            }
          } catch (error) {
            console.warn(
              'SearchProvider: Failed to process search documents:',
              error,
            );
            posts = [];
          }

          return [
            ...searchLinks.map((link) => {
              return {
                id: link.id,
                name: link.name,
                keywords: link.keywords,
                section: link.section,
                perform: () => router.push(link.href),
              };
            }),

            ...posts.map((post: CoreContent<Blog>) => ({
              id: post.path,
              name: post.title,
              keywords: post?.summary || '',
              section: 'Pages',
              subtitle: `${
                post.date ? `${formatDate(post.date, 'en-US')}` : ''
              }`,
              perform: () => router.push(makeRootPath(post.path)),
            })),
          ];
        },
      }}
    >
      {children}
    </KBarSearchProvider>
  );
};
