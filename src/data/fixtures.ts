import type { GroupLetter } from '../types'

export type Fixture = {
  date: string // YYYY-MM-DD
  home: string
  away: string
  hs: number | null // home score (null = not yet played)
  as: number | null // away score
}

export const resultKey = (group: GroupLetter, index: number) => `${group}:${index}`

/**
 * All 72 group-stage fixtures with results as of 2026-06-21.
 * Reference only — not used in any calculation. Source: per-group Wikipedia
 * articles (2026 FIFA World Cup Group A … Group L). Team names canonicalised.
 */
const F = (date: string, home: string, away: string, hs: number | null = null, as: number | null = null): Fixture => ({
  date,
  home,
  away,
  hs,
  as,
})

export const FIXTURES: Record<GroupLetter, Fixture[]> = {
  A: [
    F('2026-06-11', 'Mexico', 'South Africa', 2, 0),
    F('2026-06-11', 'Korea Republic', 'Czechia', 2, 1),
    F('2026-06-18', 'Czechia', 'South Africa', 1, 1),
    F('2026-06-18', 'Mexico', 'Korea Republic', 1, 0),
    F('2026-06-24', 'Czechia', 'Mexico', 0, 3),
    F('2026-06-24', 'South Africa', 'Korea Republic', 1, 0),
  ],
  B: [
    F('2026-06-12', 'Canada', 'Bosnia and Herzegovina', 1, 1),
    F('2026-06-13', 'Qatar', 'Switzerland', 1, 1),
    F('2026-06-18', 'Switzerland', 'Bosnia and Herzegovina', 4, 1),
    F('2026-06-18', 'Canada', 'Qatar', 6, 0),
    F('2026-06-24', 'Switzerland', 'Canada', 2, 1),
    F('2026-06-24', 'Bosnia and Herzegovina', 'Qatar', 3, 1),
  ],
  C: [
    F('2026-06-13', 'Brazil', 'Morocco', 1, 1),
    F('2026-06-13', 'Haiti', 'Scotland', 0, 1),
    F('2026-06-19', 'Scotland', 'Morocco', 0, 1),
    F('2026-06-19', 'Brazil', 'Haiti', 3, 0),
    F('2026-06-24', 'Scotland', 'Brazil', 0, 3),
    F('2026-06-24', 'Morocco', 'Haiti', 4, 2),
  ],
  D: [
    F('2026-06-12', 'United States', 'Paraguay', 4, 1),
    F('2026-06-13', 'Australia', 'Türkiye', 2, 0),
    F('2026-06-19', 'United States', 'Australia', 2, 0),
    F('2026-06-19', 'Türkiye', 'Paraguay', 0, 1),
    F('2026-06-25', 'Türkiye', 'United States'),
    F('2026-06-25', 'Paraguay', 'Australia'),
  ],
  E: [
    F('2026-06-14', 'Germany', 'Curaçao', 7, 1),
    F('2026-06-14', "Côte d'Ivoire", 'Ecuador', 1, 0),
    F('2026-06-20', 'Germany', "Côte d'Ivoire", 2, 1),
    F('2026-06-20', 'Ecuador', 'Curaçao', 0, 0),
    F('2026-06-25', 'Curaçao', "Côte d'Ivoire"),
    F('2026-06-25', 'Ecuador', 'Germany'),
  ],
  F: [
    F('2026-06-14', 'Netherlands', 'Japan', 2, 2),
    F('2026-06-14', 'Sweden', 'Tunisia', 5, 1),
    F('2026-06-20', 'Netherlands', 'Sweden', 5, 1),
    F('2026-06-20', 'Tunisia', 'Japan', 0, 4),
    F('2026-06-25', 'Japan', 'Sweden'),
    F('2026-06-25', 'Tunisia', 'Netherlands'),
  ],
  G: [
    F('2026-06-15', 'Belgium', 'Egypt', 1, 1),
    F('2026-06-15', 'Iran', 'New Zealand', 2, 2),
    F('2026-06-21', 'Belgium', 'Iran', 0, 0),
    F('2026-06-21', 'New Zealand', 'Egypt', 1, 3),
    F('2026-06-26', 'Egypt', 'Iran'),
    F('2026-06-26', 'New Zealand', 'Belgium'),
  ],
  H: [
    F('2026-06-15', 'Spain', 'Cabo Verde', 0, 0),
    F('2026-06-15', 'Saudi Arabia', 'Uruguay', 1, 1),
    F('2026-06-21', 'Spain', 'Saudi Arabia', 4, 0),
    F('2026-06-21', 'Uruguay', 'Cabo Verde', 2, 2),
    F('2026-06-26', 'Cabo Verde', 'Saudi Arabia'),
    F('2026-06-26', 'Uruguay', 'Spain'),
  ],
  I: [
    F('2026-06-16', 'France', 'Senegal', 3, 1),
    F('2026-06-16', 'Iraq', 'Norway', 1, 4),
    F('2026-06-22', 'France', 'Iraq', 3, 0),
    F('2026-06-22', 'Norway', 'Senegal', 3, 2),
    F('2026-06-26', 'Norway', 'France'),
    F('2026-06-26', 'Senegal', 'Iraq'),
  ],
  J: [
    F('2026-06-16', 'Argentina', 'Algeria', 3, 0),
    F('2026-06-16', 'Austria', 'Jordan', 3, 1),
    F('2026-06-22', 'Argentina', 'Austria', 2, 0),
    F('2026-06-22', 'Jordan', 'Algeria', 1, 2),
    F('2026-06-27', 'Algeria', 'Austria'),
    F('2026-06-27', 'Jordan', 'Argentina'),
  ],
  K: [
    F('2026-06-17', 'Portugal', 'Congo DR', 1, 1),
    F('2026-06-17', 'Uzbekistan', 'Colombia', 1, 3),
    F('2026-06-23', 'Portugal', 'Uzbekistan', 5, 0),
    F('2026-06-23', 'Colombia', 'Congo DR', 1, 0),
    F('2026-06-27', 'Colombia', 'Portugal'),
    F('2026-06-27', 'Congo DR', 'Uzbekistan'),
  ],
  L: [
    F('2026-06-17', 'England', 'Croatia', 4, 2),
    F('2026-06-17', 'Ghana', 'Panama', 1, 0),
    F('2026-06-23', 'England', 'Ghana', 0, 0),
    F('2026-06-23', 'Panama', 'Croatia', 0, 1),
    F('2026-06-27', 'Panama', 'England'),
    F('2026-06-27', 'Croatia', 'Ghana'),
  ],
}
