'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#3f51b5',
    },
  },
});

export default function Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  const wagmiConfig = useMemo(() => {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    return createConfig({
      chains: [arbitrumSepolia],
      transports: {
        [arbitrumSepolia.id]: http(rpcUrl || 'https://sepolia-rollup.arbitrum.io/rpc'),
      },
    });
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
