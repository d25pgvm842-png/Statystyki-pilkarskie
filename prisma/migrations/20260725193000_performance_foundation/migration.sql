-- Sprint 1.32: indeksy pod najczęstsze zapytania ekranów analitycznych.
CREATE INDEX "Match_seasonId_status_kickoffAt_idx"
  ON "Match"("seasonId", "status", "kickoffAt");

CREATE INDEX "Match_refereeId_status_kickoffAt_idx"
  ON "Match"("refereeId", "status", "kickoffAt");

CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx"
  ON "AuditLog"("entityType", "entityId", "createdAt");

CREATE INDEX "AuditChange_auditLogId_fieldName_idx"
  ON "AuditChange"("auditLogId", "fieldName");
