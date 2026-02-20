import { createSlice } from '@reduxjs/toolkit';
import type { Session, User } from '@supabase/supabase-js';

export type AuthState = {
  user: User | null;
  session: Session | null;
  /** True after initial getSession() has run (so we know whether user is logged in). */
  initialized: boolean;
};

const initialState: AuthState = {
  user: null,
  session: null,
  initialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: { payload: { user: User | null; session: Session | null } }) => {
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.initialized = true;
    },
    clearAuth: (state) => {
      state.user = null;
      state.session = null;
    },
  },
});

export const { setAuth, clearAuth } = authSlice.actions;
export default authSlice.reducer;
