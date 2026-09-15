jest.mock('@lib/context/auth-context', () => ({
  useAuth: () => ({ user: null })
}));

import { act } from '@testing-library/react';
import { renderToString } from 'react-dom/server.node';
import { hydrateRoot } from 'react-dom/client';
import { InputThemeRadio } from '@components/input/input-theme-radio';
import { InputAccentRadio } from '@components/input/input-accent-radio';
import { ThemeContextProvider } from './theme-context';

it('hydrates saved display preferences without leaving server-default checkmarks selected', async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({ matches: true }))
  });
  localStorage.clear();
  const view = (
    <ThemeContextProvider>
      <InputThemeRadio type='light' label='Default' />
      <InputThemeRadio type='dark' label='Lights out' />
      <InputAccentRadio type='blue' />
      <InputAccentRadio type='purple' />
    </ThemeContextProvider>
  );
  const container = document.createElement('div');
  container.innerHTML = renderToString(view);
  document.body.append(container);
  localStorage.setItem('theme', 'light');
  localStorage.setItem('accent', 'purple');
  localStorage.setItem('fontSize', 'xl');
  localStorage.setItem('squareProfilePictures', 'true');
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, view);
  });

  try {
    expect(
      container.querySelector<HTMLInputElement>('input[value="light"]')?.checked
    ).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>('input[value="dark"]')?.checked
    ).toBe(false);
    expect(
      container.querySelector<HTMLInputElement>('input[value="purple"]')
        ?.checked
    ).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.fontSize).toBe('20px');
    expect(
      document.documentElement.style.getPropertyValue(
        '--profile-picture-radius'
      )
    ).toBe('16%');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(localStorage.getItem('accent')).toBe('purple');
  } finally {
    await act(async () => root!.unmount());
    container.remove();
    localStorage.clear();
    document.documentElement.removeAttribute('style');
    document.documentElement.classList.remove('dark');
  }
});
