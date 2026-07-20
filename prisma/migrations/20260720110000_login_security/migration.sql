-- CreateTable
CREATE TABLE "LoginThrottle" (
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LoginSecurityEvent" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT,
    "ipHash" TEXT NOT NULL,
    "userId" TEXT,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginThrottle_scope_blockedUntil_idx" ON "LoginThrottle"("scope", "blockedUntil");

-- CreateIndex
CREATE INDEX "LoginThrottle_lastAttemptAt_idx" ON "LoginThrottle"("lastAttemptAt");

-- CreateIndex
CREATE INDEX "LoginSecurityEvent_createdAt_idx" ON "LoginSecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "LoginSecurityEvent_outcome_createdAt_idx" ON "LoginSecurityEvent"("outcome", "createdAt");

-- CreateIndex
CREATE INDEX "LoginSecurityEvent_emailHash_createdAt_idx" ON "LoginSecurityEvent"("emailHash", "createdAt");

-- CreateIndex
CREATE INDEX "LoginSecurityEvent_ipHash_createdAt_idx" ON "LoginSecurityEvent"("ipHash", "createdAt");
