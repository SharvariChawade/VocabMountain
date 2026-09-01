-- CreateEnum
CREATE TYPE "DeckKind" AS ENUM ('GROUP', 'CURATED');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('AGAIN', 'KNEW');

-- CreateTable
CREATE TABLE "word" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "pronunciation" TEXT NOT NULL,
    "partOfSpeech" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "blank" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "synonyms" TEXT[],
    "antonyms" TEXT[],

    CONSTRAINT "word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deck" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "DeckKind" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deck_word" (
    "deckId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "deck_word_pkey" PRIMARY KEY ("deckId","wordId")
);

-- CreateTable
CREATE TABLE "confusable" (
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,

    CONSTRAINT "confusable_pkey" PRIMARY KEY ("fromId","toId")
);

-- CreateTable
CREATE TABLE "card" (
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buriedUntil" TIMESTAMP(3),
    "hook" TEXT,
    "lastGrade" "Grade",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_pkey" PRIMARY KEY ("userId","wordId")
);

-- CreateTable
CREATE TABLE "review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "revealed" BOOLEAN NOT NULL,
    "ms" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL,
    "dailyGoal" INTEGER NOT NULL DEFAULT 40,
    "studyOrder" TEXT NOT NULL DEFAULT 'smart',
    "sentenceFirst" BOOLEAN NOT NULL DEFAULT false,
    "showRoots" BOOLEAN NOT NULL DEFAULT true,
    "keyboardHints" BOOLEAN NOT NULL DEFAULT true,
    "speech" BOOLEAN NOT NULL DEFAULT false,
    "activeDeckId" TEXT,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "word_term_key" ON "word"("term");

-- CreateIndex
CREATE INDEX "word_root_idx" ON "word"("root");

-- CreateIndex
CREATE UNIQUE INDEX "deck_slug_key" ON "deck"("slug");

-- CreateIndex
CREATE INDEX "deck_word_deckId_position_idx" ON "deck_word"("deckId", "position");

-- CreateIndex
CREATE INDEX "card_userId_dueAt_idx" ON "card"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "card_userId_lapses_idx" ON "card"("userId", "lapses");

-- CreateIndex
CREATE INDEX "card_userId_intervalDays_idx" ON "card"("userId", "intervalDays");

-- CreateIndex
CREATE INDEX "review_userId_createdAt_idx" ON "review"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "deck_word" ADD CONSTRAINT "deck_word_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_word" ADD CONSTRAINT "deck_word_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confusable" ADD CONSTRAINT "confusable_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confusable" ADD CONSTRAINT "confusable_toId_fkey" FOREIGN KEY ("toId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
