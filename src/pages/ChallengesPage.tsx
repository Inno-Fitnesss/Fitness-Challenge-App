import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { PageTabs } from '../components/ui/PageTabs.tsx';
import { PageContainer } from '../components/layout/PageContainer.tsx';
import { ChallengeCard } from '../components/challenges/ChallengeCard.tsx';
import { DiscoveryCard } from '../components/challenges/DiscoveryCard.tsx';
import { ChallengeDetailModal } from '../components/challenges/ChallengeDetailModal.tsx';
import { ChallengeFormModal } from '../components/challenges/ChallengeFormModal.tsx';
import { challengeApi } from '../api/challengeApi.ts';
import {
  fetchChallengeListItems,
  fetchDiscoveryChallenges,
} from '../api/challengeQueries.ts';
import type { ChallengeListItem, ChallengeTab, DiscoveryChallenge } from '../types/challenge.ts';

const TABS = [
  { id: 'mine', label: 'Мои' },
  { id: 'participating', label: 'Участвую' },
  { id: 'archive', label: 'Архив' },
] as const;

function isValidTab(value: string | null): value is ChallengeTab {
  return value === 'mine' || value === 'participating' || value === 'archive';
}

function filterByTab(items: ChallengeListItem[], tab: ChallengeTab): ChallengeListItem[] {
  if (tab === 'archive') return items;
  if (tab === 'mine') return items.filter((c) => c.isOwner);
  return items.filter((c) => !c.isOwner);
}

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

export function ChallengesPage() {
  const navigate = useNavigate();
  const { id: routeChallengeId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const activeTab: ChallengeTab = isValidTab(tabParam) ? tabParam : 'mine';
  const showCreateModal = searchParams.get('create') === '1';
  const editIdParam = searchParams.get('edit');
  const editChallengeId =
    editIdParam && !Number.isNaN(Number(editIdParam)) ? Number(editIdParam) : null;

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
    try {
      await navigator.clipboard.writeText(challenge.joinCode);
      showToast('Код приглашения скопирован');
    } catch {
      showToast(`Код: ${challenge.joinCode}`);
    }
  };

  const handleArchive = async (id: number) => {
    try {
      await challengeApi.archive(id);
      showToast('Челлендж перемещён в архив');
      await loadData();
    } catch (err) {
      showToast((err as { message?: string }).message ?? 'Не удалось архивировать');
    }
  };

  const handleLeave = async (id: number) => {
    try {
      await challengeApi.leave(id);
      showToast('Вы покинули челлендж');
      await loadData();
    } catch (err) {
      showToast((err as { message?: string }).message ?? 'Не удалось покинуть челлендж');
    }
  };

  const handleJoin = async (id: number) => {
    try {
      await challengeApi.joinById(id);
      showToast('Вы присоединились к челленджу');
      await loadData();
    } catch (err) {
      showToast((err as { message?: string }).message ?? 'Не удалось присоединиться');
    }
  };

  const sourceList = activeTab === 'archive' ? archivedChallenges : activeChallenges;
  const challenges = filterByTab(sourceList, activeTab);

  return (
    <PageContainer>
      <div className="flex flex-col xl:flex-row gap-8 xl:gap-10">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text">Челленджи</h1>
            <Button
              variant="primary"
              size="md"
              fullWidth
              className="sm:w-auto"
              onClick={openCreateModal}
            >
              <Plus size={18} />
              Создать челлендж
            </Button>
          </div>

          <PageTabs
            tabs={[...TABS]}
            activeTab={activeTab}
            onChange={handleTabChange}
            className="mb-6 sm:mb-8"
          />

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
                  onEdit={openEditModal}
                  onCopyLink={() => void handleCopyLink(challenge)}
                  onLeaderboard={openChallenge}
                  onArchive={(cid) => void handleArchive(cid)}
                  onDelete={() => showToast('Удаление пока не поддерживается API')}
                  onLeave={(cid) => void handleLeave(cid)}
                  onResume={() => showToast('Возобновление пока не поддерживается API')}
                />
              ))}

              {challenges.length === 0 && (
                <p className="text-neutral-muted text-center py-12 sm:py-16">
                  {activeTab === 'mine' && 'Вы ещё не создали ни одного челленджа'}
                  {activeTab === 'participating' && 'Вы пока не участвуете в челленджах'}
                  {activeTab === 'archive' && 'Архив пуст'}
                </p>
              )}
            </div>
          )}

          {/* Mobile / tablet discovery below list */}
          <section className="xl:hidden mt-10 pt-8 border-t border-neutral-border">
            <DiscoverySection
              discovery={discovery}
              isLoading={isLoading}
              onJoin={(id) => void handleJoin(id)}
            />
          </section>
        </div>

        {/* Desktop discovery sidebar */}
        <aside className="hidden xl:block w-[300px] flex-shrink-0">
          <DiscoverySection
            discovery={discovery}
            isLoading={isLoading}
            onJoin={(id) => void handleJoin(id)}
          />
        </aside>
      </div>

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

      {selectedChallengeId != null && (
        <ChallengeDetailModal
          challengeId={selectedChallengeId}
          onClose={closeChallenge}
          onResume={() => showToast('Возобновление пока не поддерживается API')}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 px-5 py-3 bg-neutral-text text-white text-sm font-medium rounded-2xl shadow-modal animate-slide-up text-center sm:text-left"
        >
          {toast}
        </div>
      )}
    </PageContainer>
  );
}
