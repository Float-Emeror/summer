import { CSSProperties, FormEvent, MouseEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, GraduationCap, Heart, Loader2, Mail, Plus, Save, Sparkles, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataState } from '../shared/components/DataState';
import { FormField } from '../shared/components/FormField';
import { AppModal } from '../shared/components/AppModal';
import { usersApi, type AvailabilitySlotPayload } from '../shared/api/users';
import { creditApi } from '../shared/api/credit';
import { ApiError } from '../shared/api/client';
import { isDemoSession as hasDemoSession } from '../shared/api/session';
import { useAuth } from '../shared/auth/AuthProvider';
import { CreditReview, CreditScore } from '../shared/types/domain';
import { teamTypeLabels } from '../shared/constants/team';

type ProfileForm = {
  nickname: string;
  college: string;
  grade: string;
  skills: string[];
  slots: AvailabilitySlotPayload[];
};

type ProfileState = ProfileForm & {
  email: string;
  studentNo: string;
  completeness: number;
};

type DragState = {
  active: boolean;
  weekday: number;
  startMinute: number;
  currentMinute: number;
  mode: 'create' | 'resize-start' | 'resize-end';
  sourceSlot?: AvailabilitySlotPayload;
};

type TrackDragEvent = PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>;

const demoProfile: ProfileState = {
  nickname: '示例同学',
  college: '计算机学院',
  grade: '2026级',
  email: 'student@example.edu',
  studentNo: '20260001',
  skills: ['React', 'NestJS', 'Prisma', '测试协作'],
  slots: [
    { weekday: 1, startTime: '19:00', endTime: '21:00' },
    { weekday: 3, startTime: '14:00', endTime: '16:00' },
    { weekday: 5, startTime: '20:00', endTime: '21:30' },
  ],
  completeness: 82,
};

const weekdayOptions = [
  { value: 1, label: '周一', shortLabel: 'MO' },
  { value: 2, label: '周二', shortLabel: 'TU' },
  { value: 3, label: '周三', shortLabel: 'WE' },
  { value: 4, label: '周四', shortLabel: 'TH' },
  { value: 5, label: '周五', shortLabel: 'FR' },
  { value: 6, label: '周六', shortLabel: 'SA' },
  { value: 7, label: '周日', shortLabel: 'SU' },
];

const MINUTES_PER_DAY = 24 * 60;
const SNAP_MINUTES = 30;
const tickHours = Array.from({ length: 13 }, (_, index) => index * 2);

function minutesToTimeLabel(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(MINUTES_PER_DAY, minutes));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTimeParts(value: string) {
  const [rawHour, rawMinute] = value.split(':').map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 0;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  return { hour, minute };
}

function timeToMinutes(value: string) {
  const { hour, minute } = parseTimeParts(value);
  return Math.max(0, Math.min(MINUTES_PER_DAY, hour * 60 + minute));
}

function sanitizeTimeTextInput(value: string) {
  const normalized = value.replace(/\uFF1A/g, ':').replace(/[^\d:]/g, '');
  const [head, ...tail] = normalized.split(':');
  if (tail.length > 0) {
    return `${head.slice(0, 2)}:${tail.join('').slice(0, 2)}`;
  }
  return head.slice(0, 4);
}

function parseTimeTextInput(value: string) {
  const text = value.trim().replace(/\uFF1A/g, ':');
  let hour: number;
  let minute: number;

  if (/^\d{1,2}$/.test(text)) {
    hour = Number(text);
    minute = 0;
  } else if (/^\d{3,4}$/.test(text)) {
    hour = Number(text.slice(0, -2));
    minute = Number(text.slice(-2));
  } else {
    const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return null;
    hour = Number(match[1]);
    minute = Number(match[2]);
  }

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  if (hour === 24 && minute !== 0) return null;
  return minutesToTimeLabel(hour * 60 + minute);
}

function slotTimeInputKey(slot: AvailabilitySlotPayload, field: 'startTime' | 'endTime') {
  return `${slot.weekday}-${slot.startTime}-${slot.endTime}-${field}`;
}

function snapMinute(minutes: number, mode: 'floor' | 'ceil' | 'round' = 'round') {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, minutes));
  const value = clamped / SNAP_MINUTES;
  const snapped =
    mode === 'floor' ? Math.floor(value) * SNAP_MINUTES : mode === 'ceil' ? Math.ceil(value) * SNAP_MINUTES : Math.round(value) * SNAP_MINUTES;
  return Math.max(0, Math.min(MINUTES_PER_DAY, snapped));
}

function normalizeSlot(slot: AvailabilitySlotPayload): AvailabilitySlotPayload | null {
  const weekday = Math.max(1, Math.min(7, Number(slot.weekday)));
  const startMinute = timeToMinutes(slot.startTime);
  const endMinute = timeToMinutes(slot.endTime);
  if (endMinute <= startMinute) return null;
  return {
    weekday,
    startTime: minutesToTimeLabel(startMinute),
    endTime: minutesToTimeLabel(endMinute),
  };
}

function normalizeSlots(slots: AvailabilitySlotPayload[]) {
  return mergeSlots(slots);
}

function parseAvailability(value: string): AvailabilitySlotPayload | null {
  const weekday = weekdayOptions.find((option) => value.includes(option.label))?.value;
  const [, timeRange] = value.split(' ');
  const [startTime, endTime] = timeRange?.split('-') ?? [];
  if (!weekday || !startTime || !endTime) return null;
  return normalizeSlot({ weekday, startTime, endTime });
}

function slotLabel(slot: AvailabilitySlotPayload) {
  const label = weekdayOptions.find((option) => option.value === slot.weekday)?.label ?? `周${slot.weekday}`;
  return `${label} ${slot.startTime}-${slot.endTime}`;
}

function mergeSlots(sourceSlots: AvailabilitySlotPayload[]) {
  const mergedSlots: AvailabilitySlotPayload[] = [];
  for (const day of weekdayOptions) {
    const normalized = sourceSlots
      .map(normalizeSlot)
      .filter((slot): slot is AvailabilitySlotPayload => slot !== null)
      .filter((slot) => slot.weekday === day.value)
      .map((slot) => ({ start: timeToMinutes(slot.startTime), end: timeToMinutes(slot.endTime) }))
      .sort((left, right) => left.start - right.start);

    for (const item of normalized) {
      const last = mergedSlots[mergedSlots.length - 1];
      if (last?.weekday === day.value && item.start <= timeToMinutes(last.endTime)) {
        last.endTime = minutesToTimeLabel(Math.max(timeToMinutes(last.endTime), item.end));
      } else {
        mergedSlots.push({
          weekday: day.value,
          startTime: minutesToTimeLabel(item.start),
          endTime: minutesToTimeLabel(item.end),
        });
      }
    }
  }
  return mergedSlots;
}

function groupSlotsByWeekday(slots: AvailabilitySlotPayload[]) {
  return weekdayOptions
    .map((day) => ({
      day,
      slots: slots.filter((slot) => slot.weekday === day.value),
    }))
    .filter((group) => group.slots.length > 0);
}

function slotSegmentStyle(slot: AvailabilitySlotPayload): CSSProperties {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  return {
    top: `${(start / MINUTES_PER_DAY) * 100}%`,
    height: `${Math.max(3.2, ((end - start) / MINUTES_PER_DAY) * 100)}%`,
  };
}

function slotFromDrag(drag: DragState): AvailabilitySlotPayload | null {
  if (drag.mode !== 'create' && drag.sourceSlot) {
    const sourceStart = timeToMinutes(drag.sourceSlot.startTime);
    const sourceEnd = timeToMinutes(drag.sourceSlot.endTime);
    if (drag.mode === 'resize-start') {
      const start = Math.min(drag.currentMinute, sourceEnd - 1);
      return normalizeSlot({ ...drag.sourceSlot, startTime: minutesToTimeLabel(start), endTime: minutesToTimeLabel(sourceEnd) });
    }
    const end = Math.max(drag.currentMinute, sourceStart + 1);
    return normalizeSlot({ ...drag.sourceSlot, startTime: minutesToTimeLabel(sourceStart), endTime: minutesToTimeLabel(end) });
  }

  const start = Math.min(drag.startMinute, drag.currentMinute);
  const end = Math.max(drag.startMinute, drag.currentMinute);
  const safeEnd = end === start ? Math.min(MINUTES_PER_DAY, start + SNAP_MINUTES) : end;
  if (safeEnd <= start) return null;
  return {
    weekday: drag.weekday,
    startTime: minutesToTimeLabel(start),
    endTime: minutesToTimeLabel(safeEnd),
  };
}

function pointerMinute(event: TrackDragEvent) {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
  return snapMinute(ratio * MINUTES_PER_DAY);
}

function pointerMinuteFromTrack(track: HTMLDivElement, clientY: number) {
  const rect = track.getBoundingClientRect();
  const ratio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  return snapMinute(ratio * MINUTES_PER_DAY);
}

type ReviewDetailCardProps = {
  review: CreditReview;
  expanded: boolean;
  onToggle: () => void;
  onAppeal: () => void;
};

function ReviewDetailCard({ review, expanded, onToggle, onAppeal }: ReviewDetailCardProps) {
  const comment = review.comment || '未填写评价信息';
  const shouldCollapse = comment.length > 56;
  const teamTypeLabel = review.teamType ? teamTypeLabels[review.teamType] : '未标注类型';
  const reviewerName = review.reviewerName || review.reviewer?.profile?.nickname || '匿名成员';
  const teamTitle = review.teamTitle || review.team?.title || '未关联队伍';
  const scoreText = review.rating.toFixed(1);

  return (
    <article className="review-detail-card">
      <header className="review-detail-card-head">
        <div className="review-detail-score-pill" aria-label={`评分 ${scoreText} 分`}>
          <strong>{scoreText}</strong>
          <span>★</span>
        </div>

        <div className="review-detail-card-copy">
          <p className="review-detail-title">
            <span className="review-label">{reviewerName}</span>
            <span> 对 </span>
            <span className="review-label">{teamTitle}</span>
            <span> 的评价</span>
          </p>
          <p className="review-detail-subtitle">
            <span>{teamTypeLabel}</span>
            <span aria-hidden="true"> · </span>
            <span>队伍：{teamTitle}</span>
          </p>
        </div>

        <button type="button" className="review-appeal-btn" onClick={onAppeal}>
          申诉
        </button>
      </header>

      <div className="review-detail-comment">
        <p className={shouldCollapse && !expanded ? 'is-collapsed' : undefined}>{comment}</p>
        {shouldCollapse && (
          <button type="button" className="review-expand-btn" onClick={onToggle}>
            {expanded ? '收起' : '展开'}
          </button>
        )}
      </div>

      {review.tags.length > 0 && (
        <div className="tags review-detail-tags" aria-label="评价标签">
          {review.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}
    </article>
  );
}
export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileState>(demoProfile);
  const [form, setForm] = useState<ProfileForm>({ ...demoProfile, slots: normalizeSlots(demoProfile.slots) });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isDemoSession, setIsDemoSession] = useState(() => hasDemoSession());
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [skillDraft, setSkillDraft] = useState('');
  const [modalError, setModalError] = useState('');
  const [availabilityDraft, setAvailabilityDraft] = useState<AvailabilitySlotPayload[]>(normalizeSlots(demoProfile.slots));
  const [availabilityDirty, setAvailabilityDirty] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [availabilityTimeDrafts, setAvailabilityTimeDrafts] = useState<Record<string, string>>({});
  const [compactAvailabilityDay, setCompactAvailabilityDay] = useState(1);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [credit, setCredit] = useState<CreditScore | null>(null);
  const [reviews, setReviews] = useState<CreditReview[]>([]);
  const [creditMessage, setCreditMessage] = useState('');
  const [reviewDetailsOpen, setReviewDetailsOpen] = useState(false);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<string>>(() => new Set());
  const [appealTarget, setAppealTarget] = useState<CreditReview | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  const previewSlots = useMemo(() => {
    if (!drag) return availabilityDraft;
    const slot = slotFromDrag(drag);
    if (!slot) return availabilityDraft;
    const base =
      drag.mode === 'create' || !drag.sourceSlot
        ? availabilityDraft
        : availabilityDraft.filter(
            (item) =>
              !(item.weekday === drag.sourceSlot?.weekday && item.startTime === drag.sourceSlot.startTime && item.endTime === drag.sourceSlot.endTime),
          );
    return mergeSlots([...base, slot]);
  }, [availabilityDraft, drag]);
  const groupedSlots = useMemo(() => groupSlotsByWeekday(previewSlots), [previewSlots]);
  const compactDaySlots = useMemo(
    () => previewSlots.filter((slot) => slot.weekday === compactAvailabilityDay),
    [compactAvailabilityDay, previewSlots],
  );

  const completion = useMemo(() => {
    const filled = [form.nickname, form.college, form.grade, form.skills.length > 0 ? 'skills' : '', form.slots.length > 0 ? 'slots' : ''].filter(Boolean).length;
    return Math.max(profile.completeness, Math.round((filled / 5) * 100));
  }, [form, profile.completeness]);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setMessage('');
    const demo = hasDemoSession();
    setIsDemoSession(demo);

    if (demo) {
      const nextProfile = { ...demoProfile, email: user?.email ?? demoProfile.email, slots: normalizeSlots(demoProfile.slots) };
      setProfile(nextProfile);
      setForm(nextProfile);
      setAvailabilityDraft(nextProfile.slots);
      setAvailabilityDirty(false);
      setIsLoading(false);
      return;
    }

    try {
      const data = await usersApi.me();
      const slots = normalizeSlots((data.availability ?? []).map(parseAvailability).filter((slot): slot is AvailabilitySlotPayload => Boolean(slot)));
      const nextProfile: ProfileState = {
        nickname: data.nickname || '未命名同学',
        college: data.college || '',
        grade: data.grade || '',
        email: data.email || user?.email || '',
        studentNo: data.studentNo || '',
        skills: data.skills ?? [],
        slots,
        completeness: data.completeness ?? 0,
      };
      setProfile(nextProfile);
      setForm(nextProfile);
      setAvailabilityDraft(nextProfile.slots);
      setAvailabilityDirty(false);
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '无法读取资料';
      setMessage(`读取失败：${reason}`);
      const fallback = { ...demoProfile, email: user?.email ?? demoProfile.email, slots: normalizeSlots(demoProfile.slots) };
      setProfile(fallback);
      setForm(fallback);
      setAvailabilityDraft(fallback.slots);
      setAvailabilityDirty(false);
    } finally {
      setIsLoading(false);
    }
  }, [user?.email]);

  const loadCreditInfo = useCallback(async () => {
    if (isDemoSession || !user?.id) {
      setCredit(null);
      setReviews([]);
      return;
    }
    setCreditMessage('');
    try {
      const [nextCredit, nextReviews] = await Promise.all([creditApi.userCredit(user.id), creditApi.myReviews()]);
      setCredit(nextCredit);
      setReviews(nextReviews ?? []);
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '无法读取信用评价';
      setCreditMessage(`信用评价读取失败：${reason}`);
      setCredit(null);
      setReviews([]);
    }
  }, [isDemoSession, user?.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void loadCreditInfo();
  }, [loadCreditInfo]);

  const commitDrag = useCallback(() => {
    const activeDrag = dragRef.current;
    if (!activeDrag) return;
    const slot = slotFromDrag(activeDrag);
    if (slot) {
      setAvailabilityDraft((current) => {
        const base =
          activeDrag.mode === 'create' || !activeDrag.sourceSlot
            ? current
            : current.filter(
                (item) =>
                  !(
                    item.weekday === activeDrag.sourceSlot?.weekday &&
                    item.startTime === activeDrag.sourceSlot.startTime &&
                    item.endTime === activeDrag.sourceSlot.endTime
                  ),
              );
        return mergeSlots([...base, slot]);
      });
      setAvailabilityDirty(true);
    }
    dragRef.current = null;
    setDrag(null);
  }, []);

  useEffect(() => {
    if (!drag) return;
    window.addEventListener('pointerup', commitDrag);
    window.addEventListener('pointercancel', commitDrag);
    return () => {
      window.removeEventListener('pointerup', commitDrag);
      window.removeEventListener('pointercancel', commitDrag);
    };
  }, [commitDrag, drag]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (isDemoSession) {
      setMessage('检测到旧演示会话。请重新使用真实后端账号登录后保存资料。');
      return;
    }

    setIsSaving(true);
    try {
      await usersApi.updateProfile({
        nickname: form.nickname.trim(),
        college: form.college.trim(),
        grade: form.grade.trim(),
      });
      await usersApi.updateSkills(form.skills);
      await usersApi.updateAvailability(form.slots);
      await loadProfile();
      setMessage('资料已保存');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '保存失败';
      setMessage(`保存失败：${reason}`);
    } finally {
      setIsSaving(false);
    }
  }

  function addSkill() {
    const value = skillDraft.trim();
    if (!value) {
      setModalError('请填写技能标签');
      return;
    }
    if (value.length > 16) {
      setModalError('技能标签最多 16 字');
      return;
    }
    if (form.skills.some((skill) => skill.toLowerCase() === value.toLowerCase())) {
      setModalError('这个技能标签已经存在');
      return;
    }
    setForm((current) => ({ ...current, skills: [...current.skills, value] }));
    setSkillDraft('');
    setModalError('');
    setSkillModalOpen(false);
  }

  function removeSlot(slot: AvailabilitySlotPayload) {
    setAvailabilityDraft((current) =>
      current.filter((item) => !(item.weekday === slot.weekday && item.startTime === slot.startTime && item.endTime === slot.endTime)),
    );
    setAvailabilityDirty(true);
  }

  function addRecommendedSlot() {
    const recommendations: AvailabilitySlotPayload[] = [
      { weekday: 1, startTime: '19:00', endTime: '21:00' },
      { weekday: 3, startTime: '14:00', endTime: '16:00' },
      { weekday: 5, startTime: '20:00', endTime: '22:00' },
      { weekday: 6, startTime: '10:00', endTime: '12:00' },
    ];
    const target = recommendations.find((slot) => {
      const nextSlots = mergeSlots([...availabilityDraft, slot]);
      return nextSlots.length > availabilityDraft.length;
    });
    const slot = target ?? { weekday: 1, startTime: '09:00', endTime: '10:00' };
    setAvailabilityDraft((current) => mergeSlots([...current, slot]));
    setAvailabilityDirty(true);
  }

  async function saveAvailabilityDraft() {
    setMessage('');
    if (!availabilityDirty) {
      setMessage('空闲时间已保存。');
      return;
    }
    if (isDemoSession) {
      setMessage('演示会话暂不能保存空闲时间，请使用真实后端账号登录。');
      return;
    }
    const slots = mergeSlots(availabilityDraft);
    setIsSavingAvailability(true);
    try {
      await usersApi.updateAvailability(slots);
      setAvailabilityDraft(slots);
      setForm((current) => ({ ...current, slots }));
      setAvailabilityDirty(false);
      await loadProfile();
      setMessage('空闲时间已保存');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '保存时间失败';
      setMessage(`保存时间失败：${reason}`);
    } finally {
      setIsSavingAvailability(false);
    }
  }

  async function submitAppeal(event: FormEvent) {
    event.preventDefault();
    if (!appealTarget) return;
    const reason = appealReason.trim();
    if (!reason) {
      setCreditMessage('请填写申诉理由。');
      return;
    }
    setIsSubmittingAppeal(true);
    setCreditMessage('');
    try {
      await creditApi.appeal(appealTarget.id, reason);
      setAppealTarget(null);
      setAppealReason('');
      setCreditMessage('申诉已提交，请等待管理员处理。');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '申诉提交失败';
      setCreditMessage(`申诉提交失败：${message}`);
    } finally {
      setIsSubmittingAppeal(false);
    }
  }

  function toggleReviewExpanded(reviewId: string) {
    setExpandedReviewIds((current) => {
      const next = new Set(current);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  }

  function updateSlotTime(slot: AvailabilitySlotPayload, field: 'startTime' | 'endTime', value: string) {
    const nextSlot = normalizeSlot({ ...slot, [field]: value });
    if (!nextSlot) return;
    setAvailabilityDraft((current) =>
      mergeSlots([
        ...current.filter((item) => !(item.weekday === slot.weekday && item.startTime === slot.startTime && item.endTime === slot.endTime)),
        nextSlot,
      ]),
    );
    setAvailabilityDirty(true);
  }

  function startSlotTimeEdit(slot: AvailabilitySlotPayload, field: 'startTime' | 'endTime') {
    setAvailabilityTimeDrafts((current) => ({ ...current, [slotTimeInputKey(slot, field)]: slot[field] }));
  }

  function changeSlotTimeDraft(slot: AvailabilitySlotPayload, field: 'startTime' | 'endTime', value: string) {
    setAvailabilityTimeDrafts((current) => ({ ...current, [slotTimeInputKey(slot, field)]: sanitizeTimeTextInput(value) }));
  }

  function clearSlotTimeDraft(slot: AvailabilitySlotPayload, field: 'startTime' | 'endTime') {
    setAvailabilityTimeDrafts((current) => {
      const next = { ...current };
      delete next[slotTimeInputKey(slot, field)];
      return next;
    });
  }

  function commitSlotTimeEdit(slot: AvailabilitySlotPayload, field: 'startTime' | 'endTime') {
    const key = slotTimeInputKey(slot, field);
    const parsedValue = parseTimeTextInput(availabilityTimeDrafts[key] ?? slot[field]);
    if (!parsedValue) {
      setMessage('请输入 00:00-24:00 范围内的时间，例如 10:00 或 1022。');
      clearSlotTimeDraft(slot, field);
      return;
    }

    const nextSlot = { ...slot, [field]: parsedValue };
    const startMinute = timeToMinutes(nextSlot.startTime);
    const endMinute = timeToMinutes(nextSlot.endTime);
    if (endMinute <= startMinute) {
      setMessage('开始时间必须早于结束时间，至少保留 1 分钟。');
      clearSlotTimeDraft(slot, field);
      return;
    }

    updateSlotTime(slot, field, parsedValue);
    clearSlotTimeDraft(slot, field);
  }

  function slotTimeInputValue(slot: AvailabilitySlotPayload, field: 'startTime' | 'endTime') {
    return availabilityTimeDrafts[slotTimeInputKey(slot, field)] ?? slot[field];
  }

  function slotTimeInputTitle(slot: AvailabilitySlotPayload, field: 'startTime' | 'endTime') {
    if (field === 'startTime') {
      return `可输入 00:00 到 ${minutesToTimeLabel(Math.max(0, timeToMinutes(slot.endTime) - 1))}`;
    }
    return `可输入 ${minutesToTimeLabel(Math.min(MINUTES_PER_DAY, timeToMinutes(slot.startTime) + 1))} 到 24:00`;
  }

  function startTrackDrag(weekday: number, event: TrackDragEvent) {
    event.preventDefault();
    if ('pointerId' in event) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    const minute = pointerMinute(event);
    const nextDrag = { active: true, weekday, startMinute: minute, currentMinute: minute, mode: 'create' as const };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function startSlotResize(slot: AvailabilitySlotPayload, mode: 'resize-start' | 'resize-end', event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const track = event.currentTarget.closest('.availability-day-track') as HTMLDivElement | null;
    if (!track) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const minute = pointerMinuteFromTrack(track, event.clientY);
    const nextDrag: DragState = {
      active: true,
      weekday: slot.weekday,
      startMinute: mode === 'resize-start' ? timeToMinutes(slot.startTime) : timeToMinutes(slot.endTime),
      currentMinute: minute,
      mode,
      sourceSlot: slot,
    };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function continueSlotResize(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = dragRef.current;
    if (!currentDrag?.active || currentDrag.mode === 'create') return;
    const track = event.currentTarget.closest('.availability-day-track') as HTMLDivElement | null;
    if (!track) return;
    const nextDrag = { ...currentDrag, currentMinute: pointerMinuteFromTrack(track, event.clientY) };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function finishSlotResize(event: PointerEvent<HTMLButtonElement>) {
    continueSlotResize(event);
    commitDrag();
  }

  function continueTrackDrag(weekday: number, event: TrackDragEvent) {
    const currentDrag = dragRef.current;
    if (!currentDrag?.active || currentDrag.weekday !== weekday) return;
    const nextDrag = { ...currentDrag, currentMinute: pointerMinute(event) };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function finishTrackDrag(weekday: number, event: TrackDragEvent) {
    continueTrackDrag(weekday, event);
    commitDrag();
  }

  const pageMessageTone = message.includes('已保存') ? 'success' : message.includes('失败') || message.includes('不能') ? 'error' : 'info';

  return (
    <section className="profile-page polished-profile-page">
      {(message || isDemoSession) && (
        <DataState tone={message ? pageMessageTone : 'info'}>
          {message || '检测到旧演示会话，资料可预览但不能保存到后端。'}
        </DataState>
      )}
      {isLoading && <DataState tone="loading">正在读取个人资料...</DataState>}

      <form className="profile-github-layout" id="profile-form" onSubmit={saveProfile}>
        <aside className="profile-sidebar">
          <section className="profile-identity-card">
            <div className="profile-card-actions">
              <button className="profile-save-hero" disabled={isSaving || isLoading} form="profile-form" type="submit">
                {isSaving ? <Loader2 size={18} className="spin-icon" /> : <Save size={18} />}
                {isSaving ? '保存中' : '保存资料'}
              </button>
              <div className="profile-quick-links" aria-label="个人快捷入口">
                <Link to="/teams?scope=mine" title="我的队伍" data-tooltip="我的队伍" aria-label="我的队伍">
                  <UsersRound size={16} />
                </Link>
                <Link to="/teams?scope=favorites" title="收藏队伍" data-tooltip="收藏队伍" aria-label="收藏队伍">
                  <Heart size={16} />
                </Link>
                <Link to="/tasks" title="任务看板" data-tooltip="任务看板" aria-label="任务看板">
                  <ClipboardList size={16} />
                </Link>
              </div>
            </div>
            <div className="profile-avatar-block">
              <div className="profile-avatar">{(form.nickname || profile.email || '同').slice(0, 1)}</div>
            </div>
            <h2 className="profile-name">{form.nickname || '未命名同学'}</h2>
            <div className="profile-meta-list">
              <span>
                <GraduationCap size={16} />
                {[form.college || '待填写学院', form.grade || '待填写年级'].join(' · ')}
              </span>
              <span>
                <Mail size={16} />
                {profile.email || user?.email || '未绑定邮箱'}
              </span>
            </div>
            <div className="profile-completion">
              <div className="meter">
                <span style={{ width: `${completion}%` }} />
              </div>
              <strong>资料完整度 {completion}%</strong>
            </div>
            <div className="profile-stat-grid">
              <span className="profile-stat-tile">
                <strong>{profile.studentNo || '待同步'}</strong>
                <span>学号</span>
              </span>
              <span className="profile-stat-tile">
                <strong>{form.skills.length}</strong>
                <span>技能</span>
              </span>
            </div>
          </section>

          <section className="profile-pinned-card">
            <h3>
              <UserRound size={17} />
              基础信息
            </h3>
            <div className="profile-form-grid">
              <FormField label="昵称">
                <input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} />
              </FormField>
              <FormField label="学院">
                <input value={form.college} onChange={(event) => setForm({ ...form, college: event.target.value })} />
              </FormField>
              <FormField label="年级">
                <input value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} />
              </FormField>
            </div>
          </section>

          <section className="profile-pinned-card profile-skills-card">
            <header className="profile-pinned-card-head">
              <h3>
                <Sparkles size={17} />
                技能标签
              </h3>
              <button className="profile-mini-action" type="button" onClick={() => setSkillModalOpen(true)}>
                <Plus size={16} />
                添加
              </button>
            </header>
            <div className="tags profile-skill-preview editable-tags">
              {form.skills.length > 0 ? (
                form.skills.map((skill) => (
                  <span key={skill}>
                    {skill}
                    <button
                      type="button"
                      aria-label={`删除 ${skill}`}
                      onClick={() => setForm((current) => ({ ...current, skills: current.skills.filter((item) => item !== skill) }))}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              ) : (
                <div className="profile-skill-empty">
                  <strong>暂未添加技能标签</strong>
                  <small>添加后更容易匹配到合适队伍</small>
                </div>
              )}
            </div>
          </section>
        </aside>

        <div className="profile-main">
          <section className="profile-activity-card">
            <header className="profile-activity-header">
              <div>
                <h2>空闲时间</h2>
                <p>拖动左侧时间滑动条添加空闲时间。</p>
              </div>
              <div className="profile-activity-actions">
                <button className="profile-mini-action" type="button" onClick={addRecommendedSlot}>
                  <Plus size={16} />
                  添加
                </button>
                <button
                  className={`profile-mini-action profile-primary-action${availabilityDirty ? '' : ' is-saved'}`}
                  type="button"
                  disabled={isSavingAvailability}
                  onClick={saveAvailabilityDraft}
                  title={availabilityDirty ? '保存当前空闲时间' : '当前空闲时间已保存'}
                >
                  {isSavingAvailability ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />}
                  {isSavingAvailability ? '保存中' : availabilityDirty ? '保存时间' : '已保存'}
                </button>
              </div>
            </header>

            <div className="availability-editor-layout availability-card-body">
              <div className="availability-timeline-wrap availability-board availability-week-board">
                <div className="availability-timeline">
                  <div className="availability-axis-head" aria-hidden="true">
                    时间
                  </div>
                  {weekdayOptions.map((day) => (
                    <div className="availability-day-head" key={day.value}>
                      <span>{day.shortLabel}</span>
                      <strong>{day.label}</strong>
                    </div>
                  ))}

                  <div className="availability-axis" aria-hidden="true">
                    {tickHours.map((hour) => (
                      <span key={hour} style={{ top: `${(hour / 24) * 100}%` }}>
                        {hour}
                      </span>
                    ))}
                  </div>

                  {weekdayOptions.map((day) => (
                    <div
                      aria-label={`${day.label} 时间滑动条`}
                      aria-valuemax={24}
                      aria-valuemin={0}
                      aria-valuenow={0}
                      className="availability-day-track"
                      key={day.value}
                      role="slider"
                      tabIndex={0}
                      onPointerDown={(event) => startTrackDrag(day.value, event)}
                      onPointerMove={(event) => continueTrackDrag(day.value, event)}
                      onPointerUp={(event) => finishTrackDrag(day.value, event)}
                      onPointerCancel={(event) => finishTrackDrag(day.value, event)}
                      onMouseDown={(event) => startTrackDrag(day.value, event)}
                      onMouseMove={(event) => continueTrackDrag(day.value, event)}
                      onMouseUp={(event) => finishTrackDrag(day.value, event)}
                    >
                      {tickHours.map((hour) => (
                        <i key={hour} style={{ top: `${(hour / 24) * 100}%` }} />
                      ))}
                      {previewSlots
                        .filter((slot) => slot.weekday === day.value)
                        .map((slot) => (
                          <div
                            className="availability-segment"
                            key={`${slot.weekday}-${slot.startTime}-${slot.endTime}`}
                            style={slotSegmentStyle(slot)}
                            title={slotLabel(slot)}
                          >
                            <button
                              type="button"
                              className="availability-resize-handle start"
                              aria-label={`调整 ${slotLabel(slot)} 开始时间`}
                              onPointerDown={(event) => startSlotResize(slot, 'resize-start', event)}
                              onPointerMove={continueSlotResize}
                              onPointerUp={finishSlotResize}
                              onPointerCancel={finishSlotResize}
                            />
                            <button
                              type="button"
                              className="availability-resize-handle end"
                              aria-label={`调整 ${slotLabel(slot)} 结束时间`}
                              onPointerDown={(event) => startSlotResize(slot, 'resize-end', event)}
                              onPointerMove={continueSlotResize}
                              onPointerUp={finishSlotResize}
                              onPointerCancel={finishSlotResize}
                            />
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="availability-compact">
                <div className="availability-day-tabs" role="tablist" aria-label="选择星期">
                  {weekdayOptions.map((day) => (
                    <button
                      type="button"
                      key={day.value}
                      className={compactAvailabilityDay === day.value ? 'active' : undefined}
                      aria-selected={compactAvailabilityDay === day.value}
                      role="tab"
                      onClick={() => setCompactAvailabilityDay(day.value)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <div className="availability-day-slots">
                  {compactDaySlots.length === 0 ? (
                    <DataState tone="empty">
                      {weekdayOptions.find((day) => day.value === compactAvailabilityDay)?.label ?? '当天'}暂无空闲时间
                    </DataState>
                  ) : (
                    compactDaySlots.map((slot) => (
                      <div className="availability-slot-card" key={`${slot.weekday}-${slot.startTime}-${slot.endTime}`}>
                        <span>{slotLabel(slot)}</span>
                        <button type="button" aria-label={`删除 ${slotLabel(slot)}`} onClick={() => removeSlot(slot)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <aside className="availability-summary-panel availability-summary">
                <header className="availability-summary-head">
                  <strong>已选时段</strong>
                  <span>{previewSlots.length}</span>
                </header>
                <div className="availability-summary-list availability-slot-list">
                  {groupedSlots.length > 0 &&
                    groupedSlots.map((group) => (
                      <div className="availability-summary-group" key={group.day.value}>
                        <strong>{group.day.label}</strong>
                        {group.slots.map((slot) => (
                          <div className="availability-summary-row editable" key={`${slot.weekday}-${slot.startTime}-${slot.endTime}`}>
                            <div className="availability-time-inputs" aria-label={`${slotLabel(slot)} 时间编辑`}>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={5}
                                pattern="([01]?[0-9]|2[0-3]):?[0-5][0-9]|24:?00"
                                placeholder="00:00"
                                title={slotTimeInputTitle(slot, 'startTime')}
                                value={slotTimeInputValue(slot, 'startTime')}
                                aria-label={`${slotLabel(slot)} 开始时间`}
                                onFocus={() => startSlotTimeEdit(slot, 'startTime')}
                                onChange={(event) => changeSlotTimeDraft(slot, 'startTime', event.target.value)}
                                onBlur={() => commitSlotTimeEdit(slot, 'startTime')}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    commitSlotTimeEdit(slot, 'startTime');
                                    event.currentTarget.blur();
                                  }
                                  if (event.key === 'Escape') {
                                    clearSlotTimeDraft(slot, 'startTime');
                                    event.currentTarget.blur();
                                  }
                                }}
                              />
                              <span aria-hidden="true">-</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={5}
                                pattern="([01]?[0-9]|2[0-3]):?[0-5][0-9]|24:?00"
                                placeholder="24:00"
                                title={slotTimeInputTitle(slot, 'endTime')}
                                value={slotTimeInputValue(slot, 'endTime')}
                                aria-label={`${slotLabel(slot)} 结束时间`}
                                onFocus={() => startSlotTimeEdit(slot, 'endTime')}
                                onChange={(event) => changeSlotTimeDraft(slot, 'endTime', event.target.value)}
                                onBlur={() => commitSlotTimeEdit(slot, 'endTime')}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    commitSlotTimeEdit(slot, 'endTime');
                                    event.currentTarget.blur();
                                  }
                                  if (event.key === 'Escape') {
                                    clearSlotTimeDraft(slot, 'endTime');
                                    event.currentTarget.blur();
                                  }
                                }}
                              />
                            </div>
                            <button type="button" aria-label={`删除 ${slotLabel(slot)}`} onClick={() => removeSlot(slot)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </aside>
            </div>
          </section>

          <section className="profile-pinned-card credit-card profile-credit-summary-card">
            <header className="profile-pinned-card-head">
              <h3>
                <Sparkles size={17} />
                信用与评价
              </h3>
            </header>
            <div className="profile-credit-summary-bar">
              <span>
                信用分：<b>{credit?.totalScore ?? '暂无'}</b>
              </span>
              <span>
                收到评价：<b>{reviews.length}</b>
              </span>
              <button type="button" className="profile-mini-action" onClick={() => setReviewDetailsOpen(true)}>
                查看评价详情
              </button>
            </div>
            {creditMessage && <DataState tone={creditMessage.includes('失败') ? 'error' : 'info'}>{creditMessage}</DataState>}
          </section>
        </div>
      </form>

      <AppModal
        open={skillModalOpen}
        title="添加技能标签"
        onClose={() => {
          setSkillModalOpen(false);
          setModalError('');
        }}
        footer={
          <>
            <button type="button" className="task-mini-btn" onClick={() => setSkillModalOpen(false)}>
              取消
            </button>
            <button type="button" onClick={addSkill}>
              添加
            </button>
          </>
        }
      >
        <FormField label="技能名称">
          <input value={skillDraft} maxLength={16} onChange={(event) => setSkillDraft(event.target.value)} placeholder="最多 16 字" />
        </FormField>
        {modalError && <DataState tone="error">{modalError}</DataState>}
      </AppModal>

      <AppModal
        open={reviewDetailsOpen}
        title="评价详情"
        description="查看成员评价、关联队伍与申诉入口。"
        className="review-detail-modal"
        onClose={() => setReviewDetailsOpen(false)}
      >
        <div className="review-detail-list">
          {reviews.length === 0 ? (
            <DataState tone="empty">暂时还没有收到评价。</DataState>
          ) : (
            reviews.map((review) => (
              <ReviewDetailCard
                key={review.id}
                review={review}
                expanded={expandedReviewIds.has(review.id)}
                onToggle={() => toggleReviewExpanded(review.id)}
                onAppeal={() => {
                  setReviewDetailsOpen(false);
                  setAppealTarget(review);
                }}
              />
            ))
          )}
        </div>
      </AppModal>

      <AppModal
        open={Boolean(appealTarget)}
        title="提交申诉"
        description="说明你认为这条评价需要复核的原因，管理员会在后台处理。"
        onClose={() => {
          if (!isSubmittingAppeal) setAppealTarget(null);
        }}
        footer={
          <>
            <button type="button" className="task-modal-btn" disabled={isSubmittingAppeal} onClick={() => setAppealTarget(null)}>
              取消
            </button>
            <button type="submit" form="appeal-form" className="task-modal-btn primary" disabled={isSubmittingAppeal || !appealReason.trim()}>
              {isSubmittingAppeal ? <Loader2 size={14} className="spin-icon" /> : <Save size={14} />}
              提交申诉
            </button>
          </>
        }
      >
        <form id="appeal-form" className="modal-form" onSubmit={submitAppeal}>
          <FormField label="申诉理由">
            <textarea value={appealReason} onChange={(event) => setAppealReason(event.target.value)} />
          </FormField>
        </form>
      </AppModal>
    </section>
  );
}
