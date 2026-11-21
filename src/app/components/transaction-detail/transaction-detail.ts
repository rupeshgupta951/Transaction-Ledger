import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, timer } from 'rxjs';
import { Transaction, TransactionStatus } from '../../models/models';
import { evaluateRule, LedgerStore } from '../../services/ledger.service';

@Component({
  selector: 'app-transaction-detail',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './transaction-detail.html',
  styleUrl: './transaction-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionDetail {
  transaction = signal<Transaction | undefined>(undefined);
  store = inject(LedgerStore);
  activeRules = computed(() => this.store.rules().filter((rule) => rule.enabled));
  savedMessage = signal('');
  route = inject(ActivatedRoute);
  router = inject(Router);
  destroyRef = inject(DestroyRef);
  savedSnapshot: Transaction | undefined;
  undoTimer?: Subscription;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.transaction.set(this.store.getTransaction(params.get('id') ?? ''));
    });
  }

  updateStatus(event: Event): void {
    this.updateDraft({ status: (event.target as HTMLSelectElement).value as TransactionStatus });
  }

  updateNotes(event: Event): void {
    this.updateDraft({ notes: (event.target as HTMLTextAreaElement).value });
  }

  save(): void {
    const transaction = this.transaction();
    if (!transaction) return;
    const previous = this.store.updateTransaction(transaction);
    if (!previous) return;
    this.savedSnapshot = previous;
    this.savedMessage.set('Changes saved. You can undo this for 5 seconds.');
    this.undoTimer?.unsubscribe();
    this.undoTimer = timer(5000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.savedMessage.set('');
      this.savedSnapshot = undefined;
    });
  }

  undo(): void {
    if (this.savedSnapshot) {
      this.store.updateTransaction(this.savedSnapshot);
      this.transaction.set(this.savedSnapshot);
    }
    this.savedSnapshot = undefined;
    this.undoTimer?.unsubscribe();
    this.savedMessage.set('Changes undone.');
    timer(1800).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.savedMessage.set(''));
  }

  close(): void {
    this.router.navigate(['/ledger'], { queryParamsHandling: 'preserve' });
  }

  ruleViolates(ruleId: string): boolean {
    const transaction = this.transaction();
    const rule = this.activeRules().find((item) => item.id === ruleId);
    return !!transaction && !!rule && evaluateRule(transaction, rule);
  }

  updateDraft(changes: Partial<Transaction>): void {
    this.transaction.update((item) => item ? { ...item, ...changes } : item);
  }
}
