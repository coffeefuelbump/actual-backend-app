import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./firebase', () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
  doc: jest.fn(),
  getDoc: jest.fn(),
  signOut: jest.fn(),
  googleProvider: {},
  signInWithRedirect: jest.fn(),
  sendSignInLinkToEmail: jest.fn(),
  isSignInWithEmailLink: jest.fn(() => false),
  signInWithEmailLink: jest.fn(),
  getRedirectResult: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('./AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ currentUser: null, loading: false }),
}));

test('renders the unauthenticated home page', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', {
      name: /actually build backend apps using ai/i,
    })
  ).toBeInTheDocument();
});
