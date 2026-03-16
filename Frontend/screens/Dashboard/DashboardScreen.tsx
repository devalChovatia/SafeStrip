import React, { useState, useEffect } from "react";
import {
	View,
	ScrollView,
	Text,
	StyleSheet,
	TextInput,
	Pressable,
	ActivityIndicator,
	Modal as RNModal,
	Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { DashboardHeader } from "./components/DashboardHeader";
import { StatusCard } from "./components/StatusCard";
import { OutletCard } from "./components/OutletCard";
import DeviceCard from "./components/DeviceCard";
import { Card } from "@/components/ui/card";
import { Button, ButtonText } from "@/components/ui/button";
import { fetchLatestWaterReading } from "@/services/api/sensorReadingsApi";
import {
	fetchDeviceOutletsForDevice,
	updateDeviceOutletActive,
} from "@/services/api/deviceOutletsApi";
import {
	Workspace,
	DeviceStrip,
	fetchWorkspaces,
	createWorkspace,
	fetchDevicesForWorkspace,
	createDevice,
	addWorkspaceMemberByEmail,
	fetchWorkspaceMembers,
	deleteWorkspace,
	type WorkspaceMemberWithProfile,
	type MemberRole,
} from "@/services/api/workspacesApi";
import { useAppSelector } from "@/store";

interface Outlet {
	id: number;
	dbId?: string;
	name: string;
	powerOn: boolean;
	temperature: number;
	current: number;
	smokeDetected: boolean;
	waterDetected: boolean;
}

type DashboardView = "devices" | "deviceDetail";
type RoomsTab = "my" | "shared";

interface DashboardScreenProps {
	onOpenSettings?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onOpenSettings }) => {
	const DEMO_DEVICE_ID = "b2c3bd18-1fd6-4a85-b7c5-20e830f86859";
	const insets = useSafeAreaInsets();
	const currentUserId = useAppSelector((s) => s.auth.user?.id);

	// Workspace + device state
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [devices, setDevices] = useState<DeviceStrip[]>([]);
	const [roomsTab, setRoomsTab] = useState<RoomsTab>("my");
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
	const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
	const [deviceModalWorkspaceId, setDeviceModalWorkspaceId] = useState<string | null>(null);
	const [memberModalWorkspaceId, setMemberModalWorkspaceId] = useState<string | null>(null);
	const [view, setView] = useState<DashboardView>("devices");

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Modals
	const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
	const [deviceModalOpen, setDeviceModalOpen] = useState(false);
	const [workspaceName, setWorkspaceName] = useState("");
	const [deviceName, setDeviceName] = useState("");
	const [memberModalOpen, setMemberModalOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<MemberRole>("MEMBER");
	const [workspaceMembers, setWorkspaceMembers] = useState<Record<string, WorkspaceMemberWithProfile[]>>({});

	// Mock outlet data (per-device dashboard)
	const [lastUpdate, setLastUpdate] = useState(new Date());
	const [outlets, setOutlets] = useState<Outlet[]>([
		{
			id: 1,
			name: "Outlet 1",
			powerOn: true,
			temperature: 24.5,
			current: 2.3,
			smokeDetected: false,
			waterDetected: false,
		},
		{
			id: 2,
			name: "Outlet 2",
			powerOn: true,
			temperature: 26.8,
			current: 4.1,
			smokeDetected: false,
			waterDetected: false,
		},
		{
			id: 3,
			name: "Outlet 3",
			powerOn: false,
			temperature: 23.2,
			current: 0,
			smokeDetected: false,
			waterDetected: false,
		},
		{
			id: 4,
			name: "Outlet 4",
			powerOn: true,
			temperature: 25.1,
			current: 1.8,
			smokeDetected: false,
			waterDetected: false,
		},
	]);

	// Simulate live sensor updates
	useEffect(() => {
		const interval = setInterval(() => {
			setOutlets((prev) =>
				prev.map((outlet) => ({
					...outlet,
					temperature: outlet.powerOn
						? Math.max(20, Math.min(45, outlet.temperature + (Math.random() - 0.5) * 0.3))
						: outlet.temperature,
					current: outlet.powerOn ? Math.max(0, Math.min(10, outlet.current + (Math.random() - 0.5) * 0.1)) : 0,
				})),
			);
			setLastUpdate(new Date());
		}, 3000);

		return () => clearInterval(interval);
	}, []);

	// Demo: poll water sensor for outlet 1 on the demo device
	useEffect(() => {
		// selectedDevice is declared later; guard using id only here
		if (view !== "deviceDetail" || selectedDeviceId !== DEMO_DEVICE_ID) {
			return;
		}

		let cancelled = false;

		const updateFromReading = async () => {
			try {
				const reading = await fetchLatestWaterReading(DEMO_DEVICE_ID);
				if (!reading || cancelled) return;

				const raw = reading.raw as { waterDetected?: boolean } | null | undefined;
				const waterDetected =
					raw && typeof raw.waterDetected === "boolean" ? raw.waterDetected : Number(reading.value) > 0;

				setOutlets((prev) =>
					prev.map((outlet) =>
						outlet.id === 1
							? {
									...outlet,
									waterDetected,
								}
							: outlet,
					),
				);
			} catch {
				// ignore polling errors in demo
			}
		};

		// initial fetch
		void updateFromReading();
		const interval = setInterval(updateFromReading, 1000);

		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [view, selectedDeviceId]);

	// For the demo device, load outlets from the device_outlets table
	useEffect(() => {
		if (view !== "deviceDetail" || selectedDeviceId !== DEMO_DEVICE_ID) {
			return;
		}

		let cancelled = false;

		const loadOutlets = async () => {
			try {
				const apiOutlets = await fetchDeviceOutletsForDevice(DEMO_DEVICE_ID);
				if (cancelled) return;

				setOutlets((prev) => {
					// Preserve existing sensor readings where possible but replace power + labels
					return apiOutlets.map((o, index) => {
						const existing = prev[index];
						return {
							id: index + 1,
							dbId: o.id,
							name: o.outlet_name,
							powerOn: o.is_active,
							temperature: existing?.temperature ?? 24,
							current: existing?.current ?? 0,
							smokeDetected: existing?.smokeDetected ?? false,
							waterDetected: existing?.waterDetected ?? false,
						};
					});
				});
			} catch {
				// swallow errors for demo
			}
		};

		void loadOutlets();

		return () => {
			cancelled = true;
		};
	}, [view, selectedDeviceId]);

	// Load rooms (workspaces) and all their devices for the current user
	useEffect(() => {
		if (!currentUserId) return;

		const run = async () => {
			try {
				setLoading(true);

				// 1) Load all rooms owned by this user
				const ws = await fetchWorkspaces(currentUserId);
				setWorkspaces(ws);

				if (ws.length === 0) {
					setSelectedWorkspaceId(null);
					setDevices([]);
					return;
				}

				// 2) For each room, load its devices
				const deviceLists = await Promise.all(ws.map((w) => fetchDevicesForWorkspace(w.id)));
				const allDevices = deviceLists.flat();
				setDevices(allDevices);

				// 3) Default selection = first room
				setSelectedWorkspaceId(ws[0].id);
			} catch (e) {
				setError("Failed to load workspaces");
			} finally {
				setLoading(false);
			}
		};

		void run();
	}, [currentUserId]);

	// Fetch members for each workspace
	useEffect(() => {
		if (workspaces.length === 0) return;
		Promise.all(
			workspaces.map(async (ws) => {
				const members = await fetchWorkspaceMembers(ws.id);
				return { id: ws.id, members };
			}),
		).then((results) => {
			const map: Record<string, WorkspaceMemberWithProfile[]> = {};
			results.forEach((r) => (map[r.id] = r.members));
			setWorkspaceMembers(map);
		});
	}, [workspaces]);

	const selectedWorkspace = selectedWorkspaceId ? workspaces.find((w) => w.id === selectedWorkspaceId) ?? null : null;

	const devicesForWorkspace = selectedWorkspace ? devices.filter((d) => d.workspace_id === selectedWorkspace.id) : [];

	const selectedDevice = selectedDeviceId ? devices.find((d) => d.id === selectedDeviceId) ?? null : null;

	const deviceModalWorkspace = deviceModalWorkspaceId
		? workspaces.find((w) => w.id === deviceModalWorkspaceId) ?? null
		: null;
	const memberModalWorkspace = memberModalWorkspaceId
		? workspaces.find((w) => w.id === memberModalWorkspaceId) ?? null
		: null;

	const getMyRoleInWorkspace = (workspaceId: string): string | null => {
		const members = workspaceMembers[workspaceId] ?? [];
		const me = members.find((m) => m.user_id === currentUserId);
		if (me) return me.role;
		const ws = workspaces.find((w) => w.id === workspaceId);
		if (ws?.created_by === currentUserId) return "OWNER";
		return null;
	};

	const canManageMembers = (role: string | null) => role === "OWNER" || role === "ADMIN";
	const canManageDevices = (role: string | null) => role === "OWNER" || role === "ADMIN";
	const canDeleteWorkspace = (role: string | null) => role === "OWNER";
	const canControlPower = (role: string | null) => role !== "VIEWER" && role !== null;

	const myRooms = workspaces.filter((ws) => {
		const myRole = getMyRoleInWorkspace(ws.id);
		return ws.created_by === currentUserId || myRole === "OWNER";
	});
	const sharedRooms = workspaces.filter((ws) => {
		const myRole = getMyRoleInWorkspace(ws.id);
		return (ws.created_by ?? null) !== currentUserId && myRole !== null;
	});
	const visibleRooms = roomsTab === "my" ? myRooms : sharedRooms;

	const handleDeleteWorkspace = (ws: Workspace) => {
		Alert.alert("Delete room?", `This will remove "${ws.name}" and all its devices. This cannot be undone.`, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					try {
						setLoading(true);
						await deleteWorkspace(ws.id);
						setWorkspaces((prev) => prev.filter((w) => w.id !== ws.id));
						setDevices((prev) => prev.filter((d) => d.workspace_id !== ws.id));
						if (selectedWorkspaceId === ws.id) {
							const remaining = workspaces.filter((w) => w.id !== ws.id);
							setSelectedWorkspaceId(remaining[0]?.id ?? null);
						}
					} catch (e) {
						setError("Failed to delete room");
					} finally {
						setLoading(false);
					}
				},
			},
		]);
	};

	// Device/status helpers (per-device dashboard)
	const getSystemStatus = () => {
		const activeOutlets = outlets.filter((o) => o.powerOn);

		if (activeOutlets.length === 0) {
			return {
				status: "All Power Off",
				variant: "neutral" as const,
			};
		}

		const hasRisk = activeOutlets.some((o) => o.waterDetected || o.smokeDetected);
		if (hasRisk) {
			return {
				status: "⚠️ Risk Detected",
				variant: "danger" as const,
			};
		}

		const hasWarning = activeOutlets.some((o) => o.temperature > 40 || o.current > 8);
		if (hasWarning) {
			return {
				status: "⚠️ Warning",
				variant: "warning" as const,
			};
		}

		return {
			status: "All Systems Safe",
			variant: "safe" as const,
		};
	};

	const handlePowerToggle = async (outletId: number) => {
		// Find outlet in state
		setOutlets((prev) => prev);

		const target = outlets.find((o) => o.id === outletId);
		if (!target) return;

		// For the demo device, sync with backend using the outlet's DB id
		if (selectedDeviceId === DEMO_DEVICE_ID && target.dbId) {
			const nextPower = !target.powerOn;
			try {
				await updateDeviceOutletActive(target.dbId, nextPower);
				setOutlets((prev) =>
					prev.map((outlet) =>
						outlet.id === outletId ? { ...outlet, powerOn: nextPower } : outlet,
					),
				);
				return;
			} catch {
				// fall through to local-only toggle if API fails
			}
		}

		// Fallback: local-only toggle
		setOutlets((prev) =>
			prev.map((outlet) =>
				outlet.id === outletId ? { ...outlet, powerOn: !outlet.powerOn } : outlet,
			),
		);
	};

	const getTimeSinceUpdate = () => {
		const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
		return `Updated ${seconds} seconds ago`;
	};

	const systemStatus = getSystemStatus();

	// Workspace + device creation
	const handleCreateWorkspace = async () => {
		if (!workspaceName.trim()) return;
		if (!currentUserId) {
			setError("Cannot create workspace: no user id");
			return;
		}
		try {
			setLoading(true);
			const created = await createWorkspace({
				name: workspaceName.trim(),
				created_by: currentUserId,
			});
			setWorkspaces((prev) => [created, ...prev]);
			setSelectedWorkspaceId(created.id);
			setWorkspaceModalOpen(false);
			setWorkspaceName("");
		} catch (e) {
			setError("Failed to create workspace");
		} finally {
			setLoading(false);
		}
	};

	const handleCreateDevice = async () => {
		if (!deviceModalWorkspace) return;
		if (!deviceName.trim()) return;
		try {
			setLoading(true);
			const created = await createDevice({
				workspace_id: deviceModalWorkspace.id,
				device_name: deviceName.trim(),
			});
			setDevices((prev) => [created, ...prev]);
			setDeviceModalOpen(false);
			setDeviceName("");
		} catch (e) {
			setError("Failed to create device");
		} finally {
			setLoading(false);
		}
	};

	const handleInviteMember = async () => {
		if (!memberModalWorkspace) return;
		if (!inviteEmail.trim()) return;
		try {
			setLoading(true);
			await addWorkspaceMemberByEmail(memberModalWorkspace.id, inviteEmail.trim(), inviteRole);
			const members = await fetchWorkspaceMembers(memberModalWorkspace.id);
			setWorkspaceMembers((prev) => ({ ...prev, [memberModalWorkspace.id]: members }));
			setMemberModalOpen(false);
			setInviteEmail("");
			setInviteRole("MEMBER");
		} catch (e) {
			setError("Failed to add member to workspace");
		} finally {
			setLoading(false);
		}
	};

	const openDeviceDetail = (deviceId: string) => {
		setSelectedDeviceId(deviceId);
		const dev = devices.find((d) => d.id === deviceId);
		if (dev) {
			setSelectedWorkspaceId(dev.workspace_id);
		}
		setView("deviceDetail");
	};

	const renderDeviceDetail = () => {
		if (!selectedDevice) {
			return (
				<View style={styles.emptyWrap}>
					<Text style={styles.emptyTitle}>Device not found</Text>
					<Button onPress={() => setView("devices")}>
						<ButtonText>Back to devices</ButtonText>
					</Button>
				</View>
			);
		}

		return (
			<>
				<View className="px-4 pt-3 pb-2 bg-slate-50 border-b border-slate-200">
					<Pressable
						onPress={() => setView("devices")}
						className="self-start flex-row items-center rounded-full bg-slate-100 px-3 py-1.5 border border-slate-200 active:bg-slate-200"
						hitSlop={8}
					>
						<Ionicons name="chevron-back" size={16} color="#0f172a" />
						<Text className="text-slate-700 text-xs font-semibold ml-1.5 uppercase tracking-wide">Back to devices</Text>
					</Pressable>
					<Text className="text-slate-900 text-lg font-semibold mt-3">{selectedDevice.device_name}</Text>
				</View>

				<ScrollView
					style={styles.scroll}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: 24 }}
				>
					<View style={styles.content}>
						<StatusCard
							status={systemStatus.status}
							variant={systemStatus.variant}
							activeCount={outlets.filter((o) => o.powerOn).length}
							totalCount={outlets.length}
						/>

						<View style={styles.outletsWrap}>
							<Text style={styles.sectionTitle}>Power Outlets</Text>
							{outlets.map((outlet) => (
								<OutletCard
									key={outlet.id}
									outlet={outlet}
									onPowerToggle={() => handlePowerToggle(outlet.id)}
									powerDisabled={!canControlPower(getMyRoleInWorkspace(selectedDevice.workspace_id))}
								/>
							))}
						</View>
					</View>
				</ScrollView>

				<View style={styles.footer}>
					<Text style={styles.footerText}>{getTimeSinceUpdate()}</Text>
				</View>
			</>
		);
	};

	const renderDevicesList = () => {
		if (workspaces.length === 0) {
			return (
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
					showsVerticalScrollIndicator={false}
				>
					<View className="bg-white rounded-2xl border border-dashed border-slate-300 p-5">
						<Text className="text-slate-900 text-base font-semibold mb-2">Create your first room</Text>
						<Text className="text-slate-500 text-sm mb-4">
							Group your SafeStrip devices by room, like “Kitchen” or “Bedroom”.
						</Text>
						<Button onPress={() => setWorkspaceModalOpen(true)}>
							<ButtonText>Create room</ButtonText>
						</Button>
					</View>
				</ScrollView>
			);
		}

		return (
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
				showsVerticalScrollIndicator={false}
			>
				<View className="mb-4 flex-row items-center justify-between">
					<Text className="text-slate-900 text-lg font-semibold">Rooms</Text>
					<Button size="sm" onPress={() => setWorkspaceModalOpen(true)}>
						<ButtonText>New room</ButtonText>
					</Button>
				</View>

				{/* Tabs */}
				<View className="flex-row rounded-xl bg-slate-200 p-1 mb-4">
					<Pressable
						onPress={() => setRoomsTab("my")}
						className={`flex-1 rounded-lg px-3 py-2 ${roomsTab === "my" ? "bg-white" : "bg-transparent"}`}
					>
						<Text
							className={`text-center text-sm font-semibold ${roomsTab === "my" ? "text-slate-900" : "text-slate-600"}`}
						>
							My rooms
						</Text>
					</Pressable>
					<Pressable
						onPress={() => setRoomsTab("shared")}
						className={`flex-1 rounded-lg px-3 py-2 ${roomsTab === "shared" ? "bg-white" : "bg-transparent"}`}
					>
						<Text
							className={`text-center text-sm font-semibold ${
								roomsTab === "shared" ? "text-slate-900" : "text-slate-600"
							}`}
						>
							Shared
						</Text>
					</Pressable>
				</View>

				{visibleRooms.length === 0 ? (
					<View className="bg-white rounded-2xl border border-dashed border-slate-300 p-5">
						<Text className="text-slate-900 text-base font-semibold mb-2">
							{roomsTab === "my" ? "No rooms yet" : "No shared rooms yet"}
						</Text>
						<Text className="text-slate-500 text-sm">
							{roomsTab === "my"
								? "Create a room to start organizing your SafeStrip devices."
								: "When someone shares a room with you, it will show up here."}
						</Text>
					</View>
				) : null}

				{visibleRooms.map((ws) => {
					const wsDevices = devices.filter((d) => d.workspace_id === ws.id);
					const myRole = getMyRoleInWorkspace(ws.id);
					const showShare = canManageMembers(myRole);
					const showAddDevice = canManageDevices(myRole);
					return (
						<Card key={ws.id} className="mb-4 p-4">
							<View className="flex-row items-center justify-between mb-2">
								<View className="flex-1 pr-2">
									<Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Room</Text>
									<Text className="text-slate-900 text-lg font-semibold mt-0.5">{ws.name}</Text>
								</View>
								<View className="flex-row gap-2">
									{showShare && (
										<Button
											size="sm"
											variant="outline"
											onPress={() => {
												setMemberModalWorkspaceId(ws.id);
												setInviteRole("MEMBER");
												setMemberModalOpen(true);
											}}
										>
											<ButtonText>Share</ButtonText>
										</Button>
									)}
									{showAddDevice && (
										<Button
											size="sm"
											onPress={() => {
												setDeviceModalWorkspaceId(ws.id);
												setDeviceModalOpen(true);
											}}
										>
											<ButtonText>Add device</ButtonText>
										</Button>
									)}
									{canDeleteWorkspace(myRole) && (
										<Pressable
											onPress={() => handleDeleteWorkspace(ws)}
											className="py-2 px-3 rounded-lg active:bg-red-50"
										>
											<Ionicons name="trash-outline" size={18} color="#dc2626" />
										</Pressable>
									)}
								</View>
							</View>

							{(() => {
								const members = workspaceMembers[ws.id] ?? [];
								if (myRole === "OWNER") {
									const others = members.filter((m) => m.user_id !== currentUserId);
									if (others.length === 0) return null;
									const names = others.map((m) => m.display_name?.trim() || "Member").join(", ");
									return (
										<View className="flex-row items-center gap-1.5 mt-1.5">
											<Ionicons name="people-outline" size={14} color="#64748b" />
											<Text className="text-slate-500 text-xs" numberOfLines={1}>
												Shared with {names}
											</Text>
										</View>
									);
								}

								const owner =
									members.find((m) => m.role === "OWNER") ??
									(ws.created_by === currentUserId
										? null
										: { user_id: ws.created_by ?? "", role: "OWNER", display_name: undefined });
								if (!owner) return null;
								const ownerName = owner.display_name?.trim() || "Owner";

								return (
									<View className="flex-row items-center gap-1.5 mt-1.5">
										<Ionicons name="person-circle-outline" size={14} color="#64748b" />
										<Text className="text-slate-500 text-xs" numberOfLines={1}>
											Owner: {ownerName}
										</Text>
									</View>
								);
							})()}

							{wsDevices.length === 0 ? (
								<View className="mt-2 rounded-xl border border-dashed border-slate-300 px-3 py-3">
									<Text className="text-slate-600 text-sm mb-2">No devices in this workspace yet.</Text>
									{showAddDevice && (
										<Button
											size="sm"
											onPress={() => {
												setDeviceModalWorkspaceId(ws.id);
												setDeviceModalOpen(true);
											}}
										>
											<ButtonText>Add first device</ButtonText>
										</Button>
									)}
								</View>
							) : (
								<View className="mt-2">
									{wsDevices.map((d) => (
										<DeviceCard
											key={d.id}
											name={d.device_name}
											workspaceName={ws.name}
											status={d.status}
											lastSeenAt={d.last_seen_at ?? undefined}
											onOpen={() => openDeviceDetail(d.id)}
										/>
									))}
								</View>
							)}
						</Card>
					);
				})}
			</ScrollView>
		);
	};

	return (
		<View style={styles.statusBarWrapper}>
			<View style={[styles.root, { paddingTop: insets.top }]}>
				<DashboardHeader onSettingsPress={onOpenSettings} />

				{view === "deviceDetail" ? renderDeviceDetail() : renderDevicesList()}

				{loading && (
					<View className="absolute inset-0 items-center justify-center bg-black/10">
						<ActivityIndicator size="small" color="#0f172a" />
					</View>
				)}

				{/* Workspace modal (React Native Modal) */}
				<RNModal
					visible={workspaceModalOpen}
					transparent
					animationType="fade"
					onRequestClose={() => setWorkspaceModalOpen(false)}
				>
					<View className="flex-1 bg-black/40 items-center justify-center px-6">
						<View className="w-full rounded-2xl bg-white border border-slate-200 p-5">
							<View className="flex-row items-center justify-between mb-4">
								<Text className="text-slate-900 text-base font-semibold">New room</Text>
								<Pressable onPress={() => setWorkspaceModalOpen(false)} hitSlop={8} className="p-1">
									<Ionicons name="close" size={20} color="#64748b" />
								</Pressable>
							</View>

							<Text className="text-slate-700 text-sm mb-2">Room name</Text>
							<View className="border border-slate-300 rounded-lg px-3 py-2 bg-white">
								<TextInput
									placeholder="e.g. Kitchen"
									placeholderTextColor="#9ca3af"
									value={workspaceName}
									onChangeText={setWorkspaceName}
									className="text-slate-900 text-base"
								/>
							</View>

							<View className="flex-row justify-end gap-2 mt-5">
								<Button variant="outline" action="primary" size="sm" onPress={() => setWorkspaceModalOpen(false)}>
									<ButtonText>Cancel</ButtonText>
								</Button>
								<Button size="sm" onPress={handleCreateWorkspace}>
									<ButtonText>Create</ButtonText>
								</Button>
							</View>
						</View>
					</View>
				</RNModal>

				{/* Device modal (React Native Modal) */}
				<RNModal
					visible={deviceModalOpen}
					transparent
					animationType="fade"
					onRequestClose={() => setDeviceModalOpen(false)}
				>
					<View className="flex-1 bg-black/40 items-center justify-center px-6">
						<View className="w-full rounded-2xl bg-white border border-slate-200 p-5">
							<View className="flex-row items-center justify-between mb-4">
								<Text className="text-slate-900 text-base font-semibold">New device</Text>
								<Pressable onPress={() => setDeviceModalOpen(false)} hitSlop={8} className="p-1">
									<Ionicons name="close" size={20} color="#64748b" />
								</Pressable>
							</View>

							<Text className="text-slate-500 text-xs mb-1">Room</Text>
							<Text className="text-slate-900 text-sm font-semibold mb-3">
								{deviceModalWorkspace?.name ?? "None selected"}
							</Text>

							<Text className="text-slate-700 text-sm mb-2">Device name</Text>
							<View className="border border-slate-300 rounded-lg px-3 py-2 bg-white mb-3">
								<TextInput
									placeholder="e.g. Beside table strip"
									placeholderTextColor="#9ca3af"
									value={deviceName}
									onChangeText={setDeviceName}
									className="text-slate-900 text-base"
								/>
							</View>

							<View className="flex-row justify-end gap-2 mt-5">
								<Button variant="outline" action="primary" size="sm" onPress={() => setDeviceModalOpen(false)}>
									<ButtonText>Cancel</ButtonText>
								</Button>
								<Button size="sm" onPress={handleCreateDevice} disabled={!deviceModalWorkspace}>
									<ButtonText>Create</ButtonText>
								</Button>
							</View>
						</View>
					</View>
				</RNModal>

				{/* Share workspace (invite member) modal */}
				<RNModal
					visible={memberModalOpen}
					transparent
					animationType="fade"
					onRequestClose={() => setMemberModalOpen(false)}
				>
					<View className="flex-1 bg-black/40 items-center justify-center px-6">
						<View className="w-full rounded-2xl bg-white border border-slate-200 p-5">
							<View className="flex-row items-center justify-between mb-4">
								<Text className="text-slate-900 text-base font-semibold">Share room</Text>
								<Pressable onPress={() => setMemberModalOpen(false)} hitSlop={8} className="p-1">
									<Ionicons name="close" size={20} color="#64748b" />
								</Pressable>
							</View>

							<Text className="text-slate-500 text-xs mb-1">Room</Text>
							<Text className="text-slate-900 text-sm font-semibold mb-3">
								{memberModalWorkspace?.name ?? "None selected"}
							</Text>

							<Text className="text-slate-700 text-sm mb-2">Member email</Text>
							<View className="border border-slate-300 rounded-lg px-3 py-2 bg-white mb-3">
								<TextInput
									placeholder="user@example.com"
									placeholderTextColor="#9ca3af"
									value={inviteEmail}
									onChangeText={setInviteEmail}
									autoCapitalize="none"
									keyboardType="email-address"
									className="text-slate-900 text-base"
								/>
							</View>

							<Text className="text-slate-700 text-sm mb-2">Role</Text>
							<View className="flex-row flex-wrap gap-2 mb-5">
								{(["ADMIN", "MEMBER", "VIEWER"] as const).map((role) => (
									<Pressable
										key={role}
										onPress={() => setInviteRole(role)}
										className={`rounded-lg border px-3 py-2 ${
											inviteRole === role ? "border-[#2563eb] bg-[#2563eb]/10" : "border-slate-300 bg-white"
										}`}
									>
										<Text
											className={`text-sm font-medium ${inviteRole === role ? "text-[#2563eb]" : "text-slate-600"}`}
										>
											{role}
										</Text>
									</Pressable>
								))}
							</View>

							<View className="flex-row justify-end gap-2 mt-5">
								<Button variant="outline" action="primary" size="sm" onPress={() => setMemberModalOpen(false)}>
									<ButtonText>Cancel</ButtonText>
								</Button>
								<Button size="sm" onPress={handleInviteMember}>
									<ButtonText>Share</ButtonText>
								</Button>
							</View>
						</View>
					</View>
				</RNModal>

				{error && (
					<View className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
						<Text className="text-xs text-red-700">{error}</Text>
					</View>
				)}
			</View>
		</View>
	);
};

export default DashboardScreen;

const styles = StyleSheet.create({
	statusBarWrapper: {
		flex: 1,
		backgroundColor: "#0f172a",
	},
	root: {
		flex: 1,
		backgroundColor: "transparent",
	},
	scroll: {
		flex: 1,
		backgroundColor: "#f8fafc",
	},
	content: {
		paddingHorizontal: 16,
		paddingTop: 16,
		gap: 16,
	},
	outletsWrap: {
		gap: 12,
	},
	sectionTitle: {
		paddingHorizontal: 2,
		fontSize: 14,
		fontWeight: "700",
		color: "#334155",
	},
	footer: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderTopWidth: 1,
		borderTopColor: "#e2e8f0",
		backgroundColor: "#ffffff",
	},
	footerText: {
		textAlign: "center",
		color: "#64748b",
		fontSize: 12,
		fontWeight: "500",
	},
	emptyWrap: {
		flex: 1,
		padding: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#0f172a",
		marginBottom: 8,
	},
});
