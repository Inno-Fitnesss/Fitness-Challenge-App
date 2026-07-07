import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ChallengeDetailModal } from '../../components/challenges/ChallengeDetailModal.tsx';
import { ChallengeFormModal } from '../../components/challenges/ChallengeFormModal.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { challengeApi } from '../../api/challengeApi.ts';
import {
  fetchChallengeListItems,
  fetchDiscoveryChallenges,
} from '../../api/challengeQueries.ts';
import type {
  ChallengeListItem,
  ChallengeTab,
  DiscoveryChallenge,
} from '../../types/challenge.ts';
import { parseApiError } from '../../utils/parseApiError.ts';
import type { AxiosError } from 'axios';
import { buildChallengeInviteUrl } from '../../utils/inviteUrl.ts';
import { canEditChallenge } from '../../utils/challengePermissions.ts';
import {
  getChallengeDateProgress,
  getChallengeDescription,
  MobileChallengeBadges,
  MobileExerciseTag,
  MobileProgressRing,
} from '../components/MobileChallengeParts.tsx';
import { MobileChallengeCreateModal } from '../components/MobileChallengeCreateModal.tsx';

const TABS: Array<{ id: ChallengeTab; label: string }> = [
  { id: 'individual', label: 'Индивидуальные' },
  { id: 'group', label: 'Групповые' },
  { id: 'archive', label: 'Архив' },
];

type ConfirmState = {
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  action: () => Promise<void>;
} | null;

function normalizeTab(value: string | null): ChallengeTab {
  if (value === 'individual' || value === 'group' || value === 'archive') return value;
  if (value === 'mine') return 'individual';
  if (value === 'participating') return 'group';
  return 'group';
}

function filterByTab(items: ChallengeListItem[], tab: ChallengeTab): ChallengeListItem[] {
  if (tab === 'archive') return items.filter((challenge) => challenge.status === 'archived');
  if (tab === 'individual') {
    return items.filter(
      (challenge) => challenge.status === 'active' && challenge.isPrivate && challenge.isOwner,
    );
  }
  return items.filter(
    (challenge) =>
      challenge.status === 'active' && !(challenge.isPrivate && challenge.isOwner),
  );
}

function MobileTabs({
  activeTab,
  onChange,
}: {
  activeTab: ChallengeTab;
  onChange: (tab: ChallengeTab) => void;
}) {
  return (
    <div className="grid grid-cols-3 border-b border-neutral-border">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`relative pb-2 text-[14px] font-semibold ${
            activeTab === tab.id ? 'text-brand' : 'text-neutral-muted'
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute inset-x-4 -bottom-[1px] h-[3px] rounded-full bg-brand" />
          )}
        </button>
      ))}
    </div>
  );
}

function DiscoveryCard({
  challenge,
  onJoin,
}: {
  challenge: DiscoveryChallenge;
  onJoin: (id: number) => void;
}) {
  return (
    <article className="rounded-[12px] bg-white p-3 shadow-sm">
      <div className="grid grid-cols-[1fr_76px] gap-2">
        <div className="min-w-0">
          <h2 className="mb-2 truncate text-[16px] font-semibold text-neutral-text">
            {challenge.title}
          </h2>
          <MobileChallengeBadges challenge={challenge} />
        </div>
        <img
          src="/mobile-assets/challenge-room.png"
          alt=""
          className="h-[74px] w-[74px] rounded-full object-cover"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {challenge.exerciseTags.map((tag) => (
          <MobileExerciseTag key={tag}>{tag}</MobileExerciseTag>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onJoin(challenge.id)}
        className="mt-3 h-7 w-full rounded-[8px] bg-lime text-[13px] font-semibold text-white"
      >
        Присоединиться
      </button>
    </article>
  );
}

function CompetitionCard({
  challenge,
  tab,
  onOpen,
  onLeave,
  onResume,
}: {
  challenge: ChallengeListItem;
  tab: ChallengeTab;
  onOpen: (id: number) => void;
  onLeave: (id: number) => void;
  onResume: (id: number) => void;
}) {
  const progress = getChallengeDateProgress(challenge);

  return (
    <article className="overflow-hidden rounded-[14px] bg-white shadow-card">
      <button
        type="button"
        onClick={() => onOpen(challenge.id)}
        className="w-full px-3 py-3 text-left"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[16px] font-semibold text-[#15133d]">
              {challenge.title}
            </h3>
            <p className="mt-0.5 max-h-[38px] overflow-hidden text-[13px] font-medium leading-[1.25] text-neutral-muted">
              {getChallengeDescription(challenge)}
            </p>
          </div>
          {tab !== 'individual' && <MobileProgressRing value={progress} />}
        </div>

        <div className="mb-2">
          <MobileChallengeBadges challenge={challenge} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {challenge.exerciseTags.map((tag) => (
            <MobileExerciseTag key={tag}>{tag}</MobileExerciseTag>
          ))}
        </div>
      </button>

      <div className="border-t border-neutral-border bg-[#e7e7e7]">
        {tab === 'archive' ? (
          <button
            type="button"
            onClick={() => onResume(challenge.id)}
            className="h-9 w-full text-[13px] font-medium text-neutral-text"
          >
            Возобновить
          </button>
        ) : tab === 'group' && challenge.joined && !challenge.isOwner ? (
          <button
            type="button"
            onClick={() => onLeave(challenge.id)}
            className="h-9 w-full text-[13px] font-medium text-neutral-text"
          >
            Покинуть
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpen(challenge.id)}
            className="h-9 w-full text-[13px] font-medium text-neutral-text"
          >
            Открыть
          </button>
        )}
      </div>
    </article>
  );
}

export function MobileCompetitionsPage() {
  const navigate = useNavigate();
  const { id: routeChallengeId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = normalizeTab(searchParams.get('tab'));
  const showCreateModal = searchParams.get('create') === '1';
  const editIdParam = searchParams.get('edit');
  const editChallengeId =
    editIdParam && !Number.isNaN(Number(editIdParam)) ? Number(editIdParam) : null;
  const [activeChallenges, setActiveChallenges] = useState<ChallengeListItem[]>([]);
  const [archivedChallenges, setArchivedChallenges] = useState<ChallengeListItem[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryChallenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(() => {
    const parsed = routeChallengeId ? Number(routeChallengeId) : null;
    return parsed && !Number.isNaN(parsed) ? parsed : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [active, archived, presets] = await Promise.all([
        fetchChallengeListItems('active'),
        fetchChallengeListItems('archived'),
        fetchDiscoveryChallenges(),
      ]);
      setActiveChallenges(active);
      setArchivedChallenges(archived);
      setDiscovery(presets);
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? 'Не удалось загрузить соревнования');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const parsed = routeChallengeId ? Number(routeChallengeId) : null;
    if (parsed && !Number.isNaN(parsed)) setSelectedChallengeId(parsed);
  }, [routeChallengeId]);

  const openCreateModal = () => {
    setSearchParams({ tab: activeTab, create: '1' });
  };

  const closeCreateModal = () => {
    setSearchParams({ tab: activeTab });
  };

  const closeEditModal = () => {
    setSearchParams({ tab: activeTab });
  };

  const handleTabChange = (tab: ChallengeTab) => {
    setSearchParams({ tab });
  };

  const openChallenge = useCallback(
    (challengeId: number) => {
      setSelectedChallengeId(challengeId);
      navigate(`/challenges/${challengeId}?tab=${activeTab}`, { replace: true });
    },
    [activeTab, navigate],
  );

  const closeChallenge = useCallback(() => {
    setSelectedChallengeId(null);
    navigate(`/challenges?tab=${activeTab}`, { replace: true });
  }, [activeTab, navigate]);

  const handleCreateSuccess = async () => {
    closeCreateModal();
    showToast('Соревнование создано');
    await loadData();
  };

  const handleEditSuccess = async () => {
    closeEditModal();
    showToast('Изменения сохранены');
    await loadData();
  };

  const handleOpenEdit = (id: number) => {
    const challenge = [...activeChallenges, ...archivedChallenges].find((item) => item.id === id);
    if (!challenge || !canEditChallenge(challenge)) {
      showToast('Публичный челлендж нельзя редактировать');
      return;
    }
    closeChallenge();
    setSearchParams({ tab: activeTab, edit: String(id) });
  };

  const handlePublish = (id: number) => {
    setConfirmState({
      title: 'Сделать челлендж публичным?',
      description:
        'После этого его нельзя будет редактировать, он переместится в групповые.',
      confirmLabel: 'Сделать публичным',
      action: async () => {
        try {
          await challengeApi.publish(id);
          if (selectedChallengeId === id) closeChallenge();
          showToast('Челлендж опубликован');
          setSearchParams({ tab: 'group' });
          await loadData();
        } catch (err) {
          showToast(parseApiError(err as AxiosError).message);
        }
      },
    });
  };

  const handleCopyLink = async (id: number) => {
    const challenge = [...activeChallenges, ...archivedChallenges].find((item) => item.id === id);
    if (!challenge?.joinCode) return;

    const inviteUrl = buildChallengeInviteUrl(challenge.joinCode);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showToast('Ссылка-приглашение скопирована');
    } catch {
      showToast(inviteUrl);
    }
  };

  const handleJoin = async (id: number) => {
    try {
      await challengeApi.joinById(id);
      showToast('Вы присоединились');
      setSearchParams({ tab: 'group' });
      await loadData();
    } catch (err) {
      showToast(parseApiError(err as AxiosError).message);
    }
  };

  const handleLeave = (id: number) => {
    setConfirmState({
      title: 'Покинуть соревнование?',
      description: 'Вы перестанете быть участником. Снова присоединиться можно по ссылке.',
      confirmLabel: 'Покинуть',
      tone: 'danger',
      action: async () => {
        try {
          await challengeApi.leave(id);
          if (selectedChallengeId === id) closeChallenge();
          showToast('Вы покинули соревнование');
          await loadData();
        } catch (err) {
          showToast(parseApiError(err as AxiosError).message);
        }
      },
    });
  };

  const handleResume = async (id: number) => {
    try {
      await challengeApi.resume(id);
      showToast('Соревнование возобновлено');
      await loadData();
      setSearchParams({ tab: 'individual' });
    } catch (err) {
      showToast(parseApiError(err as AxiosError).message);
    }
  };

  const runConfirmed = async () => {
    if (!confirmState || isConfirming) return;
    setIsConfirming(true);
    try {
      await confirmState.action();
    } finally {
      setIsConfirming(false);
      setConfirmState(null);
    }
  };

  const challenges = filterByTab(
    activeTab === 'archive' ? archivedChallenges : activeChallenges,
    activeTab,
  );

  return (
    <div className="relative min-h-dvh px-[18px] pt-[52px]">
      <header className="mb-4 flex items-center justify-between px-1">
        <h1 className="text-[22px] font-extrabold text-neutral-text">Обзор</h1>
        <p className="text-[13px] font-bold text-neutral-muted">Готовые соревнования</p>
      </header>

      {discovery.length > 0 ? (
        <section className="mb-4 px-2">
          <DiscoveryCard challenge={discovery[0]} onJoin={(id) => void handleJoin(id)} />
          <div className="mt-2 flex justify-center gap-3">
            {Array.from({ length: Math.min(4, Math.max(1, discovery.length)) }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 w-1.5 rounded-full ${index === 0 ? 'bg-sky-500' : 'bg-neutral-border'}`}
              />
            ))}
          </div>
        </section>
      ) : (
        <p className="mb-7 text-center text-[14px] font-bold text-neutral-muted">
          Пока что нет доступных соревнований:(
        </p>
      )}

      <MobileTabs activeTab={activeTab} onChange={handleTabChange} />

      <section className="mt-4 space-y-5">
        {isLoading && (
          <p className="rounded-[14px] bg-white p-4 text-[13px] font-semibold text-neutral-muted">
            Загрузка...
          </p>
        )}

        {error && (
          <p className="rounded-[14px] bg-white p-4 text-[13px] font-semibold text-red-500">
            {error}
          </p>
        )}

        {!isLoading && !error && challenges.length === 0 && (
          <p className="px-3 py-10 text-center text-[14px] font-semibold text-neutral-muted">
            Здесь пока пусто
          </p>
        )}

        {challenges.map((challenge) => (
          <CompetitionCard
            key={challenge.id}
            challenge={challenge}
            tab={activeTab}
            onOpen={openChallenge}
            onLeave={handleLeave}
            onResume={(id) => void handleResume(id)}
          />
        ))}
      </section>

      <button
        type="button"
        onClick={openCreateModal}
        aria-label="Создать соревнование"
        className="fixed bottom-[90px] z-30 grid h-[39px] w-[45px] place-items-center rounded-[10px] bg-[#ee6844] text-white shadow-card"
        style={{ right: 'max(18px, calc((100vw - 430px) / 2 + 18px))' }}
      >
        <Plus size={35} strokeWidth={2.2} />
      </button>

      {showCreateModal && (
        <MobileChallengeCreateModal
          onClose={closeCreateModal}
          onSuccess={() => void handleCreateSuccess()}
        />
      )}

      {editChallengeId != null && (
        <ChallengeFormModal
          mode="edit"
          challengeId={editChallengeId}
          onClose={closeEditModal}
          onSuccess={() => void handleEditSuccess()}
        />
      )}

      {selectedChallengeId != null && (
        <ChallengeDetailModal
          challengeId={selectedChallengeId}
          onClose={closeChallenge}
          onEdit={handleOpenEdit}
          onPublish={(id) => void handlePublish(id)}
          onCopyLink={() => void handleCopyLink(selectedChallengeId)}
          onLeave={handleLeave}
          onResume={(id) => void handleResume(id)}
          returnTarget={{ type: 'challenge', challengeId: selectedChallengeId, tab: activeTab }}
        />
      )}

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        isLoading={isConfirming}
        onConfirm={() => void runConfirmed()}
        onCancel={() => {
          if (!isConfirming) setConfirmState(null);
        }}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-[86px] left-4 right-4 z-50 mx-auto max-w-[398px] rounded-[12px] bg-neutral-text px-4 py-3 text-center text-[13px] font-semibold text-white shadow-modal"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
