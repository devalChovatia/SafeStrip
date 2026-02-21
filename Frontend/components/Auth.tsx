import React, { useState } from "react";
import {
	View,
	Text,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert, AlertText } from "@/components/ui/alert";
import {
	FormControl,
	FormControlLabel,
	FormControlLabelText,
} from "@/components/ui/form-control";
import { Input, InputField, InputSlot, InputIcon } from "@/components/ui/input";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icon";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Link, LinkText } from "@/components/ui/link";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

function Logo() {
	return (
		<View className="mb-6 h-14 w-14 items-center justify-center rounded-xl bg-[#2563eb]">
			<Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
				<Path
					d="M13 2L4 14h6l-3 8 10-12h-6l3-8z"
					fill="white"
					stroke="white"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</Svg>
		</View>
	);
}

export default function Auth() {
	const insets = useSafeAreaInsets();
	const [mode, setMode] = useState<Mode>("signup");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isSignUp = mode === "signup";

	function clearError() {
		setError(null);
	}

	async function signInWithEmail() {
		if (!email.trim() || !password) {
			setError("Please enter email and password.");
			return;
		}
		setError(null);
		setLoading(true);
		const { error: err } = await supabase.auth.signInWithPassword({
			email: email.trim(),
			password,
		});
		if (err) setError(err.message);
		setLoading(false);
	}

	async function signUpWithEmail() {
		if (!email.trim() || !password) {
			setError("Please enter email and password.");
			return;
		}
		if (password.length < 6) {
			setError("Password must be at least 6 characters.");
			return;
		}
		if (password !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}
		setError(null);
		setLoading(true);
		const {
			data: { session },
			error: err,
		} = await supabase.auth.signUp({
			email: email.trim(),
			password,
		});
		if (err) setError(err.message);
		setLoading(false);
	}

	function handleSubmit() {
		if (isSignUp) signUpWithEmail();
		else signInWithEmail();
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-[#f5f5f5]"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<ScrollView
				contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<View className="flex-grow items-center justify-center px-6 py-8">
					<View className="w-full max-w-[340px]">
						<Logo />
						<Text className="text-[28px] font-bold text-[#374151]">SafeStrip</Text>
						<Text className="mt-1 text-[15px] text-[#6b7280]">
							{isSignUp ? "Create Your Account" : "Smart Power Safety Control"}
						</Text>

						{error && (
							<Alert action="error" className="mt-6" onTouchEnd={clearError}>
								<AlertText>{error}</AlertText>
							</Alert>
						)}

						{/* Form */}
						<View className="mt-8">
							<FormControl className="mb-5">
								<FormControlLabel>
									<FormControlLabelText className="text-[14px] font-medium text-[#374151]">
										Email Address
									</FormControlLabelText>
								</FormControlLabel>
								<Input
									variant="outline"
									size="md"
									className="mt-2 rounded-lg border-[#d1d5db] bg-white"
								>
									<InputField
										className="text-[#111827]"
										value={email}
										onChangeText={setEmail}
										placeholder="you@example.com"
										placeholderTextColor="#9ca3af"
										autoCapitalize="none"
										autoComplete="email"
										keyboardType="email-address"
										editable={!loading}
									/>
								</Input>
							</FormControl>

							<FormControl className="mb-5">
								<FormControlLabel>
									<FormControlLabelText className="text-[14px] font-medium text-[#374151]">
										Password
									</FormControlLabelText>
								</FormControlLabel>
								<Input
									variant="outline"
									size="md"
									className="mt-2 rounded-lg border-[#d1d5db] bg-white"
								>
									<InputField
										className="text-[#111827]"
										value={password}
										onChangeText={setPassword}
										placeholder="••••••••"
										placeholderTextColor="#9ca3af"
										autoCapitalize="none"
										autoComplete={isSignUp ? "new-password" : "password"}
										secureTextEntry={!showPassword}
										editable={!loading}
									/>
									<InputSlot onPress={() => setShowPassword((p) => !p)} className="pr-3">
										<InputIcon className="text-[#6b7280]">
											{showPassword ? <EyeOffIcon /> : <EyeIcon />}
										</InputIcon>
									</InputSlot>
								</Input>
							</FormControl>

							{isSignUp && (
								<FormControl className="mb-5">
									<FormControlLabel>
										<FormControlLabelText className="text-[14px] font-medium text-[#374151]">
											Confirm Password
										</FormControlLabelText>
									</FormControlLabel>
									<Input
										variant="outline"
										size="md"
										className="mt-2 rounded-lg border-[#d1d5db] bg-white"
									>
										<InputField
											className="text-[#111827]"
											value={confirmPassword}
											onChangeText={setConfirmPassword}
											placeholder="••••••••"
											placeholderTextColor="#9ca3af"
											autoCapitalize="none"
											autoComplete="new-password"
											secureTextEntry={!showConfirmPassword}
											editable={!loading}
										/>
										<InputSlot onPress={() => setShowConfirmPassword((p) => !p)} className="pr-3">
											<InputIcon className="text-[#6b7280]">
												{showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
											</InputIcon>
										</InputSlot>
									</Input>
								</FormControl>
							)}

							<Button
								action="primary"
								variant="solid"
								size="xl"
								onPress={handleSubmit}
								isDisabled={loading}
								className="min-h-[52px] rounded-lg bg-[#2563eb]"
							>
								{loading ? (
									<ButtonSpinner />
								) : (
									<ButtonText>{isSignUp ? "Create Account" : "Sign In"}</ButtonText>
								)}
							</Button>
						</View>

						{/* Footer link */}
						<View className="mt-8 flex-row flex-wrap items-center justify-center gap-1">
							<Text className="text-[15px] text-[#555d6b]">
								{isSignUp ? "Already have an account? " : "Don't have an account? "}
							</Text>
							<Link
								onPress={() => {
									setError(null);
									setMode(isSignUp ? "signin" : "signup");
								}}
								disabled={loading}
								className="flex-shrink-0"
							>
								<LinkText size="md" className="font-semibold text-[#2563eb]">
									{isSignUp ? "Sign in" : "Create an account"}
								</LinkText>
							</Link>
						</View>
					</View>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}
