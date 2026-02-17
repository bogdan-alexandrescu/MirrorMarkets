-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "leader_address" TEXT NOT NULL,
    "leader_name" TEXT,
    "trades_found" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_logs_created_at_idx" ON "sync_logs"("created_at");
