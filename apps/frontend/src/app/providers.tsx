import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { UiConfigProvider } from '../shared/ui-config/UiConfigProvider';

export function AppProviders() {
  return (
    <UiConfigProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </UiConfigProvider>
  );
}
