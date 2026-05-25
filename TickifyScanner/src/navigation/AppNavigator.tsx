import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import ShowsScreen from '../screens/ShowsScreen';
import ScannerScreen from '../screens/ScannerScreen';
import SyncScreen from '../screens/SyncScreen';
import { AssignedShow } from '../types/scanner';

export type RootStackParamList = {
    Login: undefined;
    Shows: undefined;
    Scanner: { show: AssignedShow };
    Sync: { showId?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Login" screenOptions={{ headerTitleAlign: 'center' }}>
                <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Shows" component={ShowsScreen} options={{ title: 'Show được phân công', headerBackVisible: false }} />
                <Stack.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Soát vé' }} />
                <Stack.Screen name="Sync" component={SyncScreen} options={{ title: 'Đồng bộ vé offline' }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
