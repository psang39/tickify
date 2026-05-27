import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { loginStaff } from '../api/scannerApi';
import { useScannerStore } from '../stores/useScannerStore';
import { API_BASE_URL } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
    const setAuth = useScannerStore((state) => state.setAuth);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            setError('Vui lòng nhập email và mật khẩu staff.');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            const data = await loginStaff(email.trim(), password);
            const role = data.user?.role?.toLowerCase();
            if (role !== 'staff') {
                setError('Tài khoản này không phải staff soát vé.');
                return;
            }

            setAuth(data.sessionCookie, data.user);
            navigation.replace('Shows');
        } catch (err: any) {
            setError(err.message || 'Đăng nhập thất bại.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.card}>
                    <Text style={styles.logo}>Tickify Scanner</Text>
                    <Text style={styles.subtitle}>Đăng nhập bằng tài khoản nhân viên được organizer phân công.</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Email staff"
                        value={email}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        onChangeText={setEmail}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Mật khẩu"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    {!!error && <Text style={styles.errorText}>{error}</Text>}

                    <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đăng nhập</Text>}
                    </TouchableOpacity>

                    <Text style={styles.hint}>API: {API_BASE_URL}</Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f6f7fb' },
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    card: { backgroundColor: '#fff', padding: 22, borderRadius: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
    logo: { fontSize: 30, fontWeight: '800', color: '#262880', textAlign: 'center' },
    subtitle: { marginTop: 10, marginBottom: 24, color: '#667085', textAlign: 'center', lineHeight: 20 },
    input: { backgroundColor: '#f9fafb', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
    button: { backgroundColor: '#262880', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    errorText: { color: '#b42318', marginBottom: 8, lineHeight: 18 },
    hint: { color: '#98a2b3', fontSize: 12, textAlign: 'center', marginTop: 14 },
});
