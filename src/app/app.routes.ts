import { CanDeactivateFn, Routes } from '@angular/router';

const unsavedRulesGuard: CanDeactivateFn<{ canDeactivate: () => boolean }> =
  (component) => component.canDeactivate();

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'ledger' },
  {
    path: 'ledger',
    loadComponent: () => import('./components/ledger/ledger').then((module) => module.Ledger),
    children: [
      { path: 'tx/:id', loadComponent: () => import('./components/transaction-detail/transaction-detail').then((module) => module.TransactionDetail) },
    ],
  },
  {
    path: 'rules',
    loadComponent: () => import('./components/rules/rules').then((module) => module.Rules),
    canDeactivate: [unsavedRulesGuard],
  },
  { path: '**', redirectTo: 'ledger' },
];
