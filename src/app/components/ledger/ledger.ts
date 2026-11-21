import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, timer } from 'rxjs';
import { FinanceRule, LedgerFilters, Transaction, TransactionStatus } from '../../models/models';
import { debouncedSearch, evaluateRule, filterTransactions, LedgerStore } from '../../services/ledger.service';

@Component({
  selector: 'app-ledger',
  imports: [CurrencyPipe, DatePipe, RouterLink, RouterOutlet],
  templateUrl: './ledger.html',
  styleUrl: './ledger.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ledger {
  store = inject(LedgerStore);
  route = inject(ActivatedRoute);
  router = inject(Router);
  destroyRef = inject(DestroyRef);
  searchTerms = new Subject<string>();
  importMessage = signal('');
  importing = signal(false);
  filters = signal<LedgerFilters>({ q: '', category: '', status: '', min: '', max: '' });
  filteredTransactions = computed(() => filterTransactions(this.store.transactions(), this.filters()));
  approvedCount = computed(() => this.store.transactions().filter((item) => item.status === 'Approved').length);
  flaggedCount = computed(() => this.store.transactions().filter((item) => item.status === 'Flagged').length);
  pendingCount = computed(() => this.store.transactions().filter((item) => item.status === 'Pending').length);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const status = params.get('status');
      this.filters.set({
        q: params.get('q') ?? '',
        category: params.get('category') ?? '',
        status: status === 'Approved' || status === 'Flagged' || status === 'Pending' ? status : '',
        min: params.get('min') ?? '',
        max: params.get('max') ?? '',
      });
    });
    debouncedSearch(this.searchTerms).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      this.updateFilters({ ...this.filters(), q });
    });
  }

  onSearch(event: Event): void {
    this.searchTerms.next((event.target as HTMLInputElement).value);
  }

  setCategory(event: Event): void {
    this.updateFilters({ ...this.filters(), category: (event.target as HTMLSelectElement).value });
  }

  setStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const status: LedgerFilters['status'] = value === 'Approved' || value === 'Flagged' || value === 'Pending' ? value : '';
    this.updateFilters({ ...this.filters(), status });
  }

  setAmount(key: 'min' | 'max', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateFilters({ ...this.filters(), [key]: value });
  }

  hasActiveFilters(): boolean {
    const filters = this.filters();
    return !!(filters.q || filters.category || filters.status || filters.min || filters.max);
  }

  resetFilters(): void {
    this.searchTerms.next('');
    this.updateFilters({ q: '', category: '', status: '', min: '', max: '' });
  }

  resetDemoData(): void {
    this.store.resetDemoData();
    this.importMessage.set('Demo transactions restored.');
  }

  importFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importing.set(true);
    this.importMessage.set('');
    const started = Date.now();
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        this.finishImport('Unable to read this CSV file.', started);
        return;
      }
      try {
        const count = this.store.importCsv(reader.result);
        this.finishImport(`${count} transaction${count === 1 ? '' : 's'} imported.`, started);
      } catch (error) {
        this.finishImport(error instanceof Error ? error.message : 'Unable to import this CSV file.', started);
      }
      input.value = '';
    };
    reader.onerror = () => {
      input.value = '';
      this.finishImport('Unable to read this CSV file.', started);
    };
    reader.readAsText(file);
  }

  finishImport(message: string, started: number): void {
    this.importMessage.set(message);
    timer(Math.max(0, 500 - (Date.now() - started)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.importing.set(false));
  }

  violatesRule(transaction: Transaction, rule: FinanceRule): boolean {
    return evaluateRule(transaction, rule);
  }

  updateFilters(filters: LedgerFilters): void {
    this.filters.set(filters);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: filters.q || null,
        category: filters.category || null,
        status: filters.status || null,
        min: filters.min || null,
        max: filters.max || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
