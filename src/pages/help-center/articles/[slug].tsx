import {
  HELP_ARTICLES,
  HelpArticlePage,
  HelpCenterLayout,
  getHelpArticle
} from '@components/help/help-center-content';
import { SEO } from '@components/common/seo';
import type { GetStaticPaths, GetStaticProps } from 'next';
import type { ReactElement, ReactNode, JSX } from 'react';
import type { HelpArticle } from '@components/help/help-center-content';

type HelpArticleRouteProps = {
  article: HelpArticle;
};

export const getStaticPaths: GetStaticPaths = () => ({
  paths: HELP_ARTICLES.map(({ slug }) => ({
    params: { slug }
  })),
  fallback: false
});

export const getStaticProps: GetStaticProps<HelpArticleRouteProps> = ({
  params
}) => {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const article = getHelpArticle(slug);

  if (!article) return { notFound: true };

  return { props: { article } };
};

export default function HelpArticleRoute({
  article
}: HelpArticleRouteProps): JSX.Element {
  return (
    <>
      <SEO
        title={`${article.title} / Help Center / Not Twitter`}
        description={article.description}
      />
      <HelpArticlePage article={article} />
    </>
  );
}

HelpArticleRoute.getLayout = (page: ReactElement<any>): ReactNode => (
  <HelpCenterLayout>{page}</HelpCenterLayout>
);
