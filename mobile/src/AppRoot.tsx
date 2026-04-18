import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { gameActions, useGameStore } from './gameStore';
import { SplashScreen } from './screens/SplashScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { HomeScreen } from './screens/HomeScreen';
import { CreateRoomScreen } from './screens/CreateRoomScreen';
import { JoinRoomScreen } from './screens/JoinRoomScreen';
import { RoomScreen } from './screens/RoomScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultScreen } from './screens/ResultScreen';
import { RoleRevealScreen } from './screens/RoleRevealScreen';
import { GuessPickerScreen } from './screens/GuessPickerScreen';
import { RoundResultScreen } from './screens/RoundResultScreen';
import { ScoreboardScreen } from './screens/ScoreboardScreen';
import { ProfileSettingsScreen } from './screens/ProfileSettingsScreen';
import { CategoryPacksScreen } from './screens/CategoryPacksScreen';
import { ReportScreen } from './screens/ReportScreen';
import { audioService } from './audio/audioService';
import { voiceService } from './audio/voiceService';

type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Home: undefined;
  CreateRoom: undefined;
  JoinRoom: undefined;
  Room: undefined;
  RoleReveal: undefined;
  Game: undefined;
  GuessPicker: undefined;
  RoundResult: undefined;
  Result: undefined;
  Scoreboard: undefined;
  ProfileSettings: undefined;
  CategoryPacks: undefined;
  Report: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navRef = createNavigationContainerRef<RootStackParamList>();

export function AppRoot() {
  const roundResult = useGameStore((s) => s.roundResult);
  const game = useGameStore((s) => s.gameState);

  useEffect(() => {
    const buildId = (process.env.EXPO_PUBLIC_BUILD_ID as string | undefined) ?? 'dev';
    console.log('[APP_BOOT]', { buildId, serverEnv: process.env.EXPO_PUBLIC_SERVER_URL });
    void gameActions.connectSocket().catch(() => null);
    void audioService.init().catch(() => null);
    void voiceService.init().catch(() => null);
  }, []);

  const syncMusicToRoute = () => {
    if (!navRef.isReady()) return;
    const current = navRef.getCurrentRoute()?.name ?? null;
    const r = String(current ?? '');
    if (!r) return;
    const map =
      r === 'Home' || r === 'Welcome' || r === 'CreateRoom' || r === 'JoinRoom'
        ? ('home' as const)
        : r === 'Room' || r === 'RoleReveal'
          ? ('lobby' as const)
          : r === 'Game' || r === 'GuessPicker'
            ? ('game' as const)
            : r === 'RoundResult' || r === 'Scoreboard' || r === 'Result'
              ? ('result' as const)
              : null;
    if (map) void audioService.playMusic(map).catch(() => null);
  };

  useEffect(() => {
    if (!navRef.isReady()) return;
    const current = navRef.getCurrentRoute()?.name;
    if (roundResult && current !== 'RoundResult') {
      navRef.navigate('RoundResult');
    }
  }, [roundResult]);

  useEffect(() => {
    if (!navRef.isReady()) return;
    const current = navRef.getCurrentRoute()?.name;
    if (game?.flow === 'ended' && current !== 'Scoreboard') {
      navRef.navigate('Scoreboard');
    }
  }, [game?.flow]);

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer
        ref={navRef}
        onReady={() => syncMusicToRoute()}
        onStateChange={() => syncMusicToRoute()}
      >
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false, animation: 'fade' }}
        >
          <Stack.Screen
            name="Splash"
            children={({ navigation }) => (
              <SplashScreen
                onDone={() => {
                  navigation.replace('Welcome');
                }}
              />
            )}
          />
          <Stack.Screen
            name="Welcome"
            children={({ navigation }) => (
              <WelcomeScreen onPlay={() => navigation.replace('Home')} onLogin={() => navigation.navigate('ProfileSettings')} />
            )}
          />
          <Stack.Screen
            name="Home"
            children={({ navigation }) => (
              <HomeScreen
                onGoCreate={() => navigation.navigate('CreateRoom')}
                onGoJoin={() => navigation.navigate('JoinRoom')}
                onGoProfile={() => navigation.navigate('ProfileSettings')}
                onGoScoreboard={() => navigation.navigate('Scoreboard')}
                onGoRoom={() => navigation.replace('Room')}
              />
            )}
          />
          <Stack.Screen
            name="CreateRoom"
            children={({ navigation }) => (
              <CreateRoomScreen
                onBack={() => navigation.goBack()}
                onCreated={() => navigation.replace('Room')}
              />
            )}
          />
          <Stack.Screen
            name="JoinRoom"
            children={({ navigation }) => (
              <JoinRoomScreen
                onBack={() => navigation.goBack()}
                onJoined={() => navigation.replace('Room')}
              />
            )}
          />
          <Stack.Screen
            name="Room"
            children={({ navigation }) => (
              <RoomScreen
                onBackToHome={() => navigation.replace('Home')}
                onGoGame={() => navigation.replace('RoleReveal')}
              />
            )}
          />
          <Stack.Screen
            name="RoleReveal"
            children={({ navigation }) => (
              <RoleRevealScreen onContinue={() => navigation.replace('Game')} />
            )}
          />
          <Stack.Screen
            name="Game"
            children={({ navigation }) => (
              <GameScreen
                onGoResult={() => navigation.replace('Scoreboard')}
                onOpenGuessPicker={() => navigation.navigate('GuessPicker')}
                onGoHome={() => navigation.replace('Home')}
                onGoProfile={() => navigation.navigate('ProfileSettings')}
                onGoScoreboard={() => navigation.navigate('Scoreboard')}
              />
            )}
          />
          <Stack.Screen
            name="GuessPicker"
            children={({ navigation }) => (
              <GuessPickerScreen onClose={() => navigation.goBack()} />
            )}
          />
          <Stack.Screen
            name="RoundResult"
            children={({ navigation }) => (
              <RoundResultScreen onClose={() => navigation.goBack()} />
            )}
          />
          <Stack.Screen
            name="Result"
            children={({ navigation }) => (
              <ResultScreen onBackToHome={() => navigation.replace('Home')} />
            )}
          />
          <Stack.Screen
            name="Scoreboard"
            children={({ navigation }) => (
              <ScoreboardScreen
                onBackToHome={() => navigation.replace('Home')}
                onGoProfile={() => navigation.navigate('ProfileSettings')}
                onGoCategories={() => navigation.navigate('CategoryPacks')}
              />
            )}
          />
          <Stack.Screen
            name="ProfileSettings"
            children={({ navigation }) => (
              <ProfileSettingsScreen
                onBack={() => navigation.goBack()}
                onGoReport={() => navigation.navigate('Report')}
                onGoHome={() => navigation.replace('Home')}
                onGoCreate={() => navigation.navigate('CreateRoom')}
                onGoScoreboard={() => navigation.navigate('Scoreboard')}
              />
            )}
          />
          <Stack.Screen
            name="CategoryPacks"
            children={({ navigation }) => (
              <CategoryPacksScreen onBack={() => navigation.goBack()} />
            )}
          />
          <Stack.Screen
            name="Report"
            children={({ navigation }) => (
              <ReportScreen onBack={() => navigation.goBack()} />
            )}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
