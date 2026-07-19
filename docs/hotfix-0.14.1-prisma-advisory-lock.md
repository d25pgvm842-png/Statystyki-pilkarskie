# Hotfix 0.14.1 — blokada transakcyjna Prisma

## Problem

Funkcja PostgreSQL `pg_advisory_xact_lock` zwraca typ `void`.
Prisma próbowała zdeserializować ten wynik przez `$queryRaw`, przez co
zatwierdzanie każdego wiersza importu zewnętrznego kończyło się błędem.

## Poprawka

Wynik funkcji blokującej jest jawnie rzutowany do typu `text`.
Blokada nadal działa transakcyjnie i jest automatycznie zwalniana po
zakończeniu transakcji, ale Prisma otrzymuje obsługiwany typ danych.

## Skutek dla błędnego raportu

Wiersze oznaczone błędem przez wcześniejszą wersję nie zapisały drużyn,
sędziów, mapowań ani meczów, ponieważ transakcja została wycofana.
Po wdrożeniu hotfixa należy przygotować świeży raport.
