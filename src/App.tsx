import React from 'react';
import { AppProvider, useApp } from './context/AppContext.js';
import { AppShell } from './components/AppShell.js';
import { AkOverviewPage } from './pages/arknights/AkOverviewPage.js';
import { AkGachaPage } from './pages/arknights/AkGachaPage.js';
import { AkGarrisonPage } from './pages/arknights/AkGarrisonPage.js';
import { AkRoguePage } from './pages/arknights/AkRoguePage.js';
import { AkPrtsPage } from './pages/arknights/AkPrtsPage.js';
import { EfGachaPage } from './pages/endfield/EfGachaPage.js';
import { AccountPage } from './pages/AccountPage.js';

const ActiveView: React.FC = () => {
  const { gameMode, akTab, efTab } = useApp();

  if (gameMode === 'arknights') {
    switch (akTab) {
      case 'overview':
        return <AkOverviewPage />;
      case 'gacha':
        return <AkGachaPage />;
      case 'garrison':
        return <AkGarrisonPage />;
      case 'rogue':
        return <AkRoguePage />;
      case 'prts':
        return <AkPrtsPage />;
      case 'account':
        return <AccountPage />;
    }
  }

  return efTab === 'account' ? <AccountPage /> : <EfGachaPage />;
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppShell>
        <ActiveView />
      </AppShell>
    </AppProvider>
  );
};

export default App;
