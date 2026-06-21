import type { GroupLetter } from '../types'

export const GROUP_LETTERS: GroupLetter[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
]

/** Teams in official draw order per group (SPEC.md). */
export const GROUPS: Record<GroupLetter, string[]> = {
  A: ['Mexico', 'South Africa', 'Korea Republic', 'Czechia'],
  B: ['Canada', 'Switzerland', 'Qatar', 'Bosnia and Herzegovina'],
  C: ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  D: ['United States', 'Paraguay', 'Australia', 'Türkiye'],
  E: ['Germany', 'Curaçao', "Côte d'Ivoire", 'Ecuador'],
  F: ['Netherlands', 'Japan', 'Tunisia', 'Sweden'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Cabo Verde', 'Saudi Arabia', 'Uruguay'],
  I: ['France', 'Senegal', 'Norway', 'Iraq'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'Uzbekistan', 'Colombia', 'Congo DR'],
  L: ['England', 'Croatia', 'Ghana', 'Panama'],
}

/** ISO 3166-1 alpha-2 codes for flag emoji rendering. */
export const TEAM_CODE: Record<string, string> = {
  Mexico: 'MX', 'South Africa': 'ZA', 'Korea Republic': 'KR', Czechia: 'CZ',
  Canada: 'CA', Switzerland: 'CH', Qatar: 'QA', 'Bosnia and Herzegovina': 'BA',
  Brazil: 'BR', Morocco: 'MA', Haiti: 'HT', Scotland: 'GB-SCT',
  'United States': 'US', Paraguay: 'PY', Australia: 'AU', 'Türkiye': 'TR',
  Germany: 'DE', 'Curaçao': 'CW', "Côte d'Ivoire": 'CI', Ecuador: 'EC',
  Netherlands: 'NL', Japan: 'JP', Tunisia: 'TN', Sweden: 'SE',
  Belgium: 'BE', Egypt: 'EG', Iran: 'IR', 'New Zealand': 'NZ',
  Spain: 'ES', 'Cabo Verde': 'CV', 'Saudi Arabia': 'SA', Uruguay: 'UY',
  France: 'FR', Senegal: 'SN', Norway: 'NO', Iraq: 'IQ',
  Argentina: 'AR', Algeria: 'DZ', Austria: 'AT', Jordan: 'JO',
  Portugal: 'PT', Uzbekistan: 'UZ', Colombia: 'CO', 'Congo DR': 'CD',
  England: 'GB-ENG', Croatia: 'HR', Ghana: 'GH', Panama: 'PA',
}

/** FIFA 3-letter country codes, for space-constrained displays. */
export const TEAM_ABBR: Record<string, string> = {
  Mexico: 'MEX', 'South Africa': 'RSA', 'Korea Republic': 'KOR', Czechia: 'CZE',
  Canada: 'CAN', Switzerland: 'SUI', Qatar: 'QAT', 'Bosnia and Herzegovina': 'BIH',
  Brazil: 'BRA', Morocco: 'MAR', Haiti: 'HAI', Scotland: 'SCO',
  'United States': 'USA', Paraguay: 'PAR', Australia: 'AUS', 'Türkiye': 'TUR',
  Germany: 'GER', 'Curaçao': 'CUW', "Côte d'Ivoire": 'CIV', Ecuador: 'ECU',
  Netherlands: 'NED', Japan: 'JPN', Tunisia: 'TUN', Sweden: 'SWE',
  Belgium: 'BEL', Egypt: 'EGY', Iran: 'IRN', 'New Zealand': 'NZL',
  Spain: 'ESP', 'Cabo Verde': 'CPV', 'Saudi Arabia': 'KSA', Uruguay: 'URU',
  France: 'FRA', Senegal: 'SEN', Norway: 'NOR', Iraq: 'IRQ',
  Argentina: 'ARG', Algeria: 'ALG', Austria: 'AUT', Jordan: 'JOR',
  Portugal: 'POR', Uzbekistan: 'UZB', Colombia: 'COL', 'Congo DR': 'COD',
  England: 'ENG', Croatia: 'CRO', Ghana: 'GHA', Panama: 'PAN',
}

/** 3-letter abbreviation for a team, falling back to the first 3 letters. */
export function abbrOf(team: string): string {
  return TEAM_ABBR[team] ?? team.slice(0, 3).toUpperCase()
}

/** Convert a team name to a flag emoji. Falls back to a generic globe. */
export function flagOf(team: string): string {
  const code = TEAM_CODE[team]
  if (!code) return '🏳️'
  // Subdivision flags (Scotland / England) have no single emoji; use a globe.
  if (code.includes('-')) return code === 'GB-SCT' ? '🏴󠁧󠁢󠁳󠁣󠁴󠁿' : '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}
