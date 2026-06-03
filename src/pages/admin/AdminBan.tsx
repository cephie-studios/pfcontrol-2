import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  MdBlock,
  MdPeople,
  MdPublic,
  MdClose,
  MdShield,
  MdVerifiedUser,
  MdGppBad,
  MdPlace,
} from "react-icons/md";
import {
  banUser,
  unbanUser,
  fetchAllBans,
  fetchVpnGate,
  toggleVpnGate,
  addVpnException,
  removeVpnException,
  fetchIpLocation,
  type VpnException,
} from "../../utils/fetch/admin";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminSectionTitle from "../../components/admin/AdminSectionTitle";
import AdminStatStrip from "../../components/admin/AdminStatStrip";
import AdminTable from "../../components/admin/AdminTable";
import AdminToggleSwitch from "../../components/admin/AdminToggleSwitch";
import AdminTextInput from "../../components/admin/AdminTextInput";
import AdminDurationPresets from "../../components/admin/AdminDurationPresets";
import type { AdminDurationPresetId } from "../../components/admin/adminDurationPresetConfig";
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  adminTableShellClass,
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TABLE_HEAD,
  statusBadgeClass,
} from "../../components/admin/adminConstants";
import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import ErrorScreen from "../../components/common/ErrorScreen";

interface BanRecord {
  id: number;
  user_id?: string;
  ip_address?: string;
  username?: string;
  target_username?: string;
  reason: string;
  banned_by: string;
  banned_by_username?: string;
  banned_by_avatar?: string;
  banned_at: string;
  expires_at?: string;
  active: boolean;
}

interface IpLocation {
  country?: string;
  country_code?: string;
  city?: string;
  region?: string;
}

export default function AdminBan() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const userId = params.get("userId") || "";
  const username = params.get("username") || "";
  const reasonParam = params.get("reason") || "";
  const [banType, setBanType] = useState<"user" | "ip">("user");
  const [userIdInput, setUserIdInput] = useState(userId);
  const [ipInput, setIpInput] = useState("");
  const [reason, setReason] = useState(reasonParam);
  const [expiresAt, setExpiresAt] = useState("");
  const [durationPreset, setDurationPreset] =
    useState<AdminDurationPresetId | null>(null);
  const [loading, setLoading] = useState(false);

  const [bans, setBans] = useState<BanRecord[]>([]);
  const [bansLoading, setBansLoading] = useState(true);
  const [bansError, setBansError] = useState<string | null>(null);
  const [ipLocations, setIpLocations] = useState<Record<string, IpLocation>>(
    {}
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const [vpnGateEnabled, setVpnGateEnabled] = useState(false);
  const [vpnExceptions, setVpnExceptions] = useState<VpnException[]>([]);
  const [vpnGateLoading, setVpnGateLoading] = useState(true);
  const [vpnGateError, setVpnGateError] = useState<string | null>(null);
  const [vpnToggleLoading, setVpnToggleLoading] = useState(false);
  const [exceptionUserIdInput, setExceptionUserIdInput] = useState("");
  const [exceptionNotesInput, setExceptionNotesInput] = useState("");
  const [addExceptionLoading, setAddExceptionLoading] = useState(false);

  useEffect(() => {
    void fetchBans();
    void fetchVpnGateData();
  }, []);

  const lookupIpLocations = useCallback(async (banList: BanRecord[]) => {
    const ipsToLookup = banList
      .filter((b) => b.ip_address)
      .map((b) => b.ip_address!);

    if (ipsToLookup.length === 0) return;

    const results: Record<string, IpLocation> = {};
    await Promise.allSettled(
      ipsToLookup.map(async (ip) => {
        try {
          const data = await fetchIpLocation(ip);
          if (data.country || data.city || data.country_code) {
            results[ip] = data;
          }
        } catch {
          /* IP lookup failed for this address */
        }
      })
    );
    setIpLocations((prev) => ({ ...prev, ...results }));
  }, []);

  const fetchBans = async () => {
    try {
      setBansLoading(true);
      setBansError(null);
      const data = await fetchAllBans();
      const activeBans = (data.bans as unknown as BanRecord[]).filter(
        (ban) => ban.active
      );
      setBans(activeBans);
      void lookupIpLocations(activeBans);
    } catch (err) {
      setBansError("Failed to load bans");
      setToast({
        message: err instanceof Error ? err.message : "Failed to load bans",
        type: "error",
      });
    } finally {
      setBansLoading(false);
    }
  };

  const fetchVpnGateData = async () => {
    try {
      setVpnGateLoading(true);
      setVpnGateError(null);
      const data = await fetchVpnGate();
      setVpnGateEnabled(data.enabled);
      setVpnExceptions(data.exceptions);
    } catch {
      setVpnGateError("Failed to load VPN gate data");
    } finally {
      setVpnGateLoading(false);
    }
  };

  const handleBan = async () => {
    setLoading(true);
    try {
      if (banType === "user" && !userIdInput)
        throw new Error("User ID is required");
      if (banType === "ip" && !ipInput)
        throw new Error("IP address is required");
      await banUser({
        userId: banType === "user" ? userIdInput : undefined,
        ip: banType === "ip" ? ipInput : undefined,
        username: username || "",
        reason,
        expiresAt,
      });
      setToast({
        message: `Successfully banned ${banType === "user" ? "user" : "IP"}`,
        type: "success",
      });
      setUserIdInput("");
      setIpInput("");
      setReason("");
      setExpiresAt("");
      setDurationPreset(null);
      void fetchBans();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to ban",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (userIdOrIp: string) => {
    try {
      await unbanUser(userIdOrIp);
      setToast({ message: "Successfully unbanned", type: "success" });
      void fetchBans();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to unban",
        type: "error",
      });
    }
  };

  const handleToggleVpnGate = async () => {
    setVpnToggleLoading(true);
    try {
      const newValue = !vpnGateEnabled;
      await toggleVpnGate(newValue);
      setVpnGateEnabled(newValue);
      setToast({
        message: `VPN gate ${newValue ? "enabled" : "disabled"}`,
        type: "success",
      });
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to toggle VPN gate",
        type: "error",
      });
    } finally {
      setVpnToggleLoading(false);
    }
  };

  const handleAddException = async () => {
    if (!exceptionUserIdInput) {
      setToast({ message: "User ID is required", type: "error" });
      return;
    }
    setAddExceptionLoading(true);
    try {
      await addVpnException({
        userId: exceptionUserIdInput,
        notes: exceptionNotesInput,
      });
      setToast({ message: "Exception added", type: "success" });
      setExceptionUserIdInput("");
      setExceptionNotesInput("");
      void fetchVpnGateData();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to add exception",
        type: "error",
      });
    } finally {
      setAddExceptionLoading(false);
    }
  };

  const handleRemoveException = async (exceptionUserId: string) => {
    try {
      await removeVpnException(exceptionUserId);
      setToast({ message: "Exception removed", type: "success" });
      void fetchVpnGateData();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to remove exception",
        type: "error",
      });
    }
  };

  const getModAvatar = (ban: BanRecord) =>
    ban.banned_by_avatar
      ? `https://cdn.discordapp.com/avatars/${ban.banned_by}/${ban.banned_by_avatar}.png`
      : "/assets/app/default/avatar.webp";

  const presetExpiry = (
    ms: number,
    presetId: Exclude<AdminDurationPresetId, "permanent">
  ) => {
    setDurationPreset(presetId);
    setExpiresAt(new Date(Date.now() + ms).toISOString().slice(0, 16));
  };

  const btnSize = adminDownsizeButtonSize("sm");

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader title="Bans & access" icon={MdBlock} accent="red" />

      <AdminStatStrip
        columns={3}
        items={[
          { label: "Active bans", value: bansLoading ? "—" : bans.length },
          {
            label: "VPN gate",
            value: vpnGateLoading ? "—" : vpnGateEnabled ? "On" : "Off",
            sub: vpnGateEnabled
              ? "Blocking VPN/proxy unless excepted"
              : "Not enforcing VPN checks",
          },
          {
            label: "VPN exceptions",
            value: vpnGateLoading ? "—" : vpnExceptions.length,
          },
        ]}
      />

      <div className={adminSectionClass("!mt-0 !pt-0 !border-t-0")}>
        <AdminSectionTitle>Create ban</AdminSectionTitle>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 sm:p-5 space-y-4">
          <div>
            <span className="block text-xs text-zinc-500 mb-2">Ban type</span>
            <div
              className="inline-flex max-md:flex max-md:w-full h-10 rounded-full border-2 border-blue-600 overflow-hidden"
              role="group"
              aria-label="Ban type"
            >
              <button
                type="button"
                onClick={() => setBanType("user")}
                className={`px-4 max-md:flex-1 max-md:justify-center h-full flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  banType === "user"
                    ? ADMIN_SEGMENT_ACTIVE
                    : ADMIN_SEGMENT_INACTIVE
                }`}
              >
                <MdPeople size={16} />
                User ID
              </button>
              <button
                type="button"
                onClick={() => setBanType("ip")}
                className={`px-4 max-md:flex-1 max-md:justify-center h-full flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  banType === "ip"
                    ? ADMIN_SEGMENT_ACTIVE
                    : ADMIN_SEGMENT_INACTIVE
                }`}
              >
                <MdPublic size={16} />
                IP address
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {banType === "user" ? (
              <AdminTextInput
                className="sm:col-span-2"
                label="User ID"
                value={userIdInput}
                onChange={setUserIdInput}
                placeholder="Discord user ID"
              />
            ) : (
              <AdminTextInput
                className="sm:col-span-2"
                label="IP address"
                value={ipInput}
                onChange={setIpInput}
                placeholder="e.g. 203.0.113.42"
              />
            )}
            <AdminTextInput
              className="sm:col-span-2"
              label="Reason"
              value={reason}
              onChange={setReason}
              placeholder="Reason for ban"
              required
            />
            <AdminTextInput
              label="Expires at (optional)"
              type="datetime-local"
              value={expiresAt}
              onChange={(value) => {
                setExpiresAt(value);
                setDurationPreset(value.trim() ? null : "permanent");
              }}
            />
            <AdminDurationPresets
              activePreset={durationPreset}
              onPreset={presetExpiry}
              onPermanent={() => {
                setDurationPreset("permanent");
                setExpiresAt("");
              }}
            />
          </div>

          <div className="flex justify-end pt-1 border-t border-zinc-800/80">
            <Button
              onClick={() => void handleBan()}
              disabled={loading || !reason}
              size="sm"
              variant="danger"
            >
              {loading ? "Banning…" : "Apply ban"}
            </Button>
          </div>
        </div>
      </div>

      <div className={adminSectionClass()}>
        <AdminSectionTitle>Active bans</AdminSectionTitle>
        {bansLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : bansError ? (
          <ErrorScreen
            title="Error loading bans"
            message={bansError}
            onRetry={fetchBans}
          />
        ) : bans.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6 text-center rounded-xl border border-dashed border-zinc-800">
            No active bans.
          </p>
        ) : (
          <AdminTable minWidth="900px">
            <thead className={ADMIN_TABLE_HEAD}>
              <tr>
                <th className={ADMIN_TH}>Target</th>
                <th className={ADMIN_TH}>Reason</th>
                <th className={ADMIN_TH}>Banned</th>
                <th className={ADMIN_TH}>Expires</th>
                <th className={ADMIN_TH}>Moderator</th>
                <th className={`${ADMIN_TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {bans.map((ban) => {
                const loc = ban.ip_address
                  ? ipLocations[ban.ip_address]
                  : undefined;
                const isUser = Boolean(ban.user_id);
                return (
                  <tr key={ban.id} className="hover:bg-zinc-800/30">
                    <td className={ADMIN_TD}>
                      <div className="flex items-start gap-2 min-w-0">
                        {isUser ? (
                          <MdPeople
                            size={18}
                            className="text-red-400 shrink-0 mt-0.5"
                          />
                        ) : (
                          <MdPublic
                            size={18}
                            className="text-orange-400 shrink-0 mt-0.5"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">
                            {isUser
                              ? ban.target_username ||
                                ban.username ||
                                ban.user_id
                              : ban.ip_address}
                          </p>
                          {isUser && (
                            <p className="text-xs text-zinc-500 font-mono truncate">
                              {ban.user_id}
                            </p>
                          )}
                          {ban.ip_address && loc && (
                            <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                              <MdPlace size={12} className="shrink-0" />
                              {[loc.city, loc.region, loc.country]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                          <span
                            className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full ${statusBadgeClass("banned")}`}
                          >
                            {isUser ? "User" : "IP"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={`${ADMIN_TD} max-w-xs`}>
                      <p className="line-clamp-2">{ban.reason}</p>
                    </td>
                    <td
                      className={`${ADMIN_TD} whitespace-nowrap text-xs text-zinc-400`}
                    >
                      {new Date(ban.banned_at).toLocaleString()}
                    </td>
                    <td className={`${ADMIN_TD} whitespace-nowrap text-xs`}>
                      {ban.expires_at ? (
                        <span className="text-amber-300/90">
                          {new Date(ban.expires_at).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-zinc-500">Never</span>
                      )}
                    </td>
                    <td className={ADMIN_TD}>
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={getModAvatar(ban)}
                          alt=""
                          className="w-6 h-6 rounded-full shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/assets/app/default/avatar.webp";
                          }}
                        />
                        <span className="text-xs text-zinc-300 truncate">
                          {ban.banned_by_username || ban.banned_by}
                        </span>
                      </div>
                    </td>
                    <td className={`${ADMIN_TD} text-right`}>
                      <Button
                        size={btnSize}
                        variant="outline"
                        onClick={() =>
                          void handleUnban(ban.user_id || ban.ip_address!)
                        }
                      >
                        <MdClose size={16} className="inline mr-1" />
                        Unban
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        )}
      </div>

      <div className={adminSectionClass()}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <MdShield size={20} className="text-orange-400 shrink-0" />
          <AdminSectionTitle className="!mb-0 flex-1">
            VPN gate
          </AdminSectionTitle>
        </div>

        {vpnGateLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : vpnGateError ? (
          <ErrorScreen
            title="Error loading VPN gate"
            message={vpnGateError}
            onRetry={fetchVpnGateData}
          />
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2.5 rounded-lg shrink-0 ${
                    vpnGateEnabled ? "bg-orange-500/20" : "bg-zinc-800"
                  }`}
                >
                  {vpnGateEnabled ? (
                    <MdVerifiedUser size={22} className="text-orange-400" />
                  ) : (
                    <MdGppBad size={22} className="text-zinc-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {vpnGateEnabled
                      ? "VPN gate is enabled"
                      : "VPN gate is disabled"}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5 max-w-md">
                    {vpnGateEnabled
                      ? "Users on VPN or proxy are blocked unless they appear in the exceptions list."
                      : "All users can connect regardless of VPN detection."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-zinc-400">
                  {vpnGateEnabled ? "Enabled" : "Disabled"}
                </span>
                <AdminToggleSwitch
                  checked={vpnGateEnabled}
                  onChange={() => void handleToggleVpnGate()}
                  disabled={vpnToggleLoading}
                  aria-label="Toggle VPN gate"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 sm:p-5 space-y-3">
                <AdminSectionTitle className="!mb-2">
                  Add exception
                </AdminSectionTitle>
                <p className="text-xs text-zinc-500 -mt-1 mb-2">
                  Allow a specific user through while VPN gate is on.
                </p>
                <AdminTextInput
                  label="User ID"
                  value={exceptionUserIdInput}
                  onChange={setExceptionUserIdInput}
                  placeholder="Discord user ID"
                  required
                />
                <AdminTextInput
                  label="Notes (optional)"
                  value={exceptionNotesInput}
                  onChange={setExceptionNotesInput}
                  placeholder="Optional note"
                />
                <Button
                  onClick={() => void handleAddException()}
                  disabled={addExceptionLoading || !exceptionUserIdInput}
                  size={btnSize}
                  variant="primary"
                  className="w-full sm:w-auto"
                >
                  {addExceptionLoading ? "Adding…" : "Add exception"}
                </Button>
              </div>

              <div>
                <AdminSectionTitle>
                  Exceptions ({vpnExceptions.length})
                </AdminSectionTitle>
                {vpnExceptions.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-8 text-center rounded-xl border border-dashed border-zinc-800">
                    No exceptions yet.
                  </p>
                ) : (
                  <div className={adminTableShellClass()}>
                    <div className="divide-y divide-zinc-800/80 max-h-80 overflow-y-auto">
                      {vpnExceptions.map((ex) => (
                        <div
                          key={ex.user_id}
                          className="flex justify-between items-start gap-3 p-3 hover:bg-zinc-800/20"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">
                              {ex.username}
                            </p>
                            <p className="text-xs text-zinc-500 font-mono">
                              {ex.user_id}
                            </p>
                            {ex.notes && (
                              <p className="text-xs text-zinc-400 mt-1">
                                {ex.notes}
                              </p>
                            )}
                            <p className="text-xs text-zinc-600 mt-1">
                              by {ex.added_by_username}
                            </p>
                          </div>
                          <Button
                            size={btnSize}
                            variant="outline"
                            onClick={() =>
                              void handleRemoveException(ex.user_id)
                            }
                            className="shrink-0"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
