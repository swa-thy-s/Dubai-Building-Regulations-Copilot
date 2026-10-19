# Documents taken from official publisher websites (fetched 2026-10-19)

Everything here was downloaded from the publisher's own site. Saved copies live in `data/raw/web/` (not committed).
Web pages carry the retrieval date as their edition, because the publisher can change a page without notice.

## Indexed (ready, waiting for embedding capacity)

| Publisher | Document | Official link |
| --- | --- | --- |
| DDA | Fit-Out Permit service page (documents, fee, timing, validity, when a modification permit is needed) | https://dda.gov.ae/planning-development/construction/permits-nocs/fit-out-permit |
| DDA | Building Modification Permit service page | https://dda.gov.ae/en/planning-development/construction/permits-nocs/building-modification-permit |
| DDA | Circular 318 (works that need no fit-out permit) | https://dda.gov.ae/-/media/116360B0DDBF4E1E89473C90A530CEAD.pdf |
| DDA | Circular 338, 11 Dec 2019 (units up to 100 m2 and mall units) | https://dda.gov.ae/-/media/403EAC241E074C8DB6385C46DE4896E9.pdf |
| Trakhees (PCFC) | CP-01 Client Procedure for obtaining Modification Permits, Rev 02, Sep 2024 | https://pcfc.ae/en/Service%20Documents/PCFC-TRK-CED-MF-CP-01,%20Client%20Procecure%20for%20obtaining%20Modification%20Permits.pdf |
| Trakhees (PCFC) | CP-02 Modification Completion Certificate and Cancellation Inspection, Rev 02, Dec 2022 | https://pcfc.ae/en/Service%20Documents/PCFC-TRK-CED-MF-CP-02,%20Client%20Procedure%20for%20requesting%20Modification%20Completion%20Certificate%20(MCC)%20Modification%20Cancelation%20Inspection%20(MPC).pdf |
| Dubai Municipality | FAQ: Buildings Permit Procedures and Regulations (file dated Sep 2023) | https://dmpmedia.dm.gov.ae/uploads/2023/09/FAQ-for-Buildings-Permit-Procedures-and-Regulations-eng-1.pdf |
| Dubai Municipality | Building permit and completion certificate procedure: multistorey, villas, industrial (version 4) | https://dmpmedia.dm.gov.ae/uploads/2020/06/Multi-Story_Building-Permits-Procedures.pdf (and the Residential and Industrial files in the same folder) |

## Your existing documents, checked against the publisher (SHA-256 identical)

Dubai Building Code 2021 (English), Al Sa'fat 2nd edition (Jan 2023), Wind Code, Seismic Design Code, Structural Codes and Guidelines, Soil Testing Guidelines, and the Sustainable Dubai report. Links are in `ingest/sources.yaml`. The Seismic code's garbled text layer is in the official file itself, so a clean copy does not exist on DM's site.

## Found but not indexed

- **Dubai Municipality circulars on modifications (2-1-1, 3-7-1, 3-8-1 Self-Permit for Interior Decoration Works, 3-10-1, 3-10-2).** Official, but published in Arabic only, with a reversed-order text layer. Verbatim quotes are not possible without Arabic OCR, and an English summary written by the tool would not be a quote. Needs Arabic OCR plus an official English version.
- **Dubai Silicon Oasis Authority:** no published fit-out or building-modification procedure found. Its online terms say a tenant may not alter the property without DSOA's prior written consent, which is a lease term, not a procedure.
- **Dubai Municipality "Permit to Make Modifications or Additions to Buildings" service page:** listed on DM's services portal, which is rendered by JavaScript, so its text could not be fetched. Needs a browser-based capture.
- **DM Building Permit Procedures index page:** only links to the three procedure files above, no procedure text of its own.
