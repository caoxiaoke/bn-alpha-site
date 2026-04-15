import { create } from 'zustand';
import { Token } from '@/types';

interface TokenState {
  tokens: Token[];
  isLoading: boolean;
  error: string | null;
  setTokens: (tokens: Token[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  selectedToken: Token | null;
  setSelectedToken: (token: Token | null) => void;
}

export const useTokenStore = create<TokenState>((set) => ({
  tokens: [],
  isLoading: false,
  error: null,
  setTokens: (tokens) => set({ tokens }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  selectedToken: null,
  setSelectedToken: (token) => set({ selectedToken: token }),
}));
