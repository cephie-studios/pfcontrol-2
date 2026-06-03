import { useState, useEffect } from 'react';
import {
  MdPeople,
  MdDelete,
  MdVerifiedUser,
  MdPerson,
  MdCheck,
  MdGppBad,
  MdNotes,
} from 'react-icons/md';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminIconInput from '../../components/admin/AdminIconInput';
import AdminTable from '../../components/admin/AdminTable';
import AdminStatStrip from '../../components/admin/AdminStatStrip';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  ADMIN_TOOLBAR_HEIGHT,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TD,
} from '../../components/admin/adminConstants';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import ErrorScreen from '../../components/common/ErrorScreen';
import {
  fetchTesters,
  addTester,
  removeTester,
  updateTesterSettings,
  type Tester,
} from '../../utils/fetch/testers';
import { getTesterSettings } from '../../utils/fetch/data';

export default function AdminTesters() {
  const [testers, setTesters] = useState<Tester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTesters, setTotalTesters] = useState(0);
  const [addingTester, setAddingTester] = useState(false);
  const [removingTester, setRemovingTester] = useState<string | null>(null);
  const [newTesterUserId, setNewTesterUserId] = useState('');
  const [newTesterNotes, setNewTesterNotes] = useState('');
  const [gateEnabled, setGateEnabled] = useState(true);
  const [updatingGate, setUpdatingGate] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const fetchTestersData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [testersData, settings] = await Promise.all([
        fetchTesters(currentPage, 50, searchTerm),
        getTesterSettings(),
      ]);

      setTesters(testersData.testers);
      setTotalPages(testersData.pagination.pages);
      setTotalTesters(testersData.pagination.total);
      setGateEnabled(settings.tester_gate_enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch testers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestersData();
  }, [currentPage, searchTerm]);

  const handleAddTester = async () => {
    if (!newTesterUserId.trim()) {
      setToast({ message: 'User ID is required', type: 'error' });
      return;
    }

    try {
      setAddingTester(true);
      await addTester(newTesterUserId.trim(), newTesterNotes.trim());

      setToast({ message: 'Tester added successfully', type: 'success' });
      setNewTesterUserId('');
      setNewTesterNotes('');
      fetchTestersData();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to add tester',
        type: 'error',
      });
    } finally {
      setAddingTester(false);
    }
  };

  const handleRemoveTester = async (userId: string) => {
    try {
      setRemovingTester(userId);
      await removeTester(userId);

      setToast({
        message: 'Tester removed successfully',
        type: 'success',
      });
      fetchTestersData();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to remove tester',
        type: 'error',
      });
    } finally {
      setRemovingTester(null);
    }
  };

  const handleToggleGate = async () => {
    try {
      setUpdatingGate(true);
      await updateTesterSettings({ tester_gate_enabled: !gateEnabled });
      setGateEnabled(!gateEnabled);

      setToast({
        message: `Tester gate ${!gateEnabled ? 'enabled' : 'disabled'}`,
        type: 'success',
      });
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to update settings',
        type: 'error',
      });
    } finally {
      setUpdatingGate(false);
    }
  };

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader
        title="Tester Management"
        icon={MdVerifiedUser}
        accent="purple"
      />

      <AdminStatStrip
        items={[{ label: 'Total testers', value: totalTesters }]}
        columns={2}
      />

      <div className={adminSectionClass('!mt-0 !pt-0 !border-t-0')}>
        <AdminSectionTitle>Tester gate</AdminSectionTitle>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                gateEnabled ? 'bg-emerald-950/40' : 'bg-red-950/40'
              }`}
            >
              {gateEnabled ? (
                <MdVerifiedUser size={20} className="text-emerald-400" />
              ) : (
                <MdGppBad size={20} className="text-red-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">
                {gateEnabled ? 'Gate enabled' : 'Gate disabled'}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {gateEnabled
                  ? 'Only approved testers can access the application'
                  : 'All users can access the application'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleToggleGate}
            disabled={updatingGate}
            variant={gateEnabled ? 'danger' : 'primary'}
            size={adminDownsizeButtonSize('sm')}
          >
            {updatingGate ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : gateEnabled ? (
              'Disable gate'
            ) : (
              'Enable gate'
            )}
          </Button>
        </div>
      </div>

      <div className={adminSectionClass()}>
        <AdminSectionTitle>Add new tester</AdminSectionTitle>
        <div className="flex flex-wrap items-end gap-3">
          <AdminIconInput
            label="User ID"
            icon={<MdPerson size={18} />}
            value={newTesterUserId}
            onChange={setNewTesterUserId}
            placeholder="Discord user ID"
            className="flex-1 min-w-[12rem] max-w-xs max-md:w-full max-md:max-w-none max-md:basis-full"
            required
          />
          <AdminIconInput
            label="Notes (optional)"
            icon={<MdNotes size={18} />}
            value={newTesterNotes}
            onChange={setNewTesterNotes}
            placeholder="Any notes about this tester"
            className="flex-1 min-w-[12rem] max-w-md"
          />
          <Button
            onClick={handleAddTester}
            disabled={addingTester}
            size="sm"
            className={`shrink-0 ${ADMIN_TOOLBAR_HEIGHT} py-0 flex items-center`}
          >
            {addingTester ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <MdCheck size={16} className="mr-1.5" />
            )}
            Add tester
          </Button>
        </div>
      </div>

      <div className={adminSectionClass()}>
        <AdminSectionTitle>Testers</AdminSectionTitle>

        <AdminToolbar>
          <AdminSearchInput
            value={searchTerm}
            onChange={(v) => {
              setSearchTerm(v);
              setCurrentPage(1);
            }}
            placeholder="Search by username or ID…"
            loading={loading}
            className="max-md:!w-full max-md:!max-w-none max-md:flex-none max-md:basis-full"
          />
        </AdminToolbar>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : error ? (
          <ErrorScreen
            title="Error loading testers"
            message={error}
            onRetry={fetchTestersData}
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <AdminTable minWidth="800px">
                <thead className={ADMIN_TABLE_HEAD}>
                  <tr>
                    <th className={ADMIN_TH}>Tester</th>
                    <th className={ADMIN_TH}>Added by</th>
                    <th className={ADMIN_TH}>Date added</th>
                    <th className={ADMIN_TH}>Notes</th>
                    <th className={ADMIN_TH}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {testers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-zinc-500"
                      >
                        <MdPeople
                          size={40}
                          className="mx-auto mb-3 opacity-50"
                        />
                        <p className="text-sm">No testers found</p>
                      </td>
                    </tr>
                  ) : (
                    testers.map((tester) => (
                      <tr key={tester.id} className="hover:bg-zinc-800/30">
                        <td className={ADMIN_TD}>
                          <div className="flex items-center">
                            {tester.avatar ? (
                              <img
                                src={`https://cdn.discordapp.com/avatars/${tester.user_id}/${tester.avatar}.png`}
                                alt={tester.username}
                                className="w-9 h-9 rounded-full mr-3"
                              />
                            ) : (
                              <div className="w-9 h-9 bg-zinc-700 rounded-full flex items-center justify-center mr-3">
                                <MdPerson size={18} className="text-zinc-400" />
                              </div>
                            )}
                            <div>
                              <span className="text-white font-medium">
                                {tester.username}
                              </span>
                              <p className="text-xs text-zinc-500 font-mono">
                                {tester.user_id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={ADMIN_TD}>{tester.added_by_username}</td>
                        <td className={ADMIN_TD}>
                          {new Date(tester.created_at).toLocaleDateString()}
                        </td>
                        <td className={ADMIN_TD}>{tester.notes || '—'}</td>
                        <td className={ADMIN_TD}>
                          <Button
                            onClick={() => handleRemoveTester(tester.user_id)}
                            disabled={removingTester === tester.user_id}
                            variant="danger"
                            size={adminDownsizeButtonSize('sm')}
                          >
                            {removingTester === tester.user_id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <MdDelete size={16} />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </AdminTable>
            </div>

            <div className="lg:hidden space-y-3">
              {testers.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <MdPeople size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No testers found</p>
                </div>
              ) : (
                testers.map((tester) => (
                  <div
                    key={tester.id}
                    className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {tester.avatar ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${tester.user_id}/${tester.avatar}.png`}
                          alt={tester.username}
                          className="w-9 h-9 rounded-full"
                        />
                      ) : (
                        <div className="w-9 h-9 bg-zinc-700 rounded-full flex items-center justify-center">
                          <MdPerson size={18} className="text-zinc-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-white font-medium">
                          {tester.username}
                        </p>
                        <p className="text-xs text-zinc-500 font-mono">
                          {tester.user_id}
                        </p>
                      </div>
                    </div>
                    <dl className="space-y-1 text-sm text-zinc-400 mb-3">
                      <div>
                        <span className="text-zinc-500">Added by:</span>{' '}
                        {tester.added_by_username}
                      </div>
                      <div>
                        <span className="text-zinc-500">Date:</span>{' '}
                        {new Date(tester.created_at).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="text-zinc-500">Notes:</span>{' '}
                        {tester.notes || '—'}
                      </div>
                    </dl>
                    <Button
                      onClick={() => handleRemoveTester(tester.user_id)}
                      disabled={removingTester === tester.user_id}
                      variant="danger"
                      size={adminDownsizeButtonSize('sm')}
                    >
                      {removingTester === tester.user_id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <MdDelete size={16} />
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center mt-6 gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
