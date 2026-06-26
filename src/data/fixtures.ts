import type { GroupLetter } from '../types'

export type Fixture = {
  date: string // YYYY-MM-DD (venue-local calendar date; internal key for standings/grouping)
  kickoff: string // ISO 8601 instant with venue UTC offset, e.g. 2026-06-11T13:00:00-06:00
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
const F = (kickoff: string, home: string, away: string, hs: number | null = null, as: number | null = null): Fixture => ({
  date: kickoff.slice(0, 10),
  kickoff,
  home,
  away,
  hs,
  as,
})

export const FIXTURES: Record<GroupLetter, Fixture[]> = {
  A: [
    F('2026-06-11T13:00:00-06:00', 'Mexico', 'South Africa', 2, 0),
    F('2026-06-11T20:00:00-06:00', 'Korea Republic', 'Czechia', 2, 1),
    F('2026-06-18T12:00:00-04:00', 'Czechia', 'South Africa', 1, 1),
    F('2026-06-18T19:00:00-06:00', 'Mexico', 'Korea Republic', 1, 0),
    F('2026-06-24T19:00:00-06:00', 'Czechia', 'Mexico', 0, 3),
    F('2026-06-24T19:00:00-06:00', 'South Africa', 'Korea Republic', 1, 0),
  ],
  B: [
    F('2026-06-12T15:00:00-04:00', 'Canada', 'Bosnia and Herzegovina', 1, 1),
    F('2026-06-13T12:00:00-07:00', 'Qatar', 'Switzerland', 1, 1),
    F('2026-06-18T12:00:00-07:00', 'Switzerland', 'Bosnia and Herzegovina', 4, 1),
    F('2026-06-18T15:00:00-07:00', 'Canada', 'Qatar', 6, 0),
    F('2026-06-24T12:00:00-07:00', 'Switzerland', 'Canada', 2, 1),
    F('2026-06-24T12:00:00-07:00', 'Bosnia and Herzegovina', 'Qatar', 3, 1),
  ],
  C: [
    F('2026-06-13T18:00:00-04:00', 'Brazil', 'Morocco', 1, 1),
    F('2026-06-13T21:00:00-04:00', 'Haiti', 'Scotland', 0, 1),
    F('2026-06-19T18:00:00-04:00', 'Scotland', 'Morocco', 0, 1),
    F('2026-06-19T20:30:00-04:00', 'Brazil', 'Haiti', 3, 0),
    F('2026-06-24T18:00:00-04:00', 'Scotland', 'Brazil', 0, 3),
    F('2026-06-24T18:00:00-04:00', 'Morocco', 'Haiti', 4, 2),
  ],
  D: [
    F('2026-06-12T18:00:00-07:00', 'United States', 'Paraguay', 4, 1),
    F('2026-06-13T21:00:00-07:00', 'Australia', 'Türkiye', 2, 0),
    F('2026-06-19T12:00:00-07:00', 'United States', 'Australia', 2, 0),
    F('2026-06-19T20:00:00-07:00', 'Türkiye', 'Paraguay', 0, 1),
    F('2026-06-25T19:00:00-07:00', 'Türkiye', 'United States', 3, 2),
    F('2026-06-25T19:00:00-07:00', 'Paraguay', 'Australia', 0, 0),
  ],
  E: [
    F('2026-06-14T12:00:00-05:00', 'Germany', 'Curaçao', 7, 1),
    F('2026-06-14T19:00:00-04:00', "Côte d'Ivoire", 'Ecuador', 1, 0),
    F('2026-06-20T16:00:00-04:00', 'Germany', "Côte d'Ivoire", 2, 1),
    F('2026-06-20T19:00:00-05:00', 'Ecuador', 'Curaçao', 0, 0),
    F('2026-06-25T16:00:00-04:00', 'Curaçao', "Côte d'Ivoire", 0, 2),
    F('2026-06-25T16:00:00-04:00', 'Ecuador', 'Germany', 2, 1),
  ],
  F: [
    F('2026-06-14T15:00:00-05:00', 'Netherlands', 'Japan', 2, 2),
    F('2026-06-14T20:00:00-06:00', 'Sweden', 'Tunisia', 5, 1),
    F('2026-06-20T12:00:00-05:00', 'Netherlands', 'Sweden', 5, 1),
    F('2026-06-20T22:00:00-06:00', 'Tunisia', 'Japan', 0, 4),
    F('2026-06-25T18:00:00-05:00', 'Japan', 'Sweden', 1, 1),
    F('2026-06-25T18:00:00-05:00', 'Tunisia', 'Netherlands', 1, 3),
  ],
  G: [
    F('2026-06-15T12:00:00-07:00', 'Belgium', 'Egypt', 1, 1),
    F('2026-06-15T18:00:00-07:00', 'Iran', 'New Zealand', 2, 2),
    F('2026-06-21T12:00:00-07:00', 'Belgium', 'Iran', 0, 0),
    F('2026-06-21T18:00:00-07:00', 'New Zealand', 'Egypt', 1, 3),
    F('2026-06-26T20:00:00-07:00', 'Egypt', 'Iran'),
    F('2026-06-26T20:00:00-07:00', 'New Zealand', 'Belgium'),
  ],
  H: [
    F('2026-06-15T12:00:00-04:00', 'Spain', 'Cabo Verde', 0, 0),
    F('2026-06-15T18:00:00-04:00', 'Saudi Arabia', 'Uruguay', 1, 1),
    F('2026-06-21T12:00:00-04:00', 'Spain', 'Saudi Arabia', 4, 0),
    F('2026-06-21T18:00:00-04:00', 'Uruguay', 'Cabo Verde', 2, 2),
    F('2026-06-26T19:00:00-05:00', 'Cabo Verde', 'Saudi Arabia'),
    F('2026-06-26T18:00:00-06:00', 'Uruguay', 'Spain'),
  ],
  I: [
    F('2026-06-16T15:00:00-04:00', 'France', 'Senegal', 3, 1),
    F('2026-06-16T18:00:00-04:00', 'Iraq', 'Norway', 1, 4),
    F('2026-06-22T17:00:00-04:00', 'France', 'Iraq', 3, 0),
    F('2026-06-22T20:00:00-04:00', 'Norway', 'Senegal', 3, 2),
    F('2026-06-26T15:00:00-04:00', 'Norway', 'France'),
    F('2026-06-26T15:00:00-04:00', 'Senegal', 'Iraq'),
  ],
  J: [
    F('2026-06-16T20:00:00-05:00', 'Argentina', 'Algeria', 3, 0),
    F('2026-06-16T21:00:00-07:00', 'Austria', 'Jordan', 3, 1),
    F('2026-06-22T12:00:00-05:00', 'Argentina', 'Austria', 2, 0),
    F('2026-06-22T20:00:00-07:00', 'Jordan', 'Algeria', 1, 2),
    F('2026-06-27T21:00:00-05:00', 'Algeria', 'Austria'),
    F('2026-06-27T21:00:00-05:00', 'Jordan', 'Argentina'),
  ],
  K: [
    F('2026-06-17T12:00:00-05:00', 'Portugal', 'Congo DR', 1, 1),
    F('2026-06-17T20:00:00-06:00', 'Uzbekistan', 'Colombia', 1, 3),
    F('2026-06-23T12:00:00-05:00', 'Portugal', 'Uzbekistan', 5, 0),
    F('2026-06-23T20:00:00-06:00', 'Colombia', 'Congo DR', 1, 0),
    F('2026-06-27T19:30:00-04:00', 'Colombia', 'Portugal'),
    F('2026-06-27T19:30:00-04:00', 'Congo DR', 'Uzbekistan'),
  ],
  L: [
    F('2026-06-17T15:00:00-05:00', 'England', 'Croatia', 4, 2),
    F('2026-06-17T19:00:00-04:00', 'Ghana', 'Panama', 1, 0),
    F('2026-06-23T16:00:00-04:00', 'England', 'Ghana', 0, 0),
    F('2026-06-23T19:00:00-04:00', 'Panama', 'Croatia', 0, 1),
    F('2026-06-27T17:00:00-04:00', 'Panama', 'England'),
    F('2026-06-27T17:00:00-04:00', 'Croatia', 'Ghana'),
  ],
}
