import { Link } from 'react-router-dom';
import { Home, SearchX } from 'lucide-react';
import { PageHero } from '../shared/components/PageHero';

export function NotFoundPage() {
  return (
    <section className="not-found-page">
      <PageHero
        icon={<SearchX size={16} />}
        eyebrow="页面不存在"
        title="没有找到这个入口"
        description="可能是链接写错了，或者这个功能已经移动到新的位置。"
        backTo="/teams"
        actions={
          <Link className="button-link" to="/teams">
            <Home size={18} />
            返回大厅
          </Link>
        }
      />
    </section>
  );
}
