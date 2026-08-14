import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, GraduationCap, Mail, Sparkles, UserRound } from 'lucide-react';
import { usersApi } from '../shared/api/users';
import { creditApi } from '../shared/api/credit';
import { ApiError } from '../shared/api/client';
import { DataState } from '../shared/components/DataState';
import { PageHero } from '../shared/components/PageHero';
import { SectionCard } from '../shared/components/SectionCard';
import { CreditScore, PublicProfile } from '../shared/types/domain';

export function PublicProfilePage() {
  const { identifier } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [credit, setCredit] = useState<CreditScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!identifier) return;
    let cancelled = false;
    setIsLoading(true);
    setError('');
    usersApi
      .publicProfile(identifier)
      .then(async (nextProfile) => {
        if (cancelled) return;
        setProfile(nextProfile);
        const creditUserId = nextProfile.userId ?? nextProfile.id ?? identifier;
        try {
          setCredit(await creditApi.userCredit(creditUserId));
        } catch {
          setCredit(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const reason = err instanceof ApiError ? err.message : '无法读取公开资料';
        setError(reason);
        setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [identifier]);

  if (isLoading) {
    return (
      <section className="profile-page polished-profile-page">
        <DataState tone="loading">正在读取公开资料...</DataState>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="profile-page polished-profile-page">
        <DataState tone="error">{error || '没有找到这位同学'}</DataState>
        <Link className="button-link secondary" to="/teams">
          返回大厅
        </Link>
      </section>
    );
  }

  return (
    <section className="profile-page polished-profile-page public-profile-page">
      <PageHero
        icon={<UserRound size={16} />}
        eyebrow="公开资料"
        title={profile.nickname || '未命名同学'}
        description="查看这位同学的基础信息、技能标签和信用概况。"
        backTo="/teams"
      />

      <div className="public-profile-grid">
        <aside className="profile-summary-card">
          <div className="profile-avatar xl">{(profile.nickname || '同').slice(0, 1)}</div>
          <div className="profile-identity">
            <h2>{profile.nickname || '未命名同学'}</h2>
            <p>
              <GraduationCap size={16} />
              {[profile.college || '未填写学院', profile.grade || '未填写年级'].join(' · ')}
            </p>
            {profile.email && (
              <p>
                <Mail size={16} />
                {profile.email}
              </p>
            )}
          </div>
          <div className="profile-meta-grid">
            <span>
              <b>{profile.studentNo || '未公开'}</b>
              学号
            </span>
            <span>
              <b>{profile.skills?.length ?? 0}</b>
              技能
            </span>
            <span>
              <b>{credit?.totalScore ?? profile.creditScore ?? '暂无'}</b>
              信用分
            </span>
          </div>
        </aside>

        <div className="profile-editor-grid">
          <SectionCard className="profile-editor-card" icon={<Sparkles size={18} />} title="技能标签">
            <div className="tags profile-skill-preview">
              {profile.skills?.length ? profile.skills.map((skill) => <span key={skill}>{skill}</span>) : <span>暂未填写技能</span>}
            </div>
          </SectionCard>
          <SectionCard className="profile-editor-card" icon={<CalendarDays size={18} />} title="空闲时间">
            <div className="credit-review-list">
              {profile.availability?.length ? (
                profile.availability.map((slot) => (
                  <div className="credit-review-row" key={slot}>
                    <strong>{slot}</strong>
                  </div>
                ))
              ) : (
                <DataState tone="empty">暂未公开空闲时间。</DataState>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </section>
  );
}
