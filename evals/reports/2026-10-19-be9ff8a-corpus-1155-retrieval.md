# Eval report: corpus-1155-retrieval

- **Date:** 2026-10-19T10:35:49.195Z
- **Git SHA:** be9ff8a
- **Questions:** 71 (58 answerable, 13 should-abstain)
- **Config:** K=6, gate=0.68, retrieval-only

## Metrics

| Metric | Value | Target |
| --- | --- | --- |
| Recall@5 | 99.1% | ≥85% |
| Recall@K(6) | 99.1% | — |
| MRR | 0.966 | Track |
| Abstain precision | 53.8% | ≥90% |
| Over-refusal | 1.7% | ≤10% |
| Avg latency | 847ms | — |

## Failures

None — all answerable questions had at least one gold chunk in top 5.

## All results

| ID | Type | R@5 | MRR | Sim | Abstain? | Gold | Top 5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| g-001 | lookup | 1.00 | 1.00 | 0.760 | no | dbc-2021#Table B.5 | dbc-2021#Table B.5, dbc-2021#B.6.2.1, dbc-2021#Table B.7, dbc-2021#Definition: Clear width, dbc-2021#Definition: Corridor |
| g-002 | numeric | 1.00 | 1.00 | 0.738 | no | dbc-2021#Table B.3 | dbc-2021#Table B.3, dbc-2021#Table B.8, dbc-2021#B.5.2, dbc-2021#Definition: Habitable space, dbc-2021#Table B.31 |
| g-003 | numeric | 1.00 | 1.00 | 0.729 | no | dbc-2021#B.6.4.1.4 | dbc-2021#B.6.4.1.4, dbc-2021#Table B.6, dbc-2021#B.6.4.1.13, dbc-2021#Table B.17, dbc-2021#Definition: Riser |
| g-004 | lookup | 1.00 | 0.20 | 0.654 | no | dbc-2021#B.6.4.1.4 | dbc-2021#B.6.4.1.12, dbc-2021#B.6.4.1.7, dbc-2021#B.6.4.1.5, dbc-2021#Table B.6, dbc-2021#B.6.4.1.4 |
| g-005 | numeric | 1.00 | 1.00 | 0.728 | no | dbc-2021#Table B.7 | dbc-2021#Table B.7, dbc-2021#B.6.5.1, dbc-2021#B.9.4.4, dbc-2021#Definition: Clear width, dbc-2021#Table B.5 |
| g-006 | lookup | 1.00 | 1.00 | 0.737 | no | dbc-2021#B.6.4.1.5 | dbc-2021#B.6.4.1.5, dbc-2021#Table B.6, dbc-2021#B.6.4.1.4, dbc-2021#Definition: Landing, dbc-2021#B.6.4.1.16 |
| g-007 | lookup | 1.00 | 1.00 | 0.769 | no | dbc-2021#B.6.5.1 | dbc-2021#B.6.5.1, dbc-2021#Table B.7, dbc-2021#B.8.1.5, dbc-2021#B.6.4.1.5, dbc-2021#Table B.5 |
| g-008 | numeric | 1.00 | 1.00 | 0.772 | no | dbc-2021#Table B.9 | dbc-2021#Table B.9, dbc-2021#Table B.10, dbc-2021#B.7.2.2, dbc-2021#Definition: Ramp, dbc-2021#B.7.3.2 |
| g-009 | numeric | 1.00 | 1.00 | 0.785 | no | dbc-2021#B.4.2.1 | dbc-2021#B.4.2.1, dbc-2021#Definition: Gate level, dbc-2021#B.7.2.1, dbc-2021#B.7.3.1.2, dbc-2021#Table B.15 |
| g-010 | numeric | 1.00 | 1.00 | 0.757 | no | dbc-2021#Table B.21 | dbc-2021#Table B.21, dbc-2021#B.8.1.4.1, dbc-2021#Table B.7, dbc-2021#Table B.22, dbc-2021#B.8.1.5 |
| g-011 | lookup | 1.00 | 1.00 | 0.754 | no | dbc-2021#Table B.4 | dbc-2021#Table B.4, dbc-2021#Table B.4, dbc-2021#B.6.4.1.12, dbc-2021#B.5.3, dbc-2021#B.8.5.2.3 (2/2) |
| g-012 | lookup | 1.00 | 1.00 | 0.728 | no | dbc-2021#B.6.4.1.12 | dbc-2021#B.6.4.1.12, dbc-2021#B.6.4.1.16, dbc-2021#B.6.4.1.1, dbc-2021#B.6.4.1.11, dbc-2021#Definition: Means of egress |
| g-013 | numeric | 1.00 | 1.00 | 0.706 | no | dbc-2021#B.6.4.1.12 | dbc-2021#B.6.4.1.12, dbc-2021#B.6.4.1.3, dbc-2021#Table B.6, dbc-2021#B.6.4.1.16, dbc-2021#B.6.4.1 |
| g-014 | numeric | 1.00 | 1.00 | 0.778 | no | dbc-2021#B.9.7.2.2 | dbc-2021#B.9.7.2.2, dbc-2021#Table B.31, dbc-2021#B.9.7.2.3, dbc-2021#Definition: Labour accommodation, dbc-2021#B.9.7.2.1 |
| g-015 | numeric | 1.00 | 1.00 | 0.756 | no | dbc-2021#Table B.32 | dbc-2021#Table B.32, dbc-2021#B.9.7.4, dbc-2021#Table B.31, dbc-2021#Table B.3, dbc-2021#B.5.2 |
| g-016 | lookup | 1.00 | 1.00 | 0.758 | no | dbc-2021#Table B.5 | dbc-2021#Table B.5, dbc-2021#B.6.2.1, dbc-2021#B.6.2.3, dbc-2021#Table B.4, dbc-2021#Table B.2 |
| g-017 | lookup | 1.00 | 1.00 | 0.721 | no | dbc-2021#B.5.3 | dbc-2021#B.5.3, dbc-2021#B.8.1.5, dbc-2021#B.9.5.1.3, dbc-2021#Table B.5, dbc-2021#B.7.3.1.4 |
| g-018 | numeric | 1.00 | 1.00 | 0.691 | no | dbc-2021#Table B.3 | dbc-2021#Table B.3, dbc-2021#Table B.2, dbc-2021#B.9.4.8, dbc-2021#B.5.3, dbc-2021#B.9.5.1.3 |
| g-019 | lookup | 1.00 | 1.00 | 0.760 | no | ecr-30-2013#Article 11 | ecr-30-2013#Article 11 (1/3), ecr-30-2013#Article 11 (2/3), ecr-30-2013#Article 11 (3/3), ecr-6-2010#Article 9, law-7-2006#Article 6 |
| g-020 | abstain | 0.00 | 0.00 | 0.725 | no |  | dbc-2021#F.5.7, dbc-2021#B.6.2.2, dbc-2021#B.6.6.4, dbc-2021#B.9.2, dbc-2021#Table F.2 |
| g-021 | lookup | 1.00 | 1.00 | 0.736 | no | dbc-2021#B.6.4.1.3 | dbc-2021#B.6.4.1.3, dbc-2021#B.6.4.1.12, dbc-2021#B.6.4.1.7, dbc-2021#B.7.3.3, dbc-2021#B.6.4.1.5 |
| g-022 | lookup | 1.00 | 1.00 | 0.746 | no | dbc-2021#B.6.4.1.15 | dbc-2021#B.6.4.1.15, dbc-2021#Table B.4, dbc-2021#B.6.4.1.12, dbc-2021#B.6.4.1.5, dbc-2021#B.6.4.1.3 |
| g-023 | lookup | 1.00 | 1.00 | 0.766 | no | dbc-2021#B.6.4.1.10 | dbc-2021#B.6.4.1.10, dbc-2021#Table B.6, dbc-2021#B.6.4.1.8, dbc-2021#B.6.4.1.16, dbc-2021#Definition: Exterior stairway |
| g-024 | lookup | 1.00 | 1.00 | 0.728 | no | dbc-2021#B.4.2.5.2 | dbc-2021#B.4.2.5.2, dbc-2021#Definition: Guardrail, dbc-2021#B.6.4.1.8, dbc-2021#B.6.1, dbc-2021#B.6.4.1.13 |
| g-025 | lookup | 1.00 | 1.00 | 0.808 | no | dbc-2021#B.8.1.6 | dbc-2021#B.8.1.6, dbc-2021#Definition: Housekeeper’s room, dbc-2021#Table B.3, dbc-2021#B.8.5.2.3 (1/2), dbc-2021#Table B.29 |
| g-026 | lookup | 1.00 | 1.00 | 0.747 | no | dbc-2021#B.8.2.2 | dbc-2021#B.8.2.2, dbc-2021#Definition: Feeding room or lactation room, dbc-2021#B.8.2.3, dbc-2021#Table B.24, dbc-2021#B.9.7.2.3 |
| g-027 | lookup | 1.00 | 1.00 | 0.735 | no | dbc-2021#B.8.3.2.4 | dbc-2021#B.8.3.2.4, dbc-2021#B.8.3.2.5, dbc-2021#B.8.3.2.1, dbc-2021#B.8.3.2.3, dbc-2021#B.8.3.2.2 |
| g-028 | lookup | 1.00 | 1.00 | 0.791 | no | dbc-2021#B.8.3.2.5 | dbc-2021#B.8.3.2.5, dbc-2021#Table B.6, dbc-2021#B.6.4.1.6, dbc-2021#B.4.2.5.2, dbc-2021#B.6.4.1.4 |
| g-029 | lookup | 1.00 | 1.00 | 0.721 | no | dbc-2021#B.7.2.3.3 | dbc-2021#B.7.2.3.3, dbc-2021#B.7.2.2, dbc-2021#Table B.11, dbc-2021#B.7.2.4, dbc-2021#Definition: Vehicle barrier |
| g-030 | lookup | 1.00 | 1.00 | 0.790 | no | dbc-2021#B.6.6.3 | dbc-2021#B.6.6.3, dbc-2021#Definition: Courtyard, dbc-2021#B.6.5.2.2, dbc-2021#B.6.5.2.1, dbc-2021#Table B.4 |
| g-031 | lookup | 1.00 | 1.00 | 0.689 | no | dbc-2021#B.8.1.1 | dbc-2021#B.8.1.1, dbc-2021#B.8.1.4.2, dbc-2021#B.8.3.3, dbc-2021#B.9.4.9, dbc-2021#B.8.1.4.1 |
| g-032 | lookup | 1.00 | 1.00 | 0.744 | no | dbc-2021#B.8.1.4.1 | dbc-2021#B.8.1.4.1, dbc-2021#B.6.2.1, dbc-2021#Table B.5, dbc-2021#Table B.21, dbc-2021#Table B.7 |
| g-033 | multi_clause | 1.00 | 1.00 | 0.721 | no | dbc-2021#B.6.4.1.7, dbc-2021#B.6.4.1.8 | dbc-2021#B.6.4.1.8, dbc-2021#B.6.4.1.7, dbc-2021#B.6.4.1.3, dbc-2021#B.4.2.5.2, dbc-2021#B.6.4.1.5 |
| g-034 | multi_clause | 1.00 | 1.00 | 0.751 | no | dbc-2021#Table B.6, dbc-2021#B.6.4.1.3 | dbc-2021#Table B.6, dbc-2021#B.6.4.1.4, dbc-2021#B.6.4.1.6, dbc-2021#B.6.4.1.13, dbc-2021#B.6.4.1.3 |
| g-035 | multi_clause | 1.00 | 1.00 | 0.765 | no | dbc-2021#B.7.2.6.2, dbc-2021#B.7.2.6.3 | dbc-2021#B.7.2.6.3, alsafat-2023#301.02, dbc-2021#B.7.2.6.2, alsafat-2023#301.03, dbc-2021#Table B.13 |
| g-036 | multi_clause | 1.00 | 1.00 | 0.786 | no | dbc-2021#Table B.16, dbc-2021#Table B.15 | dbc-2021#Table B.16, dbc-2021#Table B.15, dbc-2021#B.7.3.1.4, dbc-2021#B.7.3.1.3, dbc-2021#B.7.3.1.2 |
| g-037 | multi_clause | 0.50 | 1.00 | 0.769 | no | dbc-2021#B.8.1.3.1, dbc-2021#B.5.1 | dbc-2021#B.8.1.3.1, dbc-2021#Table B.18, dbc-2021#Table B.18, dbc-2021#Table B.20, dbc-2021#Table B.19 |
| g-038 | multi_clause | 1.00 | 1.00 | 0.740 | no | dbc-2021#Table B.2, dbc-2021#B.5.1 | dbc-2021#Table B.2, dbc-2021#Table B.2, dbc-2021#B.5.1, dbc-2021#A.5.2.3, dbc-2021#Table B.18 |
| g-039 | multi_clause | 1.00 | 1.00 | 0.803 | no | dbc-2021#B.8.3.3, dbc-2021#Table B.26 | dbc-2021#Table B.26, dbc-2021#B.8.3.3, dbc-2021#Table B.19, dbc-2021#Definition: Prayer room, dbc-2021#B.9.4.6.1 |
| g-040 | multi_clause | 1.00 | 1.00 | 0.754 | no | dbc-2021#B.8.3.2.6, dbc-2021#Table B.25 | dbc-2021#B.8.3.2.6, dbc-2021#Table B.25, dbc-2021#B.8.3.2.2, dbc-2021#B.8.3.2.2 table 1, dbc-2021#B.8.3.2.5 |
| g-041 | multi_clause | 1.00 | 1.00 | 0.757 | no | dbc-2021#B.7.3.2 | dbc-2021#B.7.3.2, dbc-2021#Table B.9, dbc-2021#B.7.2.2, dbc-2021#B.6.4.1.13, dbc-2021#B.6.4.2 |
| g-042 | trap | 1.00 | 1.00 | 0.747 | no | dbc-2021#B.6.4.1.1 | dbc-2021#B.6.4.1.1, dbc-2021#B.6.4.1.16, dbc-2021#B.6.4.1.2, dbc-2021#B.6.4.1.11, dbc-2021#B.6.4.1.3 |
| g-043 | trap | 1.00 | 1.00 | 0.710 | no | dbc-2021#B.6.4.1.2 | dbc-2021#B.6.4.1.2, dbc-2021#B.6.2.2, dbc-2021#B.6.6.4, dbc-2021#F.5.7, dbc-2021#B.6.4.1.1 |
| g-044 | trap | 0.00 | 0.00 | 0.000 | yes |  |  |
| g-045 | trap | 0.00 | 0.00 | 0.000 | yes |  |  |
| g-046 | trap | 0.00 | 0.00 | 0.000 | yes |  |  |
| g-047 | trap | 1.00 | 1.00 | 0.756 | no | dbc-2021#Table B.5 | dbc-2021#Table B.5, dbc-2021#B.6.2.1, dbc-2021#Definition: Service corridor, dbc-2021#Definition: Corridor, dbc-2021#Table B.7 |
| g-048 | trap | 0.00 | 0.00 | 0.696 | no |  | dbc-2021#Table B.5, dbc-2021#B.6.2.1, dbc-2021#Definition: Corridor, dbc-2021#Table B.7, dbc-2021#Table B.4 |
| g-049 | trap | 1.00 | 1.00 | 0.730 | no | dbc-2021#B.7.3.4 | dbc-2021#B.7.3.4, dbc-2021#B.7.3.3, dbc-2021#B.4.3.4, dbc-2021#B.8.3.2.5, dbc-2021#Table B.17 |
| g-050 | trap | 1.00 | 0.50 | 0.000 | no | dbc-2021#B.8.4 | dbc-2021#B.4.2.3 (1/2), dbc-2021#B.8.4, dbc-2021#B.8.5.2.2 (1/2), dbc-2021#B.4.3.2, dbc-2021#Table A.3 |
| g-051 | trap | 1.00 | 1.00 | 0.697 | no | dbc-2021#B.4.2.6 | dbc-2021#B.4.2.6, dbc-2021#Definition: device), dbc-2021#Definition: Balcony, dbc-2021#B.4.2.5.2, dbc-2021#B.8.3.2.3 |
| g-052 | abstain | 0.00 | 0.00 | 0.701 | no |  | law-8-2007#Article 16, dbc-2021#Definition: Project, bylaw-85-2006#Article 39, law-8-2007#Article 17, dbc-2021#Definition: Project |
| g-053 | abstain | 0.00 | 0.00 | 0.670 | yes |  | ecr-30-2013#Article 11 (3/3), ecr-30-2013#Article 11 (2/3), ecr-30-2013#Article 11 (1/3), dbc-circular#Circular p1, ecr-6-2010#Article 8 |
| g-054 | abstain | 0.00 | 0.00 | 0.687 | no |  | dbc-wind#2, dbc-2021#Table F.10, dbc-wind#3.1.1, dbc-wind#3.1.2, dbc-wind#5.1 (2/3) |
| g-055 | abstain | 0.00 | 0.00 | 0.727 | no |  | dbc-2021#Table F.9, dbc-2021#F.9.4.2.1, dbc-2021#F.9.4.6, dbc-2021#F.7.6, dbc-2021#F.9.5.4 |
| g-056 | abstain | 0.00 | 0.00 | 0.783 | no |  | dbc-2021#Table F.15, dbc-2021#F.7.13.10, dbc-2021#F.3.2.3, dbc-2021#Table F.23, dbc-2021#F.7.13.3.1 |
| g-057 | abstain | 0.00 | 0.00 | 0.604 | yes |  | dbc-2021#B.9.7.1, dbc-2021#B.6.6.1, dbc-2021#B.4.2.3 (1/2), dbc-2021#B.4.3.1, dbc-2021#B.9.6.4 |
| g-058 | abstain | 0.00 | 0.00 | 0.651 | yes |  | alsafat-2023#701.01, alsafat-2023#501.02, alsafat-2023#Introduction p30, dbc-2021#B.4.3.4, alsafat-2023#501.01 (1/2) |
| g-059 | abstain | 0.00 | 0.00 | 0.671 | yes |  | dbc-2021#B.6.4.1.16, dbc-2021#B.4.3.2, dbc-2021#Table B.3, dbc-2021#Table B.8, dbc-2021#B.4.3.1 |
| g-060 | multi_clause | 1.00 | 1.00 | 0.688 | no | dbc-2021#B.6.4.1.8, dbc-2021#B.4.3.4, dbc-2021#B.4.2.5.2 | dbc-2021#B.6.4.1.8, dbc-2021#B.4.2.5.2, dbc-2021#B.7.3.4, dbc-2021#B.4.3.4, dbc-2021#Definition: Guardrail |
| g-061 | multi_clause | 1.00 | 1.00 | 0.744 | no | law-27-2007#Article 8 | law-27-2007#Article 8, law-27-2007#Article 7, law-27-2007#Article 2, law-27-2007#Article 16, law-27-2007#Article 23 |
| g-062 | trap | 1.00 | 0.33 | 0.716 | no | dbc-2021#Table A.1, law-27-2007#Article 8, law-27-2007#Article 23 | dbc-2021#Definition: Renovation, law-26-2007#Article 18, law-27-2007#Article 23, dbc-2021#Table A.1, law-27-2007#Article 8 |
| g-063 | lookup | 1.00 | 1.00 | 0.826 | no | dbc-2021#Table A.1 | dbc-2021#Table A.1, dbc-2021#Definition: Renovation, dbc-2021#Definition: Existing building, dbc-2021#Definition: Reconstruction, dbc-2021#Definition: Development |
| g-064 | lookup | 1.00 | 1.00 | 0.733 | no | ecr-30-2013#Article 11 | ecr-30-2013#Article 11 (1/3), ecr-30-2013#Article 3, ecr-30-2013#Article 11 (2/3), ecr-30-2013#Article 2, law-7-2013#Article 11 |
| g-065 | lookup | 1.00 | 1.00 | 0.801 | no | alsafat-2023#301.02 | alsafat-2023#301.02, alsafat-2023#301.03, alsafat-2023#Introduction p31, alsafat-2023#301.04, alsafat-2023#502.19 |
| g-066 | trap | 1.00 | 1.00 | 0.810 | no | dbc-2021#B.7.2.6.2, alsafat-2023#301.02 | dbc-2021#B.7.2.6.2, alsafat-2023#301.02, dbc-2021#B.7.2.6.3, dbc-2021#Definition: Designated preferred parking spaces, alsafat-2023#301.03 |
| g-067 | lookup | 1.00 | 1.00 | 0.818 | no | dbc-wind#3.1.2 | dbc-wind#3.1.2, dbc-wind#3.1, dbc-wind#4.1, dbc-wind#3.2, dbc-wind#1.1 |
| g-068 | lookup | 1.00 | 1.00 | 0.676 | no | decree-43-2013#Article 1 | decree-43-2013#Article 1, law-26-2007#Article 10, law-26-2007#Article 13, decree-43-2013#Article 3, law-33-2008#Article 9 |
| g-069 | lookup | 1.00 | 1.00 | 0.645 | no | ecr-30-2013#Article 11 | ecr-30-2013#Article 11 (1/3), ecr-30-2013#Article 11 (2/3), ecr-30-2013#Article 11 (3/3), law-13-2008#Article 7, ecr-30-2013#Article 3 |
| g-070 | trap | 1.00 | 1.00 | 0.666 | yes | law-26-2007#Article 19, law-26-2007#Article 18 | law-26-2007#Article 18, law-33-2008#Article 29, law-26-2007#Article 29, law-26-2007#Article 19, law-26-2007#Article 17 |
| g-071 | lookup | 1.00 | 1.00 | 0.701 | no | law-26-2007#Article 24 | law-26-2007#Article 24, law-26-2007#Article 8, law-26-2007#Article 30, law-26-2007#Article 25, law-33-2008#Article 25 (1/2) |
