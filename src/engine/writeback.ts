import type { AuditEntry, WriteBackEntry } from './types';

export class LogBook {
  writes: WriteBackEntry[] = [];
  audit: AuditEntry[] = [];
  private wid = 1;
  private aid = 1;
  totalWrites = 0;
  totalAudit = 0;
  constructor(private cap = 3000) {}

  write(t: number, tag: string, value: string | number, kind: WriteBackEntry['kind']) {
    this.writes.push({ id: this.wid++, t, tag, value, kind, dryRun: true });
    this.totalWrites++;
    if (this.writes.length > this.cap) this.writes.shift();
  }
  log(t: number, actor: AuditEntry['actor'], action: string, reason: string, ref?: string) {
    this.audit.push({ id: this.aid++, t, actor, action, reason, ref });
    this.totalAudit++;
    if (this.audit.length > this.cap) this.audit.shift();
  }
  reset() {
    this.writes = [];
    this.audit = [];
    this.totalWrites = 0;
    this.totalAudit = 0;
  }
}

export const opcTag = (name: string) => `ns=2;s=${name}`;
