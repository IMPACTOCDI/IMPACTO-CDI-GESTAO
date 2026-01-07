import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider } from '../contexts/SupabaseAuthContext';
import Login from '../components/auth/Login';
import { supabase } from '../lib/supabase';
import { MemoryRouter } from 'react-router-dom';

// Mock do Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: {
            unsubscribe: vi.fn()
          }
        }
      }),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: null
        },
        error: null
      })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null
      }),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null
      })
    })
  },
}));

describe('Autenticação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('deve renderizar o formulário de login', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  test('deve mostrar erro com credenciais inválidas', async () => {
    (supabase.auth.signInWithPassword as any).mockRejectedValueOnce(new Error('Credenciais inválidas'));

    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'teste@exemplo.com' },
    });

    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senha123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
    });
  });

  test('deve fazer login com sucesso', async () => {
    const mockUser = { id: '1', email: 'teste@exemplo.com' };
    (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({ data: { user: mockUser } });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'teste@exemplo.com' },
    });

    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senha123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'teste@exemplo.com',
        password: 'senha123',
      });
    });
  });
}); 