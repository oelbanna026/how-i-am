export { gameActions, useGameStore } from './src/gameStore';
export {
  connectSocket,
  disconnectSocket,
  emitAck,
  getSocket,
  listenToEvents
} from './src/socketService';

import { AppRoot } from './src/AppRoot';

export default function App() {
  return <AppRoot />;
}
