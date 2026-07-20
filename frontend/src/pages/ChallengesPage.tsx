import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { PageTabs } from '../components/ui/PageTabs.tsx';
import { PageContainer } from '../components/layout/PageContainer.tsx';
import { ChallengeCard } from '../components/challenges/ChallengeCard.tsx';
import { DiscoveryCard } from '../components/challenges/DiscoveryCard.tsx';
import { ChallengeDetailModal } from '../components/challenges/ChallengeDetailModal.tsx';
import { ChallengeFormModal } from '../components/challenges/ChallengeFormModal.tsx';
import { ChallengeInviteModal } from '../components/challenges/ChallengeInviteModal.tsx';
import { challengeApi } from '../api/challengeApi.ts';
import { parseApiError } from '../utils/parseApiError.ts';
import { buildChallengeInviteUrl } from '../utils/inviteUrl.ts';
import type { AxiosError } from 'axios';
import {
  fetchChallengeListItems,
  fetchDiscoveryChallenges,
} from '../api/challengeQueries.ts';
import type { ChallengeListItem, ChallengeTab, DiscoveryChallenge } from '../types/challenge.ts';
import { canEditChallenge } from '../utils/challengePermissions.ts';

const TABS = [
  { id: 'individual', label: 'Индивидуальные' },
  { id: 'group', label: 'Групповые' },
  { id: 'archive', label: 'Архив' },
] as const;

function normalizeTab(value: string | null): ChallengeTab {
  if (value === 'mine') return 'individual';
  if (value === 'participating') return 'group';
  if (value === 'individual' || value === 'group' || value === 'archive') return value;
  return 'individual';
}

function filterByTab(items: ChallengeListItem[], tab: ChallengeTab): ChallengeListItem[] {
  if (tab === 'archive') {
    return items.filter((challenge) => challenge.status === 'archived');
  }
  if (tab === 'individual') {
    return items.filter(
      (challenge) =>
        challenge.status === 'active' && challenge.isPrivate && challenge.isOwner,
    );
  }
  return items.filter(
    (challenge) =>
      challenge.status === 'active' && !(challenge.isPrivate && challenge.isOwner),
  );
}

function getErrorMessage(err: unknown, fallback: string): string {
  return parseApiError(err as AxiosError).message ?? fallback;
}

type ConfirmState = {
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  action: () => Promise<void>;
} | null;

function DiscoverySection({
  discovery,
  isLoading,
  onJoin,
}: {
  discovery: DiscoveryChallenge[];
  isLoading: boolean;
  onJoin: (id: number) => void;
}) {
  return (
    <>
      <h2 className="text-lg font-bold text-neutral-text mb-1">Обзор</h2>
      <p className="text-sm text-neutral-muted mb-4 sm:mb-5">Готовые челленджи</p>
      <div className="space-y-4">
        {discovery.length === 0 && !isLoading && (
          <p className="text-sm text-neutral-muted">Нет готовых челленджей</p>
        )}
        {discovery.map((challenge) => (
          <DiscoveryCard
            key={challenge.id}
            challenge={challenge}
            onJoin={() => onJoin(challenge.id)}
          />
        ))}
      </div>
    </>
  );
}

/**
 * Мобильный блок «Обзор» по макету: горизонтальная карусель готовых
 * челленджей с точками-индикаторами под ней.
 */
function DiscoveryCarousel({
  discovery,
  isLoading,
  onJoin,
}: {
  discovery: DiscoveryChallenge[];
  isLoading: boolean;
  onJoin: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Развёрнутый список всех готовых челленджей (только мобильный вид)
  const [expanded, setExpanded] = useState(false);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    // Ширина слайда = ширина контейнера, между слайдами gap 12px
    const index = Math.round(el.scrollLeft / (el.clientWidth + 12));
    setActiveIndex(Math.min(Math.max(index, 0), discovery.length - 1));
  };

  const canExpand = discovery.length > 0;

  if (expanded) {
    return (
      <section className="lg:hidden mb-6">
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Назад"
            className="flex items-center gap-0.5 -ml-1 py-1 pr-2 text-sm font-semibold text-neutral-muted active:opacity-70"
          >
            <ChevronLeft size={22} />
            Назад
          </button>
          <h2 className="text-2xl font-extrabold text-neutral-text">Готовые челленджи</h2>
        </div>

        <div className="space-y-3">
          {discovery.map((challenge) => (
            <DiscoveryCard
              key={challenge.id}
              challenge={challenge}
              onJoin={() => onJoin(challenge.id)}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="lg:hidden mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-2xl font-extrabold text-neutral-text">Обзор</h2>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-0.5 text-sm font-semibold text-neutral-muted text-right active:opacity-70"
          >
            Готовые челленджи
            <ChevronRight size={16} />
          </button>
        ) : (
          <span className="text-sm font-semibold text-neutral-muted text-right">
            Готовые челленджи
          </span>
        )}
      </div>

      {discovery.length === 0 && !isLoading && (
        <p className="text-sm font-medium text-neutral-muted text-center py-2">
          Пока нет доступных челленджей:(
        </p>
      )}

      {discovery.length > 0 && (
        <>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {discovery.map((challenge) => (
              <div key={challenge.id} className="w-full flex-shrink-0 snap-center">
                <DiscoveryCard
                  challenge={challenge}
                  onJoin={() => onJoin(challenge.id)}
                />
              </div>
            ))}
          </div>

          {discovery.length > 1 && (
            <div className="flex justify-center gap-2 mt-3" aria-hidden>
              {discovery.map((challenge, index) => (
                <span
                  key={challenge.id}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === activeIndex ? 'bg-brand' : 'bg-neutral-border'
                  }`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function ChallengesPage() {
  const navigate = useNavigate();
  const { id: routeChallengeId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = normalizeTab(searchParams.get('tab'));
  const showCreateModal = searchParams.get('create') === '1';
  const editIdParam = searchParams.get('edit');
  const editChallengeId =
    editIdParam && !Number.isNaN(Number(editIdParam)) ? Number(editIdParam) : null;
  const inviteCode = searchParams.get('invite')?.trim().toUpperCase() ?? null;

  const openCreateModal = () => {
    setSearchParams({ tab: activeTab, create: '1' });
  };

  const closeCreateModal = () => {
    setSearchParams({ tab: activeTab });
  };

  const openEditModal = (id: number) => {
    setSearchParams({ tab: activeTab, edit: String(id) });
  };

  const closeEditModal = () => {
    setSearchParams({ tab: activeTab });
  };

  const closeInvite = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('invite');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const [activeChallenges, setActiveChallenges] = useState<ChallengeListItem[]>([]);
  const [archivedChallenges, setArchivedChallenges] = useState<ChallengeListItem[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parsedRouteId = routeChallengeId ? Number(routeChallengeId) : null;
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(
    parsedRouteId && !Number.isNaN(parsedRouteId) ? parsedRouteId : null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isConfirming, setIsConfirming] = useState(false);

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
      setError(apiErr.message ?? 'Не удалось загрузить челленджи');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (parsedRouteId && !Number.isNaN(parsedRouteId)) {
      setSelectedChallengeId(parsedRouteId);
    }
  }, [parsedRouteId]);

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
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

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const handleCreateSuccess = async () => {
    closeCreateModal();
    showToast('Челлендж создан');
    await loadData();
  };

  const handleEditSuccess = async () => {
    closeEditModal();
    showToast('Изменения сохранены');
    await loadData();
  };

  const handleCopyLink = async (challenge: ChallengeListItem) => {
    if (!challenge.joinCode) return;
    const inviteUrl = buildChallengeInviteUrl(challenge.joinCode);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showToast('Ссылка-приглашение скопирована');
    } catch {
      showToast(inviteUrl);
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

  const handlePublish = (id: number) => {
    setConfirmState({
      title: 'Сделать челлендж групповым?',
      description:
        'После этого его нельзя будет редактировать, он переместится в «Групповые».',
      confirmLabel: 'Сделать групповым',
      action: async () => {
        try {
          await challengeApi.publish(id);
          showToast('Челлендж опубликован');
          if (selectedChallengeId === id) {
            closeChallenge();
          }
          setSearchParams({ tab: 'group' });
          await loadData();
        } catch (err) {
          showToast(getErrorMessage(err, 'Не удалось опубликовать челлендж'));
        }
      },
    });
  };

  const handleInviteJoined = async (challengeId: number) => {
    closeInvite();
    showToast('Вы присоединились к челленджу');
    await loadData();
    setSearchParams({ tab: 'group' });
    openChallenge(challengeId);
  };

  const handleArchive = async (id: number) => {
    try {
      await challengeApi.archive(id);
      showToast('Челлендж перемещён в архив');
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось архивировать'));
    }
  };

  const handleResume = async (id: number) => {
    try {
      await challengeApi.resume(id);
      showToast('Челлендж возобновлён');
      if (selectedChallengeId === id) {
        closeChallenge();
      }
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось возобновить челлендж'));
    }
  };

  const handleDelete = (id: number) => {
    setConfirmState({
      title: 'Удалить челлендж?',
      description: 'Это действие нельзя отменить — челлендж удалится безвозвратно.',
      confirmLabel: 'Удалить',
      tone: 'danger',
      action: async () => {
        try {
          await challengeApi.delete(id);
          if (selectedChallengeId === id) {
            closeChallenge();
          }
          showToast('Челлендж удалён');
          await loadData();
        } catch (err) {
          showToast(getErrorMessage(err, 'Не удалось удалить челлендж'));
        }
      },
    });
  };

  const handleLeave = (id: number) => {
    setConfirmState({
      title: 'Покинуть челлендж?',
      description: 'Вы перестанете быть участником. Присоединиться снова можно по ссылке-приглашению.',
      confirmLabel: 'Покинуть',
      tone: 'danger',
      action: async () => {
        try {
          await challengeApi.leave(id);
          if (selectedChallengeId === id) {
            closeChallenge();
          }
          showToast('Вы покинули челлендж');
          await loadData();
        } catch (err) {
          showToast(getErrorMessage(err, 'Не удалось покинуть челлендж'));
        }
      },
    });
  };

  const handleJoin = async (id: number) => {
    try {
      await challengeApi.joinById(id);
      showToast('Вы присоединились к челленджу');
      setSearchParams({ tab: 'group' });
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось присоединиться'));
    }
  };

  const allChallenges = [...activeChallenges, ...archivedChallenges];
  const challenges = filterByTab(
    activeTab === 'archive' ? archivedChallenges : activeChallenges,
    activeTab,
  );

  const handleOpenEdit = (id: number) => {
    const challenge = allChallenges.find((item) => item.id === id);
    if (!challenge || !canEditChallenge(challenge)) {
      showToast('Групповой челлендж нельзя редактировать');
      return;
    }
    closeChallenge();
    openEditModal(id);
  };

  return (
    <PageContainer>
      <div className="flex flex-col xl:flex-row gap-8 xl:gap-10">
        <div className="flex-1 min-w-0">
          {/* Десктопная шапка: на мобильных её заменяет блок «Обзор» и FAB */}
          <div className="hidden lg:flex gap-4 lg:items-center lg:justify-between mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text">Челленджи</h1>
            <Button
              variant="primary"
              size="md"
              fullWidth
              className="sm:w-auto"
              data-tour="create-challenge"
              onClick={openCreateModal}
            >
              <Plus size={18} />
              Создать челлендж
            </Button>
          </div>

          <DiscoveryCarousel
            discovery={discovery}
            isLoading={isLoading}
            onJoin={(id) => void handleJoin(id)}
          />

          <div data-tour="challenge-tabs">
            <PageTabs
              tabs={[...TABS]}
              activeTab={activeTab}
              onChange={handleTabChange}
              className="mb-6 sm:mb-8"
            />
          </div>

          {isLoading && <p className="text-neutral-muted text-sm py-8">Загрузка...</p>}

          {error && (
            <p className="text-red-500 text-sm py-8" role="alert">{error}</p>
          )}

          {!isLoading && !error && (
            <div className="space-y-5">
              {challenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  tab={activeTab}
                  onOpen={openChallenge}
                  onCopyLink={() => void handleCopyLink(challenge)}
                  onPublish={(cid) => void handlePublish(cid)}
                  onEdit={handleOpenEdit}
                  onArchive={(cid) => void handleArchive(cid)}
                  onDelete={(cid) => void handleDelete(cid)}
                  onLeave={(cid) => void handleLeave(cid)}
                  onResume={(cid) => void handleResume(cid)}
                />
              ))}

              {challenges.length === 0 && (
                <p className="text-neutral-muted text-center py-12 sm:py-16">
                  {activeTab === 'individual' && 'Создайте индивидуальный челлендж — его можно редактировать до публикации'}
                  {activeTab === 'group' && 'Здесь появятся групповые челленджи и те, к которым вы присоединились'}
                  {activeTab === 'archive' && 'Архив пуст'}
                </p>
              )}
            </div>
          )}

          {/* Ниже xl (но от lg) «Обзор» остаётся под списком, как раньше;
              на мобильных он показан каруселью сверху */}
          <section className="hidden lg:block xl:hidden mt-10 pt-8 border-t border-neutral-border">
            <DiscoverySection
              discovery={discovery}
              isLoading={isLoading}
              onJoin={(id) => void handleJoin(id)}
            />
          </section>
        </div>

        <aside className="hidden xl:block w-[300px] flex-shrink-0">
          <DiscoverySection
            discovery={discovery}
            isLoading={isLoading}
            onJoin={(id) => void handleJoin(id)}
          />
        </aside>
      </div>

      {/* Мобильный FAB создания челленджа — над нижней таб-панелью */}
      <button
        type="button"
        aria-label="Создать челлендж"
        data-tour="create-challenge"
        onClick={openCreateModal}
        className="lg:hidden fixed z-30 right-4 bottom-[calc(92px+env(safe-area-inset-bottom))] w-14 h-14 rounded-2xl bg-brand text-white shadow-card-hover flex items-center justify-center hover:bg-brand-hover active:scale-95 transition-all"
      >
        <Plus size={30} strokeWidth={2.5} />
      </button>

      {showCreateModal && (
        <ChallengeFormModal
          mode="create"
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

      {inviteCode && (
        <ChallengeInviteModal
          joinCode={inviteCode}
          onClose={closeInvite}
          onJoined={(id) => void handleInviteJoined(id)}
        />
      )}

      {selectedChallengeId != null && (
        <ChallengeDetailModal
          challengeId={selectedChallengeId}
          onClose={closeChallenge}
          onResume={(cid) => void handleResume(cid)}
          onEdit={handleOpenEdit}
          onPublish={(cid) => void handlePublish(cid)}
          onCopyLink={() => {
            const challenge = allChallenges.find((item) => item.id === selectedChallengeId);
            if (challenge) void handleCopyLink(challenge);
          }}
          onLeave={(cid) => void handleLeave(cid)}
          onArchive={(cid) => {
            closeChallenge();
            void handleArchive(cid);
          }}
          onDelete={(cid) => void handleDelete(cid)}
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
          className="fixed bottom-20 lg:bottom-auto lg:top-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 px-5 py-3 bg-neutral-text text-white text-sm font-medium rounded-2xl shadow-modal animate-slide-up text-center sm:text-left"
        >
          {toast}
        </div>
      )}
    </PageContainer>
  );
}
